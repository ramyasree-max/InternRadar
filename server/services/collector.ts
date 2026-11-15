import crypto from 'crypto';
import { getDbStore } from '../db.ts';
import {
  fetchAndStandardizeFromSource,
  type SourceCompanyConfig,
  type StandardizedInternship,
} from './internshipFeedService.ts';

async function notifyMatchingStudents(
  internshipId: string,
  companyName: string,
  title: string,
  skills: string[],
  isUpdate: boolean
) {
  const store = getDbStore();
  const profiles = await store.listAllStudentNotificationTargets();
  const nowIso = new Date().toISOString();
  const notifType = isUpdate ? 'internship_update' : 'new_internship';

  for (const prof of profiles) {
    try {
      const prefs = JSON.parse(prof.notification_prefs_json || '{}');
      if (isUpdate && prefs.updates === false) continue;
      if (!isUpdate && prefs.newMatches === false) continue;

      const userSkills = new Set<string>(
        [...JSON.parse(prof.skills_json || '[]'), ...JSON.parse(prof.languages_json || '[]')].map((s: string) =>
          s.toLowerCase()
        )
      );
      const overlaps = skills.filter((sk) => userSkills.has(sk.toLowerCase()));
      if (overlaps.length > 0 || skills.length === 0) {
        const recentDup = await store.hasNotification(prof.user_id, internshipId, notifType);
        if (recentDup) continue;

        await store.createNotification({
          id: `notif_${crypto.randomUUID()}`,
          user_id: prof.user_id,
          type: notifType,
          title: isUpdate ? `Updated: ${title}` : `New Verified Internship: ${companyName}`,
          message: isUpdate
            ? `${companyName} updated details for ${title}. Review the latest requirements.`
            : `${companyName} published ${title}${overlaps.length ? ` matching your skills (${overlaps.slice(0, 3).join(', ')})` : ''}.`,
          related_internship_id: internshipId,
          is_read: 0,
          created_at: nowIso,
        });
      }
    } catch {
      // Ignore malformed notification preference payloads
    }
  }
}

async function persistStandardizedInternship(
  company: SourceCompanyConfig,
  item: StandardizedInternship,
  verifiedAt: string,
  httpStatus: number
): Promise<{ outcome: 'discovered' | 'updated' | 'unchanged' | 'deduped'; internshipId: string }> {
  const store = getDbStore();
  const existing = await store.findInternshipByExternal(company.source_platform, item.externalId);

  if (!existing) {
    const dupByTitle = await store.findNonDemoDuplicateByTitle(company.id, item.normalizedTitle, item.location);
    if (dupByTitle) {
      await store.touchInternshipVerified(dupByTitle.id, verifiedAt);
      return { outcome: 'deduped', internshipId: dupByTitle.id };
    }

    const newId = `int_${crypto.randomUUID()}`;
    await store.createInternshipWithHistory({
      id: newId,
      companyId: company.id,
      sourcePlatform: company.source_platform,
      item,
      verifiedAt,
      historyId: `vh_${crypto.randomUUID()}`,
      httpStatus,
    });

    await notifyMatchingStudents(newId, item.companyName, item.title, item.requiredSkills, false);
    return { outcome: 'discovered', internshipId: newId };
  }

  const changed = existing.content_hash !== item.contentHash;
  const statusReopened =
    existing.verification_status !== 'Verified Open' && existing.verification_status !== 'Closing Soon';

  await store.updateInternshipFromSource({
    id: existing.id,
    item,
    changed,
    verifiedAt,
  });

  if (changed || statusReopened) {
    await store.insertVerificationHistory({
      id: `vh_${crypto.randomUUID()}`,
      internship_id: existing.id,
      checked_at: verifiedAt,
      previous_status: existing.verification_status,
      new_status: 'Verified Open',
      change_summary: changed ? 'Listing details or requirements updated' : 'Listing re-verified open',
      http_status: httpStatus,
    });

    if (changed) {
      await notifyMatchingStudents(existing.id, item.companyName, item.title, item.requiredSkills, true);
      return { outcome: 'updated', internshipId: existing.id };
    }
  }

  return { outcome: 'unchanged', internshipId: existing.id };
}

