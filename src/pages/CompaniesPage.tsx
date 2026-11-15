import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { StatusText } from '../components/StatusText.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatDateTime } from '../lib/api.ts';

const SECTORS = ['All', 'MNC', 'Private', 'Government', 'Startup'] as const;

interface CompanyItem {
  id: string;
  name: string;
  slug: string;
  sector: string;
  websiteUrl: string;
  careersUrl: string;
  sourcePlatform: string;
  integrationStatus: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastResultSummary: string;
  verifiedOpenCount: number;
  isDemo: boolean;
}

export function CompaniesPage() {
  const { includeDemoData } = useAuth();
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState<string>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch<{ companies: CompanyItem[] }>(
      `/api/companies?includeDemo=${includeDemoData}&sector=${encodeURIComponent(sector)}`
    )
      .then((d) => setCompanies(d.companies || []))
      .finally(() => setLoading(false));
  }, [includeDemoData, sector]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.sourcePlatform.toLowerCase().includes(q);
  });

  return (
    <AppShell
      title="Company Directory"
      subtitle="Integrated MNC, Private, Government, and Startup employers monitored by InternRadar"
    >
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3 text-xs text-[#64748B]">
          <ShieldCheck className="w-4 h-4 text-[#0F9D78] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-[#14243A]">Honest Source Coverage:</strong> Every employer below is connected to a real public ATS or feed adapter (Greenhouse, Lever, Ashby, SmartRecruiters, Arbeitnow, or Official RSS). Open internship counts are queried directly from verified live scans—we never display assumed integrations or estimated vacancies.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {SECTORS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setSector(sec)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  sector === sec ? 'bg-[#14243A] text-white' : 'bg-[#F4F6FA] text-[#64748B] hover:text-[#14243A]'
                }`}
              >
                {sec === 'All' ? 'All Sectors' : sec}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter company or source..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
              />
            </div>
            <span className="text-xs text-[#64748B] tabular-nums whitespace-nowrap">
              {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <article key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#14243A] truncate">{c.name}</h2>
                      {c.isDemo && <span className="text-xs font-semibold text-[#D69E36]">DEMO</span>}
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      <span className="font-semibold text-[#4F46E5]">{c.sector}</span> · Integrated Source: {c.sourcePlatform}
                    </p>
                  </div>
                  <StatusText status={c.integrationStatus} />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <p className="text-[#64748B]">Verified Open</p>
                    <p className="mt-0.5 text-lg font-bold text-[#14243A] tabular-nums">{c.verifiedOpenCount}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Last Checked</p>
                    <p className="mt-0.5 font-mono text-[#14243A] tabular-nums text-[11px]">
                      {formatDateTime(c.lastCheckedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Last Successful</p>
                    <p className="mt-0.5 font-mono text-[#0F9D78] tabular-nums text-[11px]">
                      {formatDateTime(c.lastSuccessAt)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#64748B] leading-relaxed">{c.lastResultSummary || 'Awaiting collection summary'}</p>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
                  <div className="flex items-center gap-4">
                    <a
                      href={c.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#14243A] hover:text-[#4F46E5]"
                    >
                      <span>Official Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={c.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#4F46E5] hover:underline"
                    >
                      <span>Careers Page</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {c.verifiedOpenCount > 0 && (
                    <Link
                      to={`/discover?company=${encodeURIComponent(c.name)}`}
                      className="inline-flex items-center gap-1 font-semibold text-[#0F9D78] hover:underline whitespace-nowrap"
                    >
                      <span>View {c.verifiedOpenCount} {c.verifiedOpenCount === 1 ? 'role' : 'roles'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
