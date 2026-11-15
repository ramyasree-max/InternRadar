import cron, { type ScheduledTask } from 'node-cron';
import { runAllSourcesCollection } from './collector.ts';
import { getSupportedAdapters } from './internshipFeedService.ts';
import { refreshIndustryNews } from './newsCollector.ts';

export interface CollectionRunSummary {
  scanned: number;
  operational: number;
  unavailable: number;
  discovered: number;
  updated: number;
  closed: number;
}

const INTERNSHIP_CRON_EXPR = '0 * * * *';
const NEWS_CRON_EXPR = '15 * * * *';

let internshipCronTask: ScheduledTask | null = null;
let newsCronTask: ScheduledTask | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;

let isScanning = false;
let totalRuns = 0;
let lastScanStartedAt: string | null = null;
let lastScanCompletedAt: string | null = null;
let lastScanDurationMs: number | null = null;
let lastScanError: string | null = null;
let lastScanSummary: CollectionRunSummary | null = null;
let lastNewsRefreshAt: string | null = null;

export function getNextHourlyScanIso(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next.toISOString();
}

export function getSchedulerStatus() {
  return {
    isRunning: Boolean(internshipCronTask),
    isScanning,
    totalRuns,
    lastScanStartedAt,
    lastScanCompletedAt,
    lastScanDurationMs,
    lastScanError,
    lastScanSummary,
    lastNewsRefreshAt,
    nextScheduledCollectionAt: getNextHourlyScanIso(),
    cadence: `Every 60 minutes (${INTERNSHIP_CRON_EXPR})`,
    supportedAdapters: getSupportedAdapters(),
  };
}

export async function triggerVerificationScan(): Promise<{
  started: boolean;
  alreadyRunning?: boolean;
  result?: CollectionRunSummary;
  error?: string;
}> {
  if (isScanning) {
    return { started: false, alreadyRunning: true };
  }

  isScanning = true;
  const startedMs = Date.now();
  lastScanStartedAt = new Date(startedMs).toISOString();
  lastScanError = null;

  try {
    const result = await runAllSourcesCollection();
    lastScanCompletedAt = new Date().toISOString();
    lastScanDurationMs = Date.now() - startedMs;
    lastScanSummary = result;
    totalRuns++;
    return { started: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected scheduler verification error';
    lastScanCompletedAt = new Date().toISOString();
    lastScanDurationMs = Date.now() - startedMs;
    lastScanError = message;
    return { started: true, error: message };
  } finally {
    isScanning = false;
  }
}

export function startHourlyMonitoring() {
  if (internshipCronTask) {
    return;
  }

  if (!cron.validate(INTERNSHIP_CRON_EXPR) || !cron.validate(NEWS_CRON_EXPR)) {
    throw new Error('Invalid cron expression configured for hourly monitoring.');
  }

  // Schedule hourly internship API + RSS/Atom collection at minute 0 of every hour (UTC)
  internshipCronTask = cron.schedule(
    INTERNSHIP_CRON_EXPR,
    async () => {
      console.log('[InternRadar Scheduler] Running hourly internship source verification...');
      const outcome = await triggerVerificationScan();
      if (outcome.result) {
        console.log(
          `[InternRadar Scheduler] Hourly collection complete: ${outcome.result.operational}/${outcome.result.scanned} operational, ${outcome.result.discovered} new, ${outcome.result.updated} updated, ${outcome.result.closed} closed.`
        );
      }
    },
    { timezone: 'UTC' }
  );

  // Schedule hourly industry news verification at minute 15 of every hour (UTC)
  newsCronTask = cron.schedule(
    NEWS_CRON_EXPR,
    async () => {
      console.log('[InternRadar Scheduler] Refreshing industry news feeds...');
      try {
        await refreshIndustryNews();
        lastNewsRefreshAt = new Date().toISOString();
      } catch (err) {
        console.error('[InternRadar Scheduler] News refresh error:', err);
      }
    },
    { timezone: 'UTC' }
  );

  // Non-blocking initial verification pass after Vite dev middleware settles
  startupTimer = setTimeout(async () => {
    try {
      await triggerVerificationScan();
      await refreshIndustryNews();
      lastNewsRefreshAt = new Date().toISOString();
    } catch (err) {
      console.error('[InternRadar Scheduler] Initial background verification error:', err);
    }
  }, 8000);
}

export function stopHourlyMonitoring() {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (internshipCronTask) {
    internshipCronTask.stop();
    internshipCronTask = null;
  }
  if (newsCronTask) {
    newsCronTask.stop();
    newsCronTask = null;
  }
}
