import { Router } from 'express';
import { getDbStore, getStorageStatus } from '../db.ts';
import { optionalAuth, requireAuth, type AuthedRequest } from '../middleware/auth.ts';
import { getSchedulerStatus, triggerVerificationScan } from '../services/scheduler.ts';
import type { InternshipRecord } from '../storeTypes.ts';

export const internshipsRouter = Router();

function serializeInternship(row: InternshipRecord) {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    sector: row.sector || 'Private',
    externalId: row.external_id,
    title: row.title,
    category: row.category,
    description: row.description,
    requiredSkills: JSON.parse(row.required_skills_json || '[]'),
    preferredSkills: JSON.parse(row.preferred_skills_json || '[]'),
    eligibility: row.eligibility,
    stipendText: row.stipend_text,
    stipendMin: row.stipend_min,
    paidType: row.paid_type,
    location: row.location,
    workArrangement: row.work_arrangement,
    sourcePlatform: row.source_platform,
    originalListingUrl: row.original_listing_url,
    originalApplicationUrl: row.original_application_url,
    publishedAt: row.published_at,
    deadlineAt: row.deadline_at,
    firstDiscoveredAt: row.first_discovered_at,
    lastUpdatedAt: row.last_updated_at,
    lastVerifiedAt: row.last_verified_at,
    verificationStatus: row.verification_status,
    isDemo: Boolean(row.is_demo),
  };
}

internshipsRouter.get('/internships', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const {
      q = '',
      company = '',
      skill = '',
      location = '',
      category = '',
      sector = '',
      arrangement = '',
      paidType = '',
      stipendMin = '',
      sort = 'newly_discovered',
      status = 'Verified Open',
      includeDemo = 'false',
    } = req.query as Record<string, string>;

    const store = getDbStore();
    const { rows, total, sectorCounts } = await store.queryInternships({
      q,
      company,
      skill,
      location,
      category,
      sector,
      arrangement,
      paidType,
      stipendMin: stipendMin !== '' && !Number.isNaN(Number(stipendMin)) ? Number(stipendMin) : undefined,
      sort,
      status,
      includeDemo: includeDemo === 'true',
    });

    const savedIds = new Set<string>();
    const appStatuses: Record<string, string> = {};
    if (req.user) {
      const apps = await store.getUserAppStatuses(req.user.id);
      for (const a of apps) {
        savedIds.add(a.internship_id);
        appStatuses[a.internship_id] = a.status;
      }
    }

    res.json({
      internships: rows.map((r) => ({
        ...serializeInternship(r),
        applicationStatus: appStatuses[r.id] || null,
        isSaved: savedIds.has(r.id),
      })),
      total,
      sectorCounts,
      scheduler: getSchedulerStatus(),
    });
  } catch (err) {
    next(err);
  }
});

internshipsRouter.post('/internships/refresh', async (_req, res, next) => {
  try {
    const outcome = await triggerVerificationScan();
    if (outcome.alreadyRunning) {
      res.json({ status: 'already_running', scheduler: getSchedulerStatus() });
      return;
    }
    res.json({ status: 'completed', ...outcome, scheduler: getSchedulerStatus() });
  } catch (err) {
    next(err);
  }
});

