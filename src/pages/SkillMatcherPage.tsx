import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, Code2, Sparkles } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, type Internship, type SkillMatchResult } from '../lib/api.ts';

export function SkillMatcherPage() {
  const { user, includeDemoData } = useAuth();
  const [internships, setInternships] = useState<Internship[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [match, setMatch] = useState<SkillMatchResult | null>(null);
  const [recommendations, setRecommendations] = useState<{
    marketTopSkills: Array<{ skill: string; count: number }>;
    recommendations: {
      focusSkills: Array<{ skill: string; reason: string }>;
      learningActivities: string[];
      projectIdeas: Array<{ title: string; outcome: string }>;
      usedAi: boolean;
    };
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ internships: Internship[] }>(`/api/internships?includeDemo=${includeDemoData}`)
      .then((d) => {
        setInternships(d.internships || []);
        if (d.internships?.length > 0) setSelectedId(d.internships[0].id);
      })
      .catch(() => {});

    if (user) {
      apiFetch<any>(`/api/skills/recommendations?includeDemo=${includeDemoData}`)
        .then(setRecommendations)
        .catch(() => {});
    }
  }, [user, includeDemoData]);

  const handleAnalyze = async () => {
    if (!selectedId || !user) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ match: SkillMatchResult }>(`/api/skills/match/${selectedId}`, {
        method: 'POST',
        body: JSON.stringify({ refresh: true }),
      });
      setMatch(res.match);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="AI Skill Matcher"
      subtitle="Compare your technical profile with authentic internship requirements and identify priority gaps"
    >
      <div className="space-y-6">
        {!user ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <h2 className="text-lg font-bold text-[#14243A]">Sign in to run personalized AI Skill Matching</h2>
            <p className="text-sm text-[#64748B] max-w-md mx-auto">
              InternRadar compares your registered languages, coursework, and projects directly against verified company listings.
            </p>
            <Link
              to="/auth"
              className="inline-block px-5 py-2.5 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA]"
            >
              Sign In / Register
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Interactive Role Matcher */}
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                  <h2 className="text-base font-semibold text-[#14243A]">Role-by-Role Skill Comparison</h2>
                </div>
                <p className="text-xs text-[#64748B]">
                  Pick any verified internship below to see which skills you already have and what to practice next.
                </p>
                {user.skills.length === 0 && user.languages.length === 0 ? (
                  <p className="text-xs text-[#D69E36] mt-2">
                    Your profile has no skills listed yet.{' '}
                    <Link to="/settings" className="font-semibold text-[#4F46E5] underline">
                      Add your skills in Settings
                    </Link>{' '}
                    for an accurate match.
                  </p>
                ) : (
                  <p className="text-xs text-[#64748B] mt-1.5">
                    Indexed skills: <span className="text-[#14243A] font-medium">{[...user.skills, ...user.languages].join(', ')}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setMatch(null);
                  }}
                  className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {internships.length === 0 && <option value="">No verified listings in current filter</option>}
                  {internships.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.companyName} — {j.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!selectedId || busy}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {busy ? 'Analyzing...' : 'Compare Profile'}
                </button>
              </div>

              {match && (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-xs font-medium text-[#64748B]">Estimated Readiness Match</p>
                      <p className="text-[11px] text-[#64748B]">
                        Preparation estimate only — not a hiring guarantee
                      </p>
                    </div>
                    <span className="text-3xl font-bold text-[#4F46E5] font-mono tabular-nums">
                      {match.estimatedMatchPercentage}%
                    </span>
                  </div>

                  <p className="text-sm text-[#14243A] leading-relaxed">{match.explanation}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-lg bg-[#F4F6FA]">
                      <p className="text-xs font-semibold text-[#0F9D78] mb-2">Matching Skills</p>
                      <ul className="space-y-1 text-xs text-[#14243A]">
                        {match.matchingSkills.length ? (
                          match.matchingSkills.map((s) => (
                            <li key={s} className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D78] shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-[#64748B]">None matched</li>
                        )}
                      </ul>
                    </div>

                    <div className="p-4 rounded-lg bg-[#F4F6FA]">
                      <p className="text-xs font-semibold text-[#D69E36] mb-2">Skills to Improve</p>
                      <ul className="space-y-1 text-xs text-[#14243A]">
                        {match.missingSkills.length ? (
                          match.missingSkills.map((s) => <li key={s}>· {s}</li>)
                        ) : (
                          <li className="text-[#64748B]">All core requirements covered</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {match.suggestedProjects.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-[#14243A] mb-2">Recommended Portfolio Build</p>
                      {match.suggestedProjects.map((p, i) => (
                        <div key={i} className="text-xs text-[#64748B] mb-2">
                          <strong className="text-[#14243A]">{p.title}:</strong> {p.scope}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    <Link
                      to={`/internships/${selectedId}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] hover:underline"
                    >
                      <span>Open Full Internship Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </section>

            {/* Right: Market Demand & AI Career Plan */}
            <section className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#4F46E5]" />
                  <h2 className="text-base font-semibold text-[#14243A]">AI Career Recommendations</h2>
                </div>

                {!recommendations ? (
                  <p className="text-xs text-[#64748B]">Loading tailored preparation plan...</p>
                ) : (
                  <div className="space-y-4 text-xs">
                    <div>
                      <p className="font-semibold text-[#14243A] mb-2">Priority Skills to Focus On</p>
                      {recommendations.recommendations.focusSkills.length === 0 ? (
                        <p className="text-[#64748B]">Your skill set aligns well with current verified roles.</p>
                      ) : (
                        <ul className="space-y-2">
                          {recommendations.recommendations.focusSkills.map((f, i) => (
                            <li key={i} className="text-[#64748B]">
                              <strong className="text-[#14243A]">{f.skill}</strong> — {f.reason}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <p className="font-semibold text-[#14243A] mb-2">Suggested Learning Activities</p>
                      <ul className="space-y-1.5 text-[#64748B]">
                        {recommendations.recommendations.learningActivities.map((act, i) => (
                          <li key={i}>· {act}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <p className="font-semibold text-[#14243A] mb-2 flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-[#4F46E5]" />
                        <span>Portfolio Project Ideas</span>
                      </p>
                      <ul className="space-y-2 text-[#64748B]">
                        {recommendations.recommendations.projectIdeas.map((p, i) => (
                          <li key={i}>
                            <strong className="text-[#14243A]">{p.title}:</strong> {p.outcome}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {recommendations && recommendations.marketTopSkills.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-[#14243A] mb-3">
                    Most Requested Skills in Active Listings
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {recommendations.marketTopSkills.slice(0, 8).map((item) => (
                      <div key={item.skill} className="py-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-[#14243A]">{item.skill}</span>
                        <span className="font-mono text-[#64748B] tabular-nums">
                          {item.count} {item.count === 1 ? 'role' : 'roles'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
