import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { StatusText } from '../components/StatusText.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatDateTime } from '../lib/api.ts';

interface TransparencyResponse {
  metrics: {
    integratedCompanies: number;
    supportedJobSources: number;
    lastSuccessfulCollectionAt: string | null;
    sourcesTemporarilyUnavailable: number;
    verifiedOpenInternships: number;
    nextScheduledCollectionAt: string;
  };
  storage?: {
    engine: string;
    configured: boolean;
    connected: boolean;
    dbName: string;
    usernameHint: string;
    message: string;
    error?: string;
  };
  scheduler: {
    isRunning: boolean;
    isScanning: boolean;
    totalRuns: number;
    lastScanStartedAt: string | null;
    lastScanCompletedAt: string | null;
    lastScanDurationMs: number | null;
    lastScanError: string | null;
    lastScanSummary: {
      scanned: number;
      operational: number;
      unavailable: number;
      discovered: number;
      updated: number;
      closed: number;
    } | null;
    cadence: string;
    supportedAdapters: Array<{ platform: string; kind: string }>;
  };
  sources: Array<{
    id: string;
    name: string;
    sector: string;
    sourcePlatform: string;
    careersUrl: string;
    integrationStatus: string;
    lastCheckedAt: string | null;
    lastSuccessAt: string | null;
    latestResult: string;
    verifiedOpenCount: number;
  }>;
  recentLogs: Array<{
    id: string;
    companyName: string;
    sourcePlatform: string;
    startedAt: string;
    finishedAt: string;
    status: string;
    discoveredCount: number;
    updatedCount: number;
    closedCount: number;
    errorMessage: string;
  }>;
}