internshipsRouter.get('/internships/:id', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const store = getDbStore();
    const internshipId = String(req.params.id);
    const row = await store.findInternshipById(internshipId);
    if (!row) {
      res.status(404).json({ error: 'Internship not found.' });
      return;
    }

    const [company, history] = await Promise.all([
      store.findCompanyById(row.company_id),
      store.listVerificationHistory(row.id, 15),
    ]);

    let application = null;
    let cachedMatch = null;
    if (req.user) {
      const [appRow, m] = await Promise.all([
        store.findApplicationByUserAndInternship(req.user.id, row.id),
        store.getCachedSkillMatch(req.user.id, row.id),
      ]);
      application = appRow;
      if (m) {
        cachedMatch = {
          estimatedMatchPercentage: m.match_percentage,
          matchingSkills: JSON.parse(m.matching_skills_json || '[]'),
          missingSkills: JSON.parse(m.missing_skills_json || '[]'),
          requiredSkills: JSON.parse(m.required_skills_json || '[]'),
          preferredSkills: JSON.parse(m.preferred_skills_json || '[]'),
          eligibilityWarnings: JSON.parse(m.eligibility_warnings_json || '[]'),
          recommendedResources: JSON.parse(m.learning_resources_json || '[]'),
          suggestedProjects: JSON.parse(m.project_suggestions_json || '[]'),
          explanation: m.explanation,
          usedAi: Boolean(m.used_ai),
          computedAt: m.computed_at,
        };
      }
    }

    res.json({
      internship: serializeInternship(row),
      company: company
        ? {
            id: company.id,
            name: company.name,
            sector: company.sector || 'Private',
            websiteUrl: company.website_url,
            careersUrl: company.careers_url,
            sourcePlatform: company.source_platform,
            integrationStatus: company.integration_status,
            lastSuccessAt: company.last_success_at,
          }
        : null,
      verificationHistory: history.map((h) => ({
        id: h.id,
        checkedAt: h.checked_at,
        previousStatus: h.previous_status,
        newStatus: h.new_status,
        changeSummary: h.change_summary,
        httpStatus: h.http_status,
      })),
      application,
      cachedMatch,
    });
  } catch (err) {
    next(err);
  }
});

internshipsRouter.get('/companies', async (req, res, next) => {
  try {
    const includeDemo = req.query.includeDemo === 'true';
    const sector = String(req.query.sector || 'All');
    const companies = await getDbStore().listCompaniesWithOpenCounts({ includeDemo, sector });

    res.json({
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        sector: c.sector || 'Private',
        websiteUrl: c.website_url,
        careersUrl: c.careers_url,
        sourcePlatform: c.source_platform,
        integrationStatus: c.integration_status,
        lastCheckedAt: c.last_checked_at,
        lastSuccessAt: c.last_success_at,
        lastResultSummary: c.last_result_summary,
        verifiedOpenCount: c.verified_open_count,
        isDemo: Boolean(c.is_demo),
      })),
    });
  } catch (err) {
    next(err);
  }
});

internshipsRouter.get('/transparency', async (_req, res, next) => {
  try {
    const stats = await getDbStore().getTransparencyStats();
    const scheduler = getSchedulerStatus();
    const storage = getStorageStatus();

    res.json({
      metrics: {
        integratedCompanies: stats.companies.length,
        supportedJobSources: stats.supportedJobSources,
        lastSuccessfulCollectionAt: stats.lastSuccessfulCollectionAt,
        sourcesTemporarilyUnavailable: stats.sourcesTemporarilyUnavailable,
        verifiedOpenInternships: stats.verifiedOpenInternships,
        nextScheduledCollectionAt: scheduler.nextScheduledCollectionAt,
      },
      storage,
      scheduler,
      sources: stats.companies.map((c) => ({
        id: c.id,
        name: c.name,
        sector: c.sector || 'Private',
        sourcePlatform: c.source_platform,
        careersUrl: c.careers_url,
        integrationStatus: c.integration_status,
        lastCheckedAt: c.last_checked_at,
        lastSuccessAt: c.last_success_at,
        latestResult: c.last_result_summary,
        verifiedOpenCount: c.verified_open_count,
      })),
      recentLogs: stats.recentLogs.map((l) => ({
        id: l.id,
        companyName: l.company_name,
        sourcePlatform: l.source_platform,
        startedAt: l.started_at,
        finishedAt: l.finished_at,
        status: l.status,
        discoveredCount: l.discovered_count,
        updatedCount: l.updated_count,
        closedCount: l.closed_count,
        errorMessage: l.error_message,
      })),
    });
  } catch (err) {
    next(err);
  }
});

internshipsRouter.post('/transparency/scan', requireAuth, async (_req, res, next) => {
  try {
    const outcome = await triggerVerificationScan();
    if (outcome.alreadyRunning) {
      res.status(409).json({ error: 'A source verification scan is already in progress.' });
      return;
    }
    res.json(outcome);
  } catch (err) {
    next(err);
  }
});
