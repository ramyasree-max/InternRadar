import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Flame,
  FolderGit2,
  HeartHandshake,
  Plus,
  RotateCcw,
  Target,
  Trash2,
} from 'lucide-react';
import { formatDateShort } from '../lib/api.ts';

export interface GrowthGoal {
  id: string;
  title: string;
  category: string;
  targetCount: number;
  currentCount: number;
  period: string;
  completed: boolean;
  createdAt?: string;
}

export interface GrowthActivity {
  id: string;
  activityType: string;
  description: string;
  skillPractised: string;
  minutesSpent: number;
  createdAt: string;
}

export interface GrowthDashboardData {
  streakDays: number;
  longestStreakDays: number;
  activeDaysLast7: number;
  weeklyMinutes: number;
  completedGoalsCount: number;
  submittedAppsCount: number;
  dailyGoalStats: { total: number; completed: number };
  weeklyGoalStats: { total: number; completed: number };
  encouragement: string;
  dailyChart: Array<{ date: string; label: string; minutes: number }>;
  activityHeatmap: Array<{ date: string; label: string; dayNum: string; minutes: number; sessions: number }>;
  skillBreakdown: Array<{ skill: string; minutes: number; sessions: number }>;
  projectMilestones?: {
    portfolioProjectsCount: number;
    projects: Array<{ title: string; summary: string; stack: string }>;
    projectSessionsCount: number;
    projectMinutes: number;
  };
  applicationMilestones?: {
    totalTracked: number;
    saved: number;
    applied: number;
    assessmentOrInterview: number;
    shortlistedOrSelected: number;
    rejected: number;
  };
  profileSkills?: string[];
  goals: GrowthGoal[];
  activities: GrowthActivity[];
  badges: Array<{
    id: string;
    title: string;
    description: string;
    earned: boolean;
  }>;
}

interface GrowthDashboardProps {
  data: GrowthDashboardData;
  onAddGoal: (payload: { title: string; category: string; targetCount: number; period: string }) => Promise<void>;
  onIncrementGoal: (goal: GrowthGoal) => Promise<void>;
  onToggleGoalComplete: (goal: GrowthGoal) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onLogPractice: (payload: {
    activityType?: string;
    description: string;
    skillPractised: string;
    minutesSpent: number;
  }) => Promise<void>;
}

const GOAL_TEMPLATES = [
  { title: 'Practise 30 mins of a target skill', category: 'Technical Skill', targetCount: 1, period: 'daily' },
  { title: 'Solve 3 technical coding problems', category: 'Algorithms & CS', targetCount: 3, period: 'weekly' },
  { title: 'Ship README & tests on 1 project', category: 'Portfolio Project', targetCount: 1, period: 'weekly' },
  { title: 'Apply to 2 verified internships', category: 'Applications', targetCount: 2, period: 'weekly' },
];

const QUICK_PRACTICE_PRESETS = [
  {
    label: '+15m Coding Drill',
    activityType: 'skill_practice',
    description: 'Completed 15-minute focused problem-solving drill',
    skillPractised: 'Algorithms & CS',
    minutesSpent: 15,
  },
  {
    label: '+30m Stack Study',
    activityType: 'skill_practice',
    description: 'Studied documentation and built practice code',
    skillPractised: 'TypeScript',
    minutesSpent: 30,
  },
  {
    label: '+45m Project Build',
    activityType: 'project_milestone',
    description: 'Shipped new feature increment on portfolio project',
    skillPractised: 'Portfolio Project',
    minutesSpent: 45,
  },
];