async function checkUpcomingDeadlinesAndNotify() {
  const store = getDbStore();
  const now = new Date();
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 86400000).toISOString();
  const nowIso = now.toISOString();

  const approaching = await store.listApproachingDeadlines(nowIso, fiveDaysFromNow);

  for (const job of approaching) {
    if (job.verification_status === 'Verified Open') {
      await store.setInternshipClosingSoon(job.id);
    }

    const trackers = await store.listTrackersForDeadline(job.id);
    for (const tr of trackers) {
      try {
        const prefs = JSON.parse(tr.notification_prefs_json || '{}');
        if (prefs.deadlines === false) continue;
        const dup = await store.hasNotification(tr.user_id, job.id, 'deadline_reminder');
        if (dup) continue;
        await store.createNotification({
          id: `notif_${crypto.randomUUID()}`,
          user_id: tr.user_id,
          type: 'deadline_reminder',
          title: `Closing Soon: ${job.company_name}`,
          message: `${job.title} closes on ${job.deadline_at.slice(0, 10)}. Review requirements and submit before the deadline.`,
          related_internship_id: job.id,
          is_read: 0,
          created_at: nowIso,
        });
      } catch {
        // Ignore malformed preference payloads
      }
    }
  }
}

export async function runCompanySourceCollection(company: SourceCompanyConfig): Promise<{
  status: string;
  discovered: number;
  updated: number;
  closed: number;
  error?: string;
}> {
  const store = getDbStore();
  const startedAt = new Date().toISOString();
  const result = await fetchAndStandardizeFromSource(company);
  const finishedAt = new Date().toISOString();

  if (!result.ok) {
    await store.markCompanyUnavailable(company.id, finishedAt, result.error || 'Source temporarily unreachable');
    await store.insertCollectionLog({
      id: `log_${crypto.randomUUID()}`,
      company_id: company.id,
      company_name: company.name,
      source_platform: company.source_platform,
      started_at: startedAt,
      finished_at: finishedAt,
      status: 'Collection Failed',
      discovered_count: 0,
      updated_count: 0,
      closed_count: 0,
      error_message: result.error || 'Fetch failed',
    });

    return { status: 'Temporarily Unavailable', discovered: 0, updated: 0, closed: 0, error: result.error };
  }

  let discovered = 0;
  let updated = 0;
  let closed = 0;
  const activeInternshipIds = new Set<string>();
  const httpStatus = result.httpStatus ?? 200;

  for (const item of result.listings) {
    const res = await persistStandardizedInternship(company, item, finishedAt, httpStatus);
    activeInternshipIds.add(res.internshipId);
    if (res.outcome === 'discovered') discovered++;
    else if (res.outcome === 'updated') updated++;
  }

  const previouslyOpen = await store.listPreviouslyOpenInternships(company.id);

  for (const prev of previouslyOpen) {
    if (!activeInternshipIds.has(prev.id)) {
      await store.markInternshipClosed(prev.id, finishedAt);
      await store.insertVerificationHistory({
        id: `vh_${crypto.randomUUID()}`,
        internship_id: prev.id,
        checked_at: finishedAt,
        previous_status: prev.verification_status,
        new_status: 'Closed',
        change_summary: 'Listing no longer present on official careers feed',
        http_status: httpStatus,
      });
      closed++;
    }
  }

  const summaryMsg = `Verified ${result.listings.length} open internship${result.listings.length === 1 ? '' : 's'} (${discovered} new, ${updated} updated, ${closed} closed)`;

  await store.markCompanyOperational(company.id, finishedAt, summaryMsg);
  await store.insertCollectionLog({
    id: `log_${crypto.randomUUID()}`,
    company_id: company.id,
    company_name: company.name,
    source_platform: company.source_platform,
    started_at: startedAt,
    finished_at: finishedAt,
    status: 'Operational',
    discovered_count: discovered,
    updated_count: updated,
    closed_count: closed,
    error_message: '',
  });

  return { status: 'Operational', discovered, updated, closed };
}

export async function runAllSourcesCollection(): Promise<{
  scanned: number;
  operational: number;
  unavailable: number;
  discovered: number;
  updated: number;
  closed: number;
}> {
  const store = getDbStore();
  const companies = await store.listNonDemoCompanies();

  let operational = 0;
  let unavailable = 0;
  let discovered = 0;
  let updated = 0;
  let closed = 0;

  // Polite concurrent batches of 4 so real APIs and feeds finish quickly without rate-limit spikes
  const batchSize = 4;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((c) => runCompanySourceCollection(c)));
    for (const res of results) {
      if (res.status === 'Operational') operational++;
      else unavailable++;
      discovered += res.discovered;
      updated += res.updated;
      closed += res.closed;
    }
  }

  await checkUpcomingDeadlinesAndNotify();

  return {
    scanned: companies.length,
    operational,
    unavailable,
    discovered,
    updated,
    closed,
  };
}
