import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell.tsx';
import {
  GrowthDashboard,
  type GrowthDashboardData,
  type GrowthGoal,
} from '../components/GrowthDashboard.tsx';
import { apiFetch } from '../lib/api.ts';

export function GrowthPage() {
  const [data, setData] = useState<GrowthDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const loadGrowth = useCallback(async () => {
    try {
      setError('');
      const d = await apiFetch<GrowthDashboardData>('/api/growth');
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load career growth data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrowth();
  }, [loadGrowth]);

  const handleAddGoal = async (payload: {
    title: string;
    category: string;
    targetCount: number;
    period: string;
  }) => {
    await apiFetch('/api/growth/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast(`Added ${payload.period} goal: "${payload.title}"`);
    await loadGrowth();
  };

  const handleIncrementGoal = async (g: GrowthGoal) => {
    const next = Math.min(g.targetCount, g.currentCount + 1);
    await apiFetch(`/api/growth/goals/${g.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ currentCount: next, completed: next >= g.targetCount }),
    });
    if (next >= g.targetCount) {
      showToast(`Milestone reached: completed "${g.title}".`);
    }
    await loadGrowth();
  };

  const handleToggleGoalComplete = async (g: GrowthGoal) => {
    const nextCompleted = !g.completed;
    await apiFetch(`/api/growth/goals/${g.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        currentCount: nextCompleted ? g.targetCount : Math.max(0, g.targetCount - 1),
        completed: nextCompleted,
      }),
    });
    await loadGrowth();
  };

  const handleDeleteGoal = async (id: string) => {
    await apiFetch(`/api/growth/goals/${id}`, { method: 'DELETE' });
    await loadGrowth();
  };

  const handleLogPractice = async (payload: {
    activityType?: string;
    description: string;
    skillPractised: string;
    minutesSpent: number;
  }) => {
    await apiFetch('/api/growth/activity', {
      method: 'POST',
      body: JSON.stringify({
        activityType: payload.activityType || 'skill_practice',
        description: payload.description,
        skillPractised: payload.skillPractised,
        minutesSpent: payload.minutesSpent,
      }),
    });
    showToast('Session logged! Consistent practice builds lasting confidence.');
    await loadGrowth();
  };

  return (
    <AppShell
      title="Motivation"
      subtitle="Build steady study habits, track daily and weekly goals, and see your learning streak grow"
    >
      {loading ? (
        <div className="space-y-6">
          <div className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      ) : error || !data ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <p className="text-sm font-medium text-[#14243A]">{error || 'Unable to load growth dashboard.'}</p>
          <button
            type="button"
            onClick={loadGrowth}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {feedback && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-medium text-[#0F9D78]">
              {feedback}
            </div>
          )}

          <GrowthDashboard
            data={data}
            onAddGoal={handleAddGoal}
            onIncrementGoal={handleIncrementGoal}
            onToggleGoalComplete={handleToggleGoalComplete}
            onDeleteGoal={handleDeleteGoal}
            onLogPractice={handleLogPractice}
          />
        </div>
      )}
    </AppShell>
  );
}
