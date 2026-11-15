import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, ExternalLink, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { StatusText } from '../components/StatusText.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatDateShort, formatDateTime, type Internship } from '../lib/api.ts';

const SECTORS = ['All', 'MNC', 'Private', 'Government', 'Startup'] as const;

const CATEGORIES = [
  'All',
  'Software Engineering',
  'Frontend Engineering',
  'AI & Machine Learning',
  'Cloud & Infrastructure',
  'Data Engineering',
  'Cybersecurity',
  'Product & Design',
];

export function DiscoverPage() {
  const { user, includeDemoData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [internships, setInternships] = useState<Internship[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [sectorCounts, setSectorCounts] = useState<Record<string, number>>({});
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [nextScanAt, setNextScanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError] = useState('');

  const [sector, setSector] = useState<string>(searchParams.get('sector') || 'All');
  const [companyFilter, setCompanyFilter] = useState<string>(searchParams.get('company') || '');
  const [q, setQ] = useState('');
  const [skill, setSkill] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('All');
  const [arrangement, setArrangement] = useState('All');
  const [paidType, setPaidType] = useState('All');
  const [stipendMin, setStipendMin] = useState('');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newly_discovered');
  const [status, setStatus] = useState('Verified Open');
  const [showFilters, setShowFilters] = useState(false);

  const loadInternships = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q,
        company: companyFilter,
        skill,
        location,
        category,
        sector,
        arrangement,
        paidType,
        stipendMin,
        sort,
        status,
        includeDemo: String(includeDemoData),
      });
      const data = await apiFetch<{
        internships: Internship[];
        total?: number;
        sectorCounts?: Record<string, number>;
        scheduler?: { lastScanCompletedAt: string | null; nextScheduledCollectionAt: string };
      }>(`/api/internships?${params.toString()}`);
      setInternships(data.internships || []);
      setTotalMatches(typeof data.total === 'number' ? data.total : (data.internships || []).length);
      if (data.sectorCounts) setSectorCounts(data.sectorCounts);
      if (data.scheduler) {
        setLastScanAt(data.scheduler.lastScanCompletedAt);
        setNextScanAt(data.scheduler.nextScheduledCollectionAt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch internships');
    } finally {
      setLoading(false);
    }
  }, [q, companyFilter, skill, location, category, sector, arrangement, paidType, stipendMin, sort, status, includeDemoData]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadInternships();
    }, 180);
    return () => clearTimeout(t);
  }, [loadInternships]);

  const handleLiveSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await apiFetch<{
        status: string;
        result?: { scanned: number; operational: number; discovered: number };
      }>('/api/internships/refresh', { method: 'POST' });
      if (res.status === 'already_running') {
        setSyncMessage('Live verification scan is already running in the background.');
      } else if (res.result) {
        setSyncMessage(
          `Synced ${res.result.operational}/${res.result.scanned} company sources (${res.result.discovered} newly discovered).`
        );
      }
      await loadInternships();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync skipped');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async (item: Internship) => {
    if (!user) return;
    try {
      await apiFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          internshipId: item.id,
          companyName: item.companyName,
          internshipTitle: item.title,
          status: 'Saved',
        }),
      });
      setInternships((prev) =>
        prev.map((j) => (j.id === item.id ? { ...j, isSaved: true, applicationStatus: j.applicationStatus || 'Saved' } : j))
      );
    } catch {
      // ignore
    }
  };

  const clearAllFilters = () => {
    setQ('');
    setCompanyFilter('');
    setSkill('');
    setLocation('');
    setSector('All');
    setCategory('All');
    setArrangement('All');
    setPaidType('All');
    setStipendMin('');
    setStatus('Verified Open');
    if (searchParams.has('company') || searchParams.has('sector')) {
      setSearchParams({});
    }
  };

  const totalOpenAllSectors = Object.values(sectorCounts).reduce((a, b) => a + b, 0);

  return (
    <AppShell
      title="Real-Time Internship Discovery"
      subtitle="Live verified student roles across MNC, Private, Government, and Startup employers"
      actions={
        <button
          type="button"
          onClick={handleLiveSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing Live Boards...' : 'Sync Live Boards Now'}</span>
        </button>
      }
    >
      <div className="space-y-6">
        {syncMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-medium text-[#0F9D78]">
            {syncMessage}
          </div>
        )}

        {/* Sector Filter Tabs (Wrapped cleanly without horizontal scrollbars) */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {SECTORS.map((sec) => {
              const count = sec === 'All' ? totalOpenAllSectors : sectorCounts[sec] || 0;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setSector(sec)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    sector === sec
                      ? 'bg-[#14243A] text-white'
                      : 'bg-[#F4F6FA] text-[#64748B] hover:text-[#14243A]'
                  }`}
                >
                  <span>{sec === 'All' ? 'All Sectors' : sec}</span>
                  <span className="ml-1.5 font-mono opacity-80 tabular-nums">({count})</span>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-[#64748B] shrink-0">
            <span>Last live sync: </span>
            <span className="font-mono text-[#14243A] tabular-nums">
              {lastScanAt ? formatDateTime(lastScanAt) : 'Scheduled'}
            </span>
          </div>
        </section>

        {/* Search & Expandable Filter Panel */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, company, or keyword..."
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              />
            </div>
            <div className="md:col-span-3">
              <input
                type="text"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="Skill (e.g. React, Python)"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className={`w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold border rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  showFilters
                    ? 'bg-[#14243A] text-white border-[#14243A]'
                    : 'text-[#14243A] bg-[#F4F6FA] border-slate-300 hover:bg-slate-200/60'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showFilters ? 'Hide Filters' : 'More Filters'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Click <strong className="text-[#14243A]">Details & Skill Match</strong> on any role to compare your skills before applying.
              </span>
              {companyFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setCompanyFilter('');
                    if (searchParams.has('company')) setSearchParams({});
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-[#4F46E5] font-semibold hover:bg-indigo-100 cursor-pointer"
                >
                  <span>Company: {companyFilter} ×</span>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setArrangement(arrangement === 'Remote' ? 'All' : 'Remote')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  arrangement === 'Remote'
                    ? 'bg-[#4F46E5] text-white'
                    : 'bg-[#F4F6FA] text-[#14243A] hover:bg-slate-200/70'
                }`}
              >
                Remote Only
              </button>
              <button
                type="button"
                onClick={() => setPaidType(paidType === 'Paid' ? 'All' : 'Paid')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  paidType === 'Paid'
                    ? 'bg-[#0F9D78] text-white'
                    : 'bg-[#F4F6FA] text-[#14243A] hover:bg-slate-200/70'
                }`}
              >
                Paid Only
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Work Arrangement</label>
                <select
                  value={arrangement}
                  onChange={(e) => setArrangement(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="All">All Arrangements</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Compensation</label>
                <select
                  value={paidType}
                  onChange={(e) => setPaidType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="All">Any</option>
                  <option value="Paid">Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Min Hourly Stipend ($)</label>
                <input
                  type="number"
                  min={0}
                  value={stipendMin}
                  onChange={(e) => setStipendMin(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Verification Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Verified Open">Verified Open Only</option>
                  <option value="all">All Recorded Statuses</option>
                  <option value="Source Temporarily Unavailable">Source Unavailable</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Sort By</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="newly_discovered">Newly Discovered</option>
                  <option value="recently_updated">Recently Updated</option>
                  <option value="closing_soon">Closing Soon</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Results Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
          <span className="tabular-nums">
            Showing <strong className="text-[#14243A]">{internships.length}</strong>
            {totalMatches > internships.length ? ` of ${totalMatches}` : ''}{' '}
            {sector !== 'All' ? `${sector} ` : ''}
            {status === 'Verified Open' ? 'verified open' : ''} opportunities
          </span>
          <span className="tabular-nums">
            24/7 hourly monitor · Next scheduled check {nextScanAt ? formatDateTime(nextScanAt) : 'top of hour'}
          </span>
        </div>

        {error && (
          <div className="bg-white border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : internships.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <h3 className="text-base font-semibold text-[#14243A]">
              No matching verified internships found
            </h3>
            <p className="text-sm text-[#64748B] max-w-lg mx-auto">
              InternRadar only displays genuine opportunities confirmed open from integrated company sources. Try clearing your filters or clicking "Sync Live Boards Now" above.
            </p>
            <div className="pt-2 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] cursor-pointer"
              >
                Reset Filters
              </button>
              <Link
                to="/transparency"
                className="px-4 py-2 text-xs font-semibold text-[#14243A] border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Check Source Status
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {internships.map((item) => (
              <article
                key={item.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors space-y-4"
              >
                {/* 1. Company Information & Verification Status Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-bold text-[#14243A]">{item.companyName}</span>
                      <span aria-hidden="true" className="text-[#64748B]">·</span>
                      <span className="font-semibold text-[#4F46E5]">{item.sector}</span>
                      {item.isDemo && (
                        <>
                          <span aria-hidden="true" className="text-[#64748B]">·</span>
                          <span className="font-semibold text-[#D69E36]">DEMO DATA</span>
                        </>
                      )}
                    </div>
                    {/* 2. Internship Title */}
                    <h2 className="text-base sm:text-lg font-semibold text-[#14243A] leading-snug">
                      <Link
                        to={`/internships/${item.id}`}
                        className="hover:text-[#4F46E5] transition-colors"
                      >
                        {item.title}
                      </Link>
                    </h2>
                  </div>

                  <StatusText status={item.verificationStatus} />
                </div>

                {/* 3. Separated Structured Attributes: Role Category, Arrangement, Location, Stipend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-100 text-xs">
                  <div>
                    <p className="text-[#64748B]">Category</p>
                    <p className="mt-0.5 font-medium text-[#14243A] truncate">{item.category || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Work Arrangement</p>
                    <p className="mt-0.5 font-medium text-[#14243A]">{item.workArrangement || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Location</p>
                    <p className="mt-0.5 font-medium text-[#14243A] truncate" title={item.location}>
                      {item.location || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Stipend</p>
                    <p className="mt-0.5 font-medium text-[#14243A]">{item.stipendText || 'Not specified'}</p>
                  </div>
                </div>

                {/* 4. Required Skills */}
                {item.requiredSkills.length > 0 && (
                  <div className="text-xs text-[#64748B]">
                    <span className="font-semibold text-[#14243A]">Required Skills: </span>
                    <span>{item.requiredSkills.join(' · ')}</span>
                  </div>
                )}

                {/* 5. Verification Attribution & Direct Official Action Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B]">
                    <span>
                      Source: <strong className="font-medium text-[#14243A]">{item.sourcePlatform}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Verified {formatDateTime(item.lastVerifiedAt)}</span>
                    {item.deadlineAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#D69E36] font-semibold tabular-nums">
                          Deadline {formatDateShort(item.deadlineAt)}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {user && (
                      <button
                        type="button"
                        onClick={() => handleSave(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                          item.isSaved
                            ? 'border-[#0F9D78]/40 bg-emerald-50 text-[#0F9D78]'
                            : 'border-slate-300 text-[#14243A] hover:bg-slate-50'
                        }`}
                      >
                        {item.isSaved ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span>{item.applicationStatus || 'Saved'}</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    )}
                    <Link
                      to={`/internships/${item.id}`}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] transition-colors whitespace-nowrap"
                    >
                      Details & Skill Match
                    </Link>
                    <a
                      href={item.originalApplicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#14243A] border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <span>Official Apply</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