export function TransparencyPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TransparencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const res = await apiFetch<TransparencyResponse>('/api/transparency');
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualScan = async () => {
    setScanning(true);
    setMessage('');
    try {
      const res = await apiFetch<{ result?: { scanned: number; operational: number; unavailable: number; discovered: number } }>(
        '/api/transparency/scan',
        { method: 'POST' }
      );
      if (res.result) {
        setMessage(
          `Verification scan finished: ${res.result.operational}/${res.result.scanned} sources operational, ${res.result.discovered} new internships discovered.`
        );
      }
      await loadData();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to trigger scan');
    } finally {
      setScanning(false);
    }
  };

  return (
    <AppShell
      title="Source Transparency"
      subtitle="Live backend telemetry, source verification statuses, and honest platform coverage"
      actions={
        user ? (
          <button
            type="button"
            onClick={handleManualScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Verifying Sources...' : 'Run Verification Scan'}</span>
          </button>
        ) : undefined
      }
    >
      {loading || !data ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : (
        <div className="space-y-6">
          {message && (
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-[#14243A]">
              {message}
            </div>
          )}

          {/* Coverage & Limitations Notice */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0F9D78]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified Production Data Only</span>
                </div>
                <p className="text-sm text-[#14243A] leading-relaxed">
                  All metrics below are computed directly from InternRadar’s live{' '}
                  <span className="font-semibold">{data.storage?.engine || 'Database'}</span> backend records (DEMO sample entries are excluded). InternRadar monitors integrated public ATS career boards independently every 60 minutes and does not claim to index every company or every internship on the web.
                </p>
              </div>
              <div className="text-xs text-[#64748B] shrink-0">
                <p>Scheduler Cadence</p>
                <p className="font-mono font-medium text-[#14243A] mt-0.5">{data.scheduler.cadence}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
              <div>
                <p className="text-[#64748B]">Database Engine</p>
                <p
                  className={`mt-0.5 font-semibold ${
                    data.storage?.engine === 'MongoDB Atlas' ? 'text-[#0F9D78]' : 'text-[#D69E36]'
                  }`}
                  title={data.storage?.error || data.storage?.message}
                >
                  {data.storage?.engine || 'Database'} ({data.storage?.dbName || 'internradar'})
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Hourly Cron Status</p>
                <p className={`mt-0.5 font-semibold ${data.scheduler.isRunning ? 'text-[#0F9D78]' : 'text-[#D69E36]'}`}>
                  {data.scheduler.isScanning
                    ? 'Scan In Progress'
                    : data.scheduler.isRunning
                      ? 'Active (Background)'
                      : 'Paused'}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Session Runs & Duration</p>
                <p className="mt-0.5 font-mono text-[#14243A] tabular-nums">
                  {data.scheduler.totalRuns} {data.scheduler.totalRuns === 1 ? 'run' : 'runs'}
                  {data.scheduler.lastScanDurationMs !== null ? ` · ${(data.scheduler.lastScanDurationMs / 1000).toFixed(1)}s` : ''}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Latest Scan Outcome</p>
                <p className="mt-0.5 font-mono text-[#14243A] tabular-nums">
                  {data.scheduler.lastScanSummary
                    ? `${data.scheduler.lastScanSummary.operational}/${data.scheduler.lastScanSummary.scanned} ok · +${data.scheduler.lastScanSummary.discovered} new · ${data.scheduler.lastScanSummary.closed} closed`
                    : data.scheduler.lastScanError || 'Awaiting next scheduled run'}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Supported Feed Adapters</p>
                <p
                  className="mt-0.5 text-[#14243A] truncate"
                  title={data.scheduler.supportedAdapters?.map((a) => `${a.platform} (${a.kind})`).join(', ')}
                >
                  {data.scheduler.supportedAdapters?.map((a) => a.platform).join(' · ') ||
                    'Greenhouse · Lever · Ashby · SmartRecruiters · Arbeitnow · RSS'}
                </p>
              </div>
            </div>
          </section>

          {/* 6 Main Transparency Metrics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-[#64748B]">1. Integrated Companies</p>
              <p className="mt-1 text-2xl font-bold text-[#14243A] tabular-nums">
                {data.metrics.integratedCompanies}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-[#64748B]">2. Supported Job Sources</p>
              <p className="mt-1 text-2xl font-bold text-[#14243A] tabular-nums">
                {data.metrics.supportedJobSources}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-[#64748B]">3. Last Successful Collection Time</p>
              <p className="mt-1 text-sm font-mono font-semibold text-[#14243A] tabular-nums">
                {formatDateTime(data.metrics.lastSuccessfulCollectionAt)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-[#64748B]">4. Sources Temporarily Unavailable</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  data.metrics.sourcesTemporarilyUnavailable > 0 ? 'text-[#D69E36]' : 'text-[#0F9D78]'
                }`}
              >
                {data.metrics.sourcesTemporarilyUnavailable}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-[#64748B]">5. Currently Verified Open Internships</p>
              <p className="mt-1 text-2xl font-bold text-[#0F9D78] tabular-nums">
                {data.metrics.verifiedOpenInternships}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-[#64748B]">6. Next Scheduled Collection Time</p>
              <p className="mt-1 text-sm font-mono font-semibold text-[#4F46E5] tabular-nums">
                {formatDateTime(data.metrics.nextScheduledCollectionAt)}
              </p>
            </div>
          </section>

          {/* Individual Source Monitoring Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-[#14243A]">Individual Source Monitoring</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F4F6FA] text-[#64748B]">
                    <th className="py-3 px-4 font-semibold">Company / Source</th>
                    <th className="py-3 px-4 font-semibold">Sector</th>
                    <th className="py-3 px-4 font-semibold">Source Type</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Last Successful Check</th>
                    <th className="py-3 px-4 font-semibold">Latest Collection Result</th>
                    <th className="py-3 px-4 font-semibold text-right">Verified Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.sources.map((src) => (
                    <tr key={src.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-[#14243A]">
                        <a
                          href={src.careersUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[#4F46E5]"
                        >
                          <span>{src.name}</span>
                          <ExternalLink className="w-3 h-3 text-[#64748B]" />
                        </a>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#4F46E5]">{src.sector}</td>
                      <td className="py-3 px-4 text-[#64748B]">{src.sourcePlatform}</td>
                      <td className="py-3 px-4">
                        <StatusText status={src.integrationStatus} />
                      </td>
                      <td className="py-3 px-4 font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                        {formatDateTime(src.lastSuccessAt)}
                      </td>
                      <td className="py-3 px-4 text-[#14243A] max-w-xs truncate" title={src.latestResult}>
                        {src.latestResult}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#14243A] tabular-nums">
                        {src.verifiedOpenCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent Collection Logs */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-[#14243A]">Recent Hourly Collection Audit Log</h2>
            </div>
            {data.recentLogs.length === 0 ? (
              <p className="p-6 text-xs text-[#64748B]">No collection runs recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F4F6FA] text-[#64748B]">
                      <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                      <th className="py-2.5 px-4 font-semibold">Company</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">New</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Updated</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Closed</th>
                      <th className="py-2.5 px-4 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono text-[#64748B] tabular-nums whitespace-nowrap">
                          {formatDateTime(log.finishedAt)}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-[#14243A]">{log.companyName}</td>
                        <td className="py-2.5 px-4">
                          <StatusText status={log.status} />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{log.discoveredCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{log.updatedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{log.closedCount}</td>
                        <td className="py-2.5 px-4 text-[#64748B] truncate max-w-xs">
                          {log.errorMessage || 'Verified successfully'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