export function GrowthDashboard({
  data,
  onAddGoal,
  onIncrementGoal,
  onToggleGoalComplete,
  onDeleteGoal,
  onLogPractice,
}: GrowthDashboardProps) {
  const [chartWindow, setChartWindow] = useState<'7d' | '14d'>('7d');
  const [goalFilter, setGoalFilter] = useState<'all' | 'daily' | 'weekly'>('all');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [submittingGoal, setSubmittingGoal] = useState(false);
  const [submittingPractice, setSubmittingPractice] = useState(false);

  // Create Goal form state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState('Technical Skill');
  const [goalTarget, setGoalTarget] = useState(3);
  const [goalPeriod, setGoalPeriod] = useState<'daily' | 'weekly'>('weekly');

  // Log Practice form state
  const [actType, setActType] = useState<'skill_practice' | 'project_milestone'>('skill_practice');
  const [actDesc, setActDesc] = useState('');
  const [actSkill, setActSkill] = useState('');
  const [actMinutes, setActMinutes] = useState(30);

  const heatmap = useMemo(() => {
    if (data.activityHeatmap && data.activityHeatmap.length > 0) {
      return data.activityHeatmap;
    }
    return data.dailyChart.map((d) => ({
      ...d,
      dayNum: d.date.slice(5),
      sessions: d.minutes > 0 ? 1 : 0,
    }));
  }, [data.activityHeatmap, data.dailyChart]);

  const chartSeries = useMemo(() => {
    return chartWindow === '7d' ? heatmap.slice(-7) : heatmap.slice(-14);
  }, [chartWindow, heatmap]);

  const maxChartMinutes = useMemo(() => {
    return Math.max(60, ...chartSeries.map((d) => d.minutes));
  }, [chartSeries]);

  const totalHeatmapMinutes = useMemo(() => {
    return heatmap.reduce((sum, d) => sum + d.minutes, 0);
  }, [heatmap]);

  const selectedDay = useMemo(() => {
    if (!selectedDayDate) return heatmap[heatmap.length - 1] || null;
    return heatmap.find((d) => d.date === selectedDayDate) || heatmap[heatmap.length - 1] || null;
  }, [heatmap, selectedDayDate]);

  const filteredGoals = useMemo(() => {
    if (goalFilter === 'daily') return data.goals.filter((g) => g.period === 'daily');
    if (goalFilter === 'weekly') return data.goals.filter((g) => g.period !== 'daily');
    return data.goals;
  }, [data.goals, goalFilter]);

  const overallGoalStats = useMemo(() => {
    const total = data.goals.length;
    const completed = data.goals.filter((g) => g.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [data.goals]);

  const topSkillMaxMinutes = useMemo(() => {
    if (!data.skillBreakdown || data.skillBreakdown.length === 0) return 60;
    return Math.max(30, ...data.skillBreakdown.map((s) => s.minutes));
  }, [data.skillBreakdown]);

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim() || submittingGoal) return;
    setSubmittingGoal(true);
    try {
      await onAddGoal({
        title: goalTitle.trim(),
        category: goalCategory,
        targetCount: goalTarget,
        period: goalPeriod,
      });
      setGoalTitle('');
    } finally {
      setSubmittingGoal(false);
    }
  };

  const handlePracticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actDesc.trim() || submittingPractice) return;
    setSubmittingPractice(true);
    try {
      await onLogPractice({
        activityType: actType,
        description: actDesc.trim(),
        skillPractised: actSkill.trim(),
        minutesSpent: actMinutes,
      });
      setActDesc('');
      setActSkill('');
    } finally {
      setSubmittingPractice(false);
    }
  };

  const handleQuickPreset = async (preset: (typeof QUICK_PRACTICE_PRESETS)[0]) => {
    if (submittingPractice) return;
    setSubmittingPractice(true);
    try {
      await onLogPractice({
        activityType: preset.activityType,
        description: preset.description,
        skillPractised: preset.skillPractised,
        minutesSpent: preset.minutesSpent,
      });
    } finally {
      setSubmittingPractice(false);
    }
  };

  // Ring geometry for SVG goal completion chart
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (overallGoalStats.pct / 100) * ringCircumference;

  // Daily pace reference line height percentage inside chart
  const targetPacePct = Math.min(100, Math.round((30 / maxChartMinutes) * 100));

  return (
    <div className="space-y-6">
      {/* 1. Constructive Encouragement & Active Streak Hero Banner (Solid Midnight Navy) */}
      <section className="bg-[#14243A] border border-[#14243A] text-white rounded-xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <HeartHandshake className="w-4 h-4 text-[#0F9D78] shrink-0" />
            <span>Motivation & Daily Momentum</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight" style={{ textWrap: 'balance' }}>
            {data.encouragement}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Start with 15 minutes a day. Missed days never erase your past progress — pick one small goal below whenever you are ready.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-7 shrink-0 border-t xl:border-t-0 xl:border-l border-white/15 pt-4 xl:pt-0 xl:pl-7">
          <div>
            <p className="text-xs text-slate-300">Current Streak</p>
            <p className="mt-1 text-lg font-bold tabular-nums flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#D69E36] shrink-0" />
              <span>{data.streakDays} {data.streakDays === 1 ? 'day' : 'days'}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-300">Best Streak</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {data.longestStreakDays} {data.longestStreakDays === 1 ? 'day' : 'days'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-300">7-Day Practice</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{data.weeklyMinutes} mins</p>
          </div>
          <div>
            <p className="text-xs text-slate-300">Apps Submitted</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#0F9D78]">{data.submittedAppsCount}</p>
          </div>
        </div>
      </section>

      {/* 2. 4-Column Career Progress Summary Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>Daily Goals</span>
            <span className="font-mono tabular-nums">
              {data.dailyGoalStats.completed}/{data.dailyGoalStats.total}
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-[#14243A] tabular-nums">
            {data.dailyGoalStats.total > 0
              ? `${Math.round((data.dailyGoalStats.completed / data.dailyGoalStats.total) * 100)}%`
              : '0%'}
          </p>
          <div className="mt-3 h-1.5 w-full bg-[#F4F6FA] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0F9D78] transition-all duration-300"
              style={{
                width: `${
                  data.dailyGoalStats.total > 0
                    ? Math.round((data.dailyGoalStats.completed / data.dailyGoalStats.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>Weekly Goals</span>
            <span className="font-mono tabular-nums">
              {data.weeklyGoalStats.completed}/{data.weeklyGoalStats.total}
            </span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-[#14243A] tabular-nums">
            {data.weeklyGoalStats.total > 0
              ? `${Math.round((data.weeklyGoalStats.completed / data.weeklyGoalStats.total) * 100)}%`
              : '0%'}
          </p>
          <div className="mt-3 h-1.5 w-full bg-[#F4F6FA] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4F46E5] transition-all duration-300"
              style={{
                width: `${
                  data.weeklyGoalStats.total > 0
                    ? Math.round((data.weeklyGoalStats.completed / data.weeklyGoalStats.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>Active Days (7d)</span>
            <span className="font-mono tabular-nums">{data.activeDaysLast7}/7</span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-[#14243A] tabular-nums">
            {data.activeDaysLast7} {data.activeDaysLast7 === 1 ? 'Day' : 'Days'}
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            {data.activeDaysLast7 >= 4
              ? 'Strong weekly rhythm sustained'
              : 'Aim for 3–5 focused days per week'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>{heatmap.length}-Day Investment</span>
            <span className="font-mono tabular-nums">{totalHeatmapMinutes}m</span>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-[#14243A] tabular-nums">
            {(totalHeatmapMinutes / 60).toFixed(1)} hrs
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            {data.skillBreakdown.length} {data.skillBreakdown.length === 1 ? 'skill area' : 'skill areas'} practised
          </p>
        </div>
      </section>

      {/* 3. Progress Visualization Charts & 14-Day Streak Consistency Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Practice Momentum Chart + 14-Day Streak Strip */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#4F46E5]" />
                <h3 className="text-base font-semibold text-[#14243A]">Practice Momentum & Study Time</h3>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                {selectedDay
                  ? `${selectedDay.dayNum} (${selectedDay.label}) · ${selectedDay.minutes} mins logged · ${selectedDay.sessions} ${selectedDay.sessions === 1 ? 'session' : 'sessions'}`
                  : 'Minutes logged across coding drills, study sessions, and portfolio builds'}
              </p>
            </div>

            <div className="inline-flex items-center p-1 bg-[#F4F6FA] rounded-lg self-start shrink-0">
              <button
                type="button"
                onClick={() => setChartWindow('7d')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  chartWindow === '7d' ? 'bg-white text-[#14243A] shadow-xs' : 'text-[#64748B] hover:text-[#14243A]'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setChartWindow('14d')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  chartWindow === '14d' ? 'bg-white text-[#14243A] shadow-xs' : 'text-[#64748B] hover:text-[#14243A]'
                }`}
              >
                14 Days
              </button>
            </div>
          </div>

          {/* Interactive Bar Chart with 30m Pace Line */}
          <div className="relative pt-4">
            <div
              className="absolute left-0 right-0 border-t border-dashed border-[#0F9D78]/50 pointer-events-none flex justify-end"
              style={{ bottom: `calc(28px + ${Math.round((targetPacePct / 100) * 128)}px)` }}
            >
              <span className="text-[10px] font-mono text-[#0F9D78] bg-white px-1 -mt-2">
                30m pace
              </span>
            </div>

            <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-2.5 border-b border-slate-200 pb-2">
              {chartSeries.map((day) => {
                const pct = Math.round((day.minutes / maxChartMinutes) * 100);
                const metPace = day.minutes >= 30;
                const isSelected = selectedDay?.date === day.date;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDayDate(day.date)}
                    title={`${day.dayNum}: ${day.minutes} mins (${day.sessions} sessions)`}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer focus:outline-none"
                  >
                    <span className="text-[10px] font-mono text-[#64748B] tabular-nums">
                      {day.minutes > 0 ? `${day.minutes}m` : ''}
                    </span>
                    <div
                      className={`w-full max-w-[34px] bg-[#F4F6FA] rounded-t-md h-32 flex items-end overflow-hidden transition-all ${
                        isSelected ? 'ring-2 ring-[#4F46E5]/30' : ''
                      }`}
                    >
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          metPace
                            ? 'bg-[#0F9D78]'
                            : 'bg-[#4F46E5]'
                        }`}
                        style={{ height: `${Math.max(day.minutes > 0 ? 8 : 0, pct)}%` }}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-medium whitespace-nowrap ${
                        isSelected ? 'text-[#4F46E5] font-semibold' : 'text-[#64748B]'
                      }`}
                    >
                      {chartWindow === '7d' ? day.label : day.date.slice(8)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 28-Day (4-Week) Learning Activity Heatmap */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[#14243A]">{heatmap.length}-Day Learning Activity Heatmap</h4>
                <p className="text-xs text-[#64748B]">Click any calendar cell to inspect daily logged sessions</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#F4F6FA] border border-slate-200 inline-block" />
                  <span>0m</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#4F46E5]/25 inline-block" />
                  <span>1–29m</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#4F46E5] inline-block" />
                  <span>30–59m</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0F9D78] inline-block" />
                  <span>60m+</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {heatmap.slice(0, 7).map((hdr) => (
                <div key={`hdr-${hdr.date}`} className="text-[10px] font-medium text-[#64748B] text-center pb-0.5">
                  {hdr.label}
                </div>
              ))}
              {heatmap.map((cell) => {
                let bgClass = 'bg-[#F4F6FA] text-[#64748B] border-slate-200';
                if (cell.minutes >= 60) bgClass = 'bg-[#0F9D78] text-white border-[#0F9D78]';
                else if (cell.minutes >= 30) bgClass = 'bg-[#4F46E5] text-white border-[#4F46E5]';
                else if (cell.minutes > 0) bgClass = 'bg-[#4F46E5]/15 text-[#14243A] border-[#4F46E5]/30';

                const isSelected = selectedDay?.date === cell.date;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => setSelectedDayDate(cell.date)}
                    title={`${cell.dayNum} (${cell.label}): ${cell.minutes} mins (${cell.sessions} sessions)`}
                    className={`h-9 rounded-md border text-[11px] font-mono tabular-nums flex items-center justify-center transition-colors cursor-pointer ${bgClass} ${
                      isSelected ? 'ring-2 ring-[#14243A] ring-offset-1' : ''
                    }`}
                  >
                    <span>{cell.date.slice(8)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Goal Completion Ring & Skill Practice Distribution */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#4F46E5]" />
            <h3 className="text-base font-semibold text-[#14243A]">Goal Completion & Skill Focus</h3>
          </div>

          {/* SVG Progress Ring + Cadence Breakdown */}
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-label="Goal completion chart">
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke="#F4F6FA"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="none"
                  stroke={overallGoalStats.pct >= 70 ? '#0F9D78' : '#4F46E5'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-[#14243A] tabular-nums">{overallGoalStats.pct}%</span>
                <span className="text-[11px] text-[#64748B]">Done</span>
              </div>
            </div>

            <div className="flex-1 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">All Active & Completed</span>
                <span className="font-mono font-semibold text-[#14243A] tabular-nums">
                  {overallGoalStats.completed}/{overallGoalStats.total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Daily Goals Done</span>
                <span className="font-mono font-semibold text-[#0F9D78] tabular-nums">
                  {data.dailyGoalStats.completed}/{data.dailyGoalStats.total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Weekly Goals Done</span>
                <span className="font-mono font-semibold text-[#4F46E5] tabular-nums">
                  {data.weeklyGoalStats.completed}/{data.weeklyGoalStats.total}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] pt-1">
                Completing small daily targets compounds into interview readiness.
              </p>
            </div>
          </div>

          {/* Skill Improvement Horizontal Bar Chart */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#14243A]">Time Invested by Skill</h4>
              <span className="text-xs text-[#64748B]">Recent sessions</span>
            </div>

            {data.skillBreakdown.length === 0 ? (
              <div className="py-4 space-y-3">
                <p className="text-xs text-[#64748B]">
                  No skill-specific practice logged yet. Log a quick session to see your skill balance.
                </p>
                <button
                  type="button"
                  onClick={() => handleQuickPreset(QUICK_PRACTICE_PRESETS[0])}
                  disabled={submittingPractice}
                  className="px-3 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] cursor-pointer whitespace-nowrap"
                >
                  Log First 15m Drill
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {data.skillBreakdown.map((item) => {
                  const pct = Math.max(8, Math.round((item.minutes / topSkillMaxMinutes) * 100));
                  return (
                    <div key={item.skill} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#14243A] truncate pr-3">{item.skill}</span>
                        <span className="font-mono text-[#64748B] tabular-nums shrink-0">
                          {item.minutes}m · {item.sessions} {item.sessions === 1 ? 'session' : 'sessions'}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#F4F6FA] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4F46E5] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 4. Daily & Weekly Career Goals Manager + Quick Practice & Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily & Weekly Career Goals */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#14243A]">Daily & Weekly Career Goals</h3>
              <p className="text-xs text-[#64748B]">Pick a realistic starter or add your own target milestone</p>
            </div>

            <div className="inline-flex items-center p-1 bg-[#F4F6FA] rounded-lg self-start shrink-0">
              {(['all', 'daily', 'weekly'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setGoalFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    goalFilter === tab ? 'bg-white text-[#14243A] shadow-xs' : 'text-[#64748B] hover:text-[#14243A]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Click Starter Templates */}
          <div className="flex flex-wrap gap-2">
            {GOAL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.title}
                type="button"
                onClick={() => onAddGoal(tpl)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#14243A] bg-[#F4F6FA] border border-slate-200 rounded-lg hover:border-[#4F46E5] hover:text-[#4F46E5] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>{tpl.title}</span>
              </button>
            ))}
          </div>

          {/* Custom Goal Form */}
          <form onSubmit={handleGoalSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100">
            <input
              type="text"
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="Add custom daily or weekly goal..."
              className="sm:col-span-5 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#4F46E5]"
            />
            <select
              value={goalCategory}
              onChange={(e) => setGoalCategory(e.target.value)}
              aria-label="Goal category"
              className="sm:col-span-3 px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option>Technical Skill</option>
              <option>Portfolio Project</option>
              <option>Algorithms & CS</option>
              <option>Applications</option>
            </select>
            <div className="sm:col-span-3 flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={30}
                value={goalTarget}
                onChange={(e) => setGoalTarget(Math.max(1, Number(e.target.value)))}
                aria-label="Target count"
                className="w-14 px-2 py-2 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              <select
                value={goalPeriod}
                onChange={(e) => setGoalPeriod(e.target.value as 'daily' | 'weekly')}
                aria-label="Goal period"
                className="flex-1 px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submittingGoal}
              aria-label="Add career goal"
              className="sm:col-span-1 flex items-center justify-center py-2 px-3 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          {/* Goals List */}
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {filteredGoals.length === 0 ? (
              <div className="py-6 space-y-2">
                <p className="text-xs text-[#64748B]">
                  {goalFilter === 'all'
                    ? 'No career goals added yet. Pick any quick starter above to begin.'
                    : `No ${goalFilter} goals yet. Add one above or switch tabs.`}
                </p>
              </div>
            ) : (
              filteredGoals.map((g) => {
                const progressPct = Math.min(100, Math.round((g.currentCount / Math.max(1, g.targetCount)) * 100));
                return (
                  <div key={g.id} className="py-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-0.5">
                          <span>{g.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{g.period}</span>
                        </div>
                        <p className={`text-sm font-medium ${g.completed ? 'text-[#0F9D78]' : 'text-[#14243A]'}`}>
                          {g.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-[#64748B] tabular-nums">
                          {g.currentCount}/{g.targetCount}
                        </span>
                        {g.completed ? (
                          <button
                            type="button"
                            onClick={() => onToggleGoalComplete(g)}
                            title="Reopen goal"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#0F9D78] hover:bg-emerald-50 rounded-md cursor-pointer whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done</span>
                            <RotateCcw className="w-3 h-3 ml-0.5 opacity-60" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onIncrementGoal(g)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#4F46E5] border border-[#4F46E5]/30 rounded-md hover:bg-indigo-50 cursor-pointer whitespace-nowrap"
                          >
                            +1 Progress
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteGoal(g.id)}
                          aria-label="Delete goal"
                          className="p-1 text-[#64748B] hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-[#F4F6FA] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          g.completed ? 'bg-[#0F9D78]' : 'bg-[#4F46E5]'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Log Win / Quick Practice + Earned Milestones & Recent Wins */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-[#14243A]">Log Practice & Small Wins</h3>
              <p className="text-xs text-[#64748B]">Keep your skill streak alive with 1-click presets or custom entries</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_PRACTICE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={submittingPractice}
                  onClick={() => handleQuickPreset(preset)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#4F46E5] bg-[#F4F6FA] border border-[#4F46E5]/25 rounded-lg hover:bg-indigo-50 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {data.profileSkills && data.profileSkills.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[#64748B] mr-1">Profile skills:</span>
                {data.profileSkills.slice(0, 6).map((sk) => (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => setActSkill(sk)}
                    className={`px-2 py-0.5 text-[11px] rounded border cursor-pointer transition-colors ${
                      actSkill === sk
                        ? 'bg-[#14243A] text-white border-[#14243A]'
                        : 'bg-white text-[#64748B] border-slate-200 hover:border-[#4F46E5] hover:text-[#14243A]'
                    }`}
                  >
                    {sk}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handlePracticeSubmit} className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActType('skill_practice')}
                  className={`py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    actType === 'skill_practice'
                      ? 'bg-[#14243A] text-white border-[#14243A]'
                      : 'bg-[#F4F6FA] text-[#64748B] border-slate-200'
                  }`}
                >
                  Skill Practice
                </button>
                <button
                  type="button"
                  onClick={() => setActType('project_milestone')}
                  className={`py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                    actType === 'project_milestone'
                      ? 'bg-[#14243A] text-white border-[#14243A]'
                      : 'bg-[#F4F6FA] text-[#64748B] border-slate-200'
                  }`}
                >
                  Project Milestone
                </button>
              </div>
              <input
                type="text"
                required
                value={actDesc}
                onChange={(e) => setActDesc(e.target.value)}
                placeholder={
                  actType === 'project_milestone'
                    ? 'e.g. Deployed REST API endpoints & integration tests'
                    : 'e.g. Solved 2 graph problems or reviewed SQL joins'
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#4F46E5]"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={actSkill}
                  onChange={(e) => setActSkill(e.target.value)}
                  placeholder="Skill (e.g. Python, SQL)"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#4F46E5]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={actMinutes}
                    onChange={(e) => setActMinutes(Number(e.target.value))}
                    aria-label="Minutes practised"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                  />
                  <span className="text-xs text-[#64748B] shrink-0">mins</span>
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingPractice}
                className="w-full px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {submittingPractice ? 'Saving Session...' : 'Log Session & Keep Streak'}
              </button>
            </form>
          </div>

          {/* Earned Milestones (flat hairline list, no nested cards) */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#4F46E5]" />
              <h4 className="text-sm font-semibold text-[#14243A]">Achievement Milestones</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {data.badges.map((b) => (
                <div key={b.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#14243A]">{b.title}</p>
                    <p className="text-[#64748B] mt-0.5">{b.description}</p>
                  </div>
                  <span
                    className={`font-semibold shrink-0 whitespace-nowrap ${
                      b.earned ? 'text-[#0F9D78]' : 'text-[#64748B]'
                    }`}
                  >
                    {b.earned ? 'Earned' : 'In Progress'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Practice Log */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h4 className="text-sm font-semibold text-[#14243A]">Recent Practice Sessions</h4>
            {data.activities.length === 0 ? (
              <p className="text-xs text-[#64748B]">
                No sessions logged yet. Use any quick practice preset above to start your streak.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.activities.slice(0, 5).map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-[#14243A] truncate">{a.description}</p>
                      <p className="text-[#64748B]">
                        {a.skillPractised || 'General Practice'} · {formatDateShort(a.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono font-semibold text-[#14243A] tabular-nums shrink-0">
                      {a.minutesSpent}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 5. Project & Application Milestones (Derived directly from student profile, activity, and tracker) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#4F46E5]" />
              <h3 className="text-base font-semibold text-[#14243A]">Project Milestones</h3>
            </div>
            <Link to="/settings" className="text-xs font-semibold text-[#4F46E5] hover:underline">
              Manage projects
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 text-xs">
            <div>
              <p className="text-[#64748B]">Indexed Projects</p>
              <p className="mt-0.5 text-lg font-bold text-[#14243A] tabular-nums">
                {data.projectMilestones?.portfolioProjectsCount ?? 0}
              </p>
            </div>
            <div>
              <p className="text-[#64748B]">Build Sessions</p>
              <p className="mt-0.5 text-lg font-bold text-[#14243A] tabular-nums">
                {data.projectMilestones?.projectSessionsCount ?? 0}
              </p>
            </div>
            <div>
              <p className="text-[#64748B]">Project Time</p>
              <p className="mt-0.5 text-lg font-bold text-[#0F9D78] tabular-nums">
                {data.projectMilestones?.projectMinutes ?? 0}m
              </p>
            </div>
          </div>

          {data.projectMilestones && data.projectMilestones.projects.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.projectMilestones.projects.map((proj, idx) => (
                <div key={`${proj.title}-${idx}`} className="py-2.5 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#14243A]">{proj.title}</p>
                    {proj.stack && <span className="font-mono text-[#4F46E5] shrink-0">{proj.stack}</span>}
                  </div>
                  {proj.summary && <p className="text-[#64748B] leading-relaxed">{proj.summary}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#64748B]">
              No portfolio projects added yet. Add your builds in Profile & Settings or log a Project Milestone session above.
            </p>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#0F9D78]" />
              <h3 className="text-base font-semibold text-[#14243A]">Application Milestones</h3>
            </div>
            <Link to="/tracker" className="text-xs font-semibold text-[#4F46E5] hover:underline">
              Open tracker
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-slate-100 text-xs">
            <div>
              <p className="text-[#64748B]">Saved Roles</p>
              <p className="mt-0.5 text-lg font-bold text-[#14243A] tabular-nums">
                {data.applicationMilestones?.saved ?? 0}
              </p>
            </div>
            <div>
              <p className="text-[#64748B]">Submitted</p>
              <p className="mt-0.5 text-lg font-bold text-[#4F46E5] tabular-nums">
                {data.applicationMilestones?.applied ?? 0}
              </p>
            </div>
            <div>
              <p className="text-[#64748B]">OA / Interview</p>
              <p className="mt-0.5 text-lg font-bold text-[#D69E36] tabular-nums">
                {data.applicationMilestones?.assessmentOrInterview ?? 0}
              </p>
            </div>
            <div>
              <p className="text-[#64748B]">Shortlisted / Offer</p>
              <p className="mt-0.5 text-lg font-bold text-[#0F9D78] tabular-nums">
                {data.applicationMilestones?.shortlistedOrSelected ?? 0}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-[#64748B]">
            <div className="flex items-center justify-between">
              <span>Total roles tracked in pipeline</span>
              <span className="font-mono font-semibold text-[#14243A] tabular-nums">
                {data.applicationMilestones?.totalTracked ?? 0}
              </span>
            </div>
            <p className="leading-relaxed">
              Every figure above is calculated directly from your Application Tracker entries. Consistent preparation plus steady, targeted applications outperforms mass applying.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
