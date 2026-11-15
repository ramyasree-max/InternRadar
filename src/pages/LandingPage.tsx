import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ExternalLink, Radar, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatDateShort, formatDateTime } from '../lib/api.ts';

interface TransparencySummary {
  metrics: {
    integratedCompanies: number;
    supportedJobSources: number;
    lastSuccessfulCollectionAt: string | null;
    sourcesTemporarilyUnavailable: number;
    verifiedOpenInternships: number;
    nextScheduledCollectionAt: string;
  };
}

interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  category: string;
  publishedAt: string;
  originalUrl: string;
  aiSummary: string;
}

export function LandingPage() {
  const { user } = useAuth();
  const [transparency, setTransparency] = useState<TransparencySummary | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    apiFetch<TransparencySummary>('/api/transparency')
      .then(setTransparency)
      .catch(() => {});
    apiFetch<{ articles: NewsItem[] }>('/api/news?limit=3')
      .then((d) => setNews(d.articles || []))
      .catch(() => {});
  }, []);

  const metrics = transparency?.metrics;

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#14243A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#14243A] whitespace-nowrap shrink-0"
          >
            <Radar className="w-5 h-5 text-[#4F46E5]" />
            <span>InternRadar</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#64748B]">
            <Link to="/discover" className="hover:text-[#14243A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Discovery
            </Link>
            <Link to="/skills" className="hover:text-[#14243A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Skill Matcher
            </Link>
            <Link to="/news" className="hover:text-[#14243A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Industry News
            </Link>
            <Link to="/transparency" className="hover:text-[#14243A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0">
              Source Transparency
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to={user ? '/dashboard' : '/auth'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] transition-colors whitespace-nowrap shrink-0"
            >
              <span>{user ? 'Open Dashboard' : 'Get Started'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-[#F4F6FA] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-[#4F46E5] mb-3">
                Discover Opportunities. Build Skills. Shape Your Future.
              </p>
              <h1
                className="font-bold tracking-tight text-[#14243A] text-balance leading-[1.12] mb-5"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
              >
                Verified internship discovery and AI skill readiness for students.
              </h1>
              <p className="text-base text-[#64748B] leading-relaxed max-w-xl mb-8">
                InternRadar tracks real-time internship openings across MNCs, private tech companies, government research agencies, and startups every hour, evaluates skill readiness with Gemini AI, and keeps students motivated with goal tracking and streaks.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to={user ? '/dashboard' : '/auth'}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{user ? 'Go to Dashboard' : 'Get Started (Any Email)'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/discover"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#14243A] bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Explore Live Internships</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 bg-[#14243A]">
                <img
                  src="/src/assets/images/hero_career_workspace_1794642476785.jpg"
                  alt="University engineering students collaborating in a sunlit studio"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Real-time Source Transparency KPI Strip (Strictly from backend records) */}
          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs font-medium text-[#64748B]">Integrated Employers</p>
              <p className="mt-1 text-2xl font-bold text-[#14243A] tabular-nums">
                {metrics ? metrics.integratedCompanies : '—'}
              </p>
              <p className="mt-0.5 text-xs text-[#64748B]">MNC · Private · Gov · Startup</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#64748B]">Verified Open Internships</p>
              <p className="mt-1 text-2xl font-bold text-[#0F9D78] tabular-nums">
                {metrics ? metrics.verifiedOpenInternships : '—'}
              </p>
              <p className="mt-0.5 text-xs text-[#64748B]">Confirmed open in real time</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#64748B]">Supported Job Sources</p>
              <p className="mt-1 text-2xl font-bold text-[#14243A] tabular-nums">
                {metrics ? metrics.supportedJobSources : '—'}
              </p>
              <p className="mt-0.5 text-xs text-[#64748B]">Greenhouse · Lever · Ashby · SmartRecruiters · Arbeitnow</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[#64748B]">Last Verified Collection</p>
              <p className="mt-1 text-sm font-semibold text-[#14243A] font-mono tabular-nums">
                {metrics?.lastSuccessfulCollectionAt ? formatDateTime(metrics.lastSuccessfulCollectionAt) : 'Scheduled'}
              </p>
              <p className="mt-0.5 text-xs text-[#64748B]">Automated 60-minute cadence</p>
            </div>
          </div>
        </div>
      </section>

      {/* How InternRadar Works */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-b border-slate-200">
        <div className="max-w-2xl mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14243A] text-balance">
            Built for authentic sourcing, skill readiness, and student motivation
          </h2>
          <p className="mt-3 text-base text-[#64748B]">
            Every listing is traced to its official recruitment source across MNC, private, government, and startup sectors, evaluated against your skills, and paired with positive daily momentum tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-[#14243A] mb-2">
              01. Real-Time Multi-Sector Tracking
            </h3>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Backend adapters poll official Greenhouse, Lever, Ashby, SmartRecruiters, and Arbeitnow feeds every 60 minutes across MNCs, private companies, government labs, and startups.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-[#14243A] mb-2">
              02. AI-Powered Skill Matching
            </h3>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Gemini analyses your coursework, languages, and projects against genuine listing descriptions to surface matching skills, missing requirements, and portfolio project ideas.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <h3 className="text-base font-semibold text-[#14243A] mb-2">
              03. Motivation
            </h3>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Stay encouraged without burnout using 1-click daily practice logs, progress charts, daily and weekly career goals, skill streaks, and a clear 7-stage application tracker.
            </p>
          </div>
        </div>
      </section>

      {/* Authentic Sourcing & Source Transparency + Career Development Asymmetric Split */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-b border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between bg-[#14243A] border border-[#14243A] text-white rounded-xl p-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#0F9D78] mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Source Transparency Commitment</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-4 text-balance">
                No fabricated listings. Honest coverage metrics.
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                InternRadar does not invent missing stipends, deadlines, or fictional companies. When a field is omitted by the employer, we display "Not specified." When a company board becomes temporarily unreachable, we report its status transparently rather than serving stale postings.
              </p>
              <ul className="space-y-3 text-sm text-slate-200 mb-8">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0F9D78] mt-0.5 shrink-0" />
                  <span>Direct links to original company listings and application forms</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0F9D78] mt-0.5 shrink-0" />
                  <span>Public per-source verification timestamps and collection logs</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0F9D78] mt-0.5 shrink-0" />
                  <span>Match scores explicitly framed as preparation estimates, never guarantees</span>
                </li>
              </ul>
            </div>
            <div>
              <Link
                to="/transparency"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline underline-offset-4"
              >
                <span>Inspect Live Source Transparency</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-between bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="h-64 overflow-hidden bg-slate-100">
              <img
                src="/src/assets/images/study_desk_career_1794642477351.jpg"
                alt="Minimalist student developer desk with laptop and notebook"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#14243A] mb-3">
                  Constructive career development
                </h2>
                <p className="text-sm text-[#64748B] leading-relaxed mb-6">
                  Every skill you build matters. Log daily practice sessions, track portfolio project milestones, and review weekly progress summaries without pressure or streak-shaming.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] transition-colors"
                >
                  <span>Start Your Profile</span>
                </Link>
                <Link
                  to="/companies"
                  className="text-sm font-medium text-[#14243A] hover:underline underline-offset-4"
                >
                  Browse Integrated Companies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry News Preview */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14243A]">
              Industry News Centre
            </h2>
            <p className="mt-2 text-sm text-[#64748B]">
              Verified technology articles paired with concise AI summaries explaining why they matter to students.
            </p>
          </div>
          <Link
            to="/news"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4F46E5] hover:underline underline-offset-4"
          >
            <span>View All Articles</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {news.length === 0 ? (
          <div className="border border-slate-200 rounded-xl p-8 bg-[#F4F6FA] text-sm text-[#64748B]">
            Industry articles are collected on schedule from verified developer publications. Visit the Industry News Centre to view or trigger a refresh.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {news.map((item) => (
              <article key={item.id} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#64748B] mb-2.5">
                    <span className="truncate">{item.publisher}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums whitespace-nowrap">{formatDateShort(item.publishedAt)}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[#14243A] leading-snug mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#64748B] leading-relaxed mb-4">
                    <span className="font-medium text-[#14243A]">AI Summary: </span>
                    {item.aiSummary}
                  </p>
                </div>
                <a
                  href={item.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] hover:underline underline-offset-4"
                >
                  <span>Read Original Article</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Quiet Footer */}
      <footer className="bg-[#14243A] text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-white font-semibold mb-3">
              <Radar className="w-5 h-5 text-[#4F46E5]" />
              <span>InternRadar</span>
            </div>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Discover Opportunities. Build Skills. Shape Your Future. Authentic internship monitoring and student career growth workspace.
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Contact: support@internradar.app
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white mb-3">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/discover" className="hover:text-white transition-colors">Internship Discovery</Link></li>
              <li><Link to="/skills" className="hover:text-white transition-colors">AI Skill Matcher</Link></li>
              <li><Link to="/companies" className="hover:text-white transition-colors">Company Directory</Link></li>
              <li><Link to="/news" className="hover:text-white transition-colors">Industry News</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white mb-3">Trust & Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/transparency" className="hover:text-white transition-colors">Source Transparency</Link></li>
              <li><Link to="/auth" className="hover:text-white transition-colors">Student Privacy Policy</Link></li>
              <li><Link to="/transparency" className="hover:text-white transition-colors">Verification Methodology</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 px-6 text-xs text-slate-400 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>InternRadar — Verified Career Discovery Platform</span>
          <span>InternRadar covers integrated sources only and links directly to official employer portals.</span>
        </div>
      </footer>
    </div>
  );
}
