import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, Bell, Briefcase, CheckCircle2, Flame, Sparkles, TrendingUp } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { StatusText } from '../components/StatusText.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, formatDateShort, formatDateTime } from '../lib/api.ts';

interface DashboardData {
  student: {
    name: string;
    isDemo: boolean;
    profileCompletion: number;
    skillsCount: number;
    projectsCount: number;
  };
  overview: {
    newlyDiscoveredCount: number;
    savedCount: number;
    activeApplicationsCount: number;
    totalApplicationsCount: number;
  };
  internships: {
    recommended: Array<any>;
    newlyDiscovered: Array<any>;
    closingSoon: Array<any>;
  };
  careerProgress: {
    streakDays: number;
    weeklyMinutes: number;
    skillsPractised: string[];
    completedGoals: number;
    totalGoals: number;
    applicationMilestones: number;
  };
  skillGaps: Array<{ skill: string; count: number }>;
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    relatedInternshipId: string | null;
    isRead: boolean;
    createdAt: string;
  }>;
}

const ENCOURAGEMENT_MESSAGES = [
  "You're making progress. Every skill you develop brings you closer to your career goals.",
  'Small, consistent steps beat last-minute cramming. One focused session today builds lasting momentum.',
  'Rejection is normal in hiring — each project and application sharpens your craft for the right team.',
];

export function DashboardPage() {
  const { includeDemoData } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInNotice, setCheckInNotice] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const d = await apiFetch<DashboardData>(`/api/dashboard?includeDemo=${includeDemoData}`);
      setData(d);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [includeDemoData]);

  useEffect(() => {
    setLoading(true);
    loadDashboard();
  }, [loadDashboard]);

  const handleQuickCheckIn = async (label: string, mins: number) => {
    setCheckInBusy(true);
    setCheckInNotice('');
    try {
      await apiFetch('/api/growth/activity', {
        method: 'POST',
        body: JSON.stringify({
          activityType: 'skill_practice',
          description: label,
          skillPractised: 'Focused Prep',
          minutesSpent: mins,
        }),
      });
      setCheckInNotice(`Logged "${label}" (+${mins} mins). Your weekly momentum and streak have been updated.`);
      await loadDashboard();
    } finally {
      setCheckInBusy(false);
    }
  };

  const dailyQuote = ENCOURAGEMENT_MESSAGES[new Date().getDay() % ENCOURAGEMENT_MESSAGES.length];

  return (
    <AppShell
      title="Student Dashboard"
      subtitle="Personalized internship overview, daily motivation, skill gaps, and preparation progress"
      actions={
        <Link
          to="/discover"
          className="px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] transition-colors whitespace-nowrap shrink-0"
        >
          Explore Internships
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : error || !data ? (
        <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
          {error || 'Dashboard data unavailable.'}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Welcome & Profile Readiness */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                <span>Career Readiness Workspace</span>
                {data.student.isDemo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#D69E36] font-medium">DEMO Student Profile</span>
                  </>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#14243A]">
                Welcome back, {data.student.name}
              </h2>
              <p className="text-sm text-[#64748B] mt-1">
                {data.student.skillsCount} skills and {data.student.projectsCount} portfolio projects indexed for AI matching.
              </p>
            </div>
            <div className="w-full md:w-72 shrink-0">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-[#14243A]">Profile Completion</span>
                <span className="font-mono font-semibold text-[#4F46E5] tabular-nums">
                  {data.student.profileCompletion}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4F46E5] rounded-full transition-all duration-300"
                  style={{ width: `${data.student.profileCompletion}%` }}
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Link to="/settings" className="text-xs font-medium text-[#4F46E5] hover:underline">
                  Update skills & preferences
                </Link>
              </div>
            </div>
          </section>

          {/* Beginner Quick-Start Guide (Powered by real user milestones) */}
          {(() => {
            const steps = [
              {
                label: '1. Add your skills',
                hint: 'Helps AI match internships to you',
                done: data.student.skillsCount > 0,
                to: '/settings',
              },
              {
                label: '2. Explore live roles',
                hint: 'Browse MNC, Private, Gov & Startups',
                done: data.overview.totalApplicationsCount > 0,
                to: '/discover',
              },
              {
                label: '3. Check a skill match',
                hint: 'See what skills to practice next',
                done: data.careerProgress.skillsPractised.length > 0 || data.overview.activeApplicationsCount > 0,
                to: '/skills',
              },
              {
                label: '4. Build your streak',
                hint: 'Log 15+ mins in Motivation',
                done: data.careerProgress.streakDays > 0 || data.careerProgress.weeklyMinutes > 0,
                to: '/growth',
              },
            ];
            const completedCount = steps.filter((s) => s.done).length;
            return (
              <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#14243A]">Getting Started Checklist</h3>
                    <p className="text-xs text-[#64748B]">New here? Follow these 4 simple steps to get internship-ready.</p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#4F46E5] tabular-nums">
                    {completedCount}/4 completed
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {steps.map((step) => (
                    <Link
                      key={step.label}
                      to={step.to}
                      className={`p-3.5 rounded-lg border transition-colors flex items-start gap-2.5 ${
                        step.done
                          ? 'bg-emerald-50/40 border-[#0F9D78]/25 hover:border-[#0F9D78]/50'
                          : 'bg-[#F4F6FA] border-slate-200 hover:border-[#4F46E5]/50'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          step.done ? 'text-[#0F9D78]' : 'text-slate-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#14243A] truncate">{step.label}</p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">{step.hint}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Motivation & Momentum Quick Check-In */}
          <section className="bg-[#14243A] border border-[#14243A] text-white rounded-xl p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <p className="text-xs font-medium text-slate-300">Motivation & Daily Momentum</p>
                <p className="text-base sm:text-lg font-semibold leading-snug">{dailyQuote}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={checkInBusy}
                  onClick={() => handleQuickCheckIn('Completed 25-minute focused study block', 25)}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  + Log 25m Study
                </button>
                <button
                  type="button"
                  disabled={checkInBusy}
                  onClick={() => handleQuickCheckIn('Made progress on portfolio project', 40)}
                  className="px-3.5 py-2 text-xs font-semibold bg-white/10 text-white border border-white/20 rounded-lg hover:bg-white/20 disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  + Log Project Win
                </button>
                <Link
                  to="/growth"
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-200 hover:text-white hover:underline whitespace-nowrap"
                >
                  Open Motivation
                </Link>
              </div>
            </div>

            {checkInNotice && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{checkInNotice}</span>
              </div>
            )}
          </section>

          {/* 4 Actual Data Overview Metrics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                <span>Verified Open Internships</span>
                <Briefcase className="w-4 h-4 text-[#4F46E5]" />
              </div>
              <p className="text-2xl font-bold text-[#14243A] tabular-nums">
                {data.overview.newlyDiscoveredCount}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Across MNC, Private, Gov & Startup
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                <span>Applications in Progress</span>
                <TrendingUp className="w-4 h-4 text-[#0F9D78]" />
              </div>
              <p className="text-2xl font-bold text-[#14243A] tabular-nums">
                {data.overview.activeApplicationsCount}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                {data.overview.savedCount} saved · {data.overview.totalApplicationsCount} total tracked
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                <span>Learning Streak</span>
                <Flame className="w-4 h-4 text-[#D69E36]" />
              </div>
              <p className="text-2xl font-bold text-[#14243A] tabular-nums">
                {data.careerProgress.streakDays} {data.careerProgress.streakDays === 1 ? 'day' : 'days'}
              </p>
              <p className="text-xs text-[#64748B] mt-1 tabular-nums">
                {data.careerProgress.weeklyMinutes} mins logged this week
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-[#64748B] mb-2">
                <span>Completed Career Goals</span>
                <Award className="w-4 h-4 text-[#4F46E5]" />
              </div>
              <p className="text-2xl font-bold text-[#14243A] tabular-nums">
                {data.careerProgress.completedGoals} / {data.careerProgress.totalGoals}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                {data.careerProgress.skillsPractised.length} skills practised recently
              </p>
            </div>
          </section>

          {/* Main 2-Column Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recommended Internships */}
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-[#14243A]">Recommended Internships</h3>
                  <p className="text-xs text-[#64748B]">
                    Ranked by skill overlap with your profile (estimates only)
                  </p>
                </div>
                <Link to="/discover" className="text-xs font-semibold text-[#4F46E5] hover:underline">
                  View all
                </Link>
              </div>

              {data.internships.recommended.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#64748B] border-t border-slate-100">
                  No active internships are currently verified in this view. Check{' '}
                  <Link to="/transparency" className="text-[#4F46E5] underline">
                    Source Transparency
                  </Link>{' '}
                  or click Sync Live Boards Now in Discovery.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.internships.recommended.map((item) => (
                    <Link
                      key={item.id}
                      to={`/internships/${item.id}`}
                      className="block py-4 hover:bg-slate-50/70 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                            <span className="font-medium text-[#14243A]">{item.companyName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{item.location}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.workArrangement}</span>
                          </div>
                          <p className="text-sm font-semibold text-[#14243A] truncate">{item.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-semibold text-[#4F46E5] tabular-nums">
                            ~{item.estimatedSkillOverlap}% overlap
                          </span>
                          <div className="mt-1">
                            <StatusText status={item.verificationStatus} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Skill Gaps & AI Preparation */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                  <h3 className="text-base font-semibold text-[#14243A]">Skills to Strengthen</h3>
                </div>
                <p className="text-xs text-[#64748B] mb-4">
                  High-demand requirements across active listings not yet listed in your profile
                </p>

                {data.skillGaps.length === 0 ? (
                  <p className="text-sm text-[#64748B] py-4 border-t border-slate-100">
                    Your current skill list covers the top extracted requirements in the active verified feed. Run a full AI Skill Match on any role for deep project guidance.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {data.skillGaps.map((gap) => (
                      <div key={gap.skill} className="py-3 flex items-center justify-between text-sm">
                        <span className="font-medium text-[#14243A]">{gap.skill}</span>
                        <span className="text-xs text-[#64748B] tabular-nums">
                          Requested in {gap.count} {gap.count === 1 ? 'listing' : 'listings'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <Link
                  to="/skills"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] hover:underline"
                >
                  <span>Open AI Skill Matcher</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link to="/growth" className="text-xs font-medium text-[#64748B] hover:text-[#14243A]">
                  Set Learning Goals
                </Link>
              </div>
            </section>

            {/* Closing Soon & Newly Discovered */}
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[#14243A]">Closing Soon & Newly Discovered</h3>
                <Link to="/discover?sort=closing_soon" className="text-xs font-semibold text-[#4F46E5] hover:underline">
                  Filter deadlines
                </Link>
              </div>
              {data.internships.closingSoon.length === 0 && data.internships.newlyDiscovered.length === 0 ? (
                <p className="text-sm text-[#64748B] py-4 border-t border-slate-100">
                  No verified opportunities currently carry explicit closing dates.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {(data.internships.closingSoon.length > 0
                    ? data.internships.closingSoon
                    : data.internships.newlyDiscovered
                  ).map((item) => (
                    <Link
                      key={item.id}
                      to={`/internships/${item.id}`}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70 -mx-2 px-2 rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#14243A] truncate">{item.title}</p>
                        <p className="text-xs text-[#64748B]">
                          {item.companyName} · {item.stipendText}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-[#D69E36] tabular-nums shrink-0">
                        {item.deadlineAt ? `Due ${formatDateShort(item.deadlineAt)}` : `Added ${formatDateShort(item.firstDiscoveredAt)}`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Notifications */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#4F46E5]" />
                  <h3 className="text-base font-semibold text-[#14243A]">Recent Alerts</h3>
                </div>
                <Link to="/notifications" className="text-xs font-semibold text-[#4F46E5] hover:underline">
                  All alerts
                </Link>
              </div>
              {data.notifications.length === 0 ? (
                <p className="text-sm text-[#64748B] py-4 border-t border-slate-100">
                  No alerts yet. You will be notified when hourly verification discovers matching roles.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {data.notifications.map((n) => (
                    <div key={n.id} className="py-3">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-[#14243A] truncate">{n.title}</span>
                        <span className="text-[11px] text-[#64748B] tabular-nums shrink-0">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
