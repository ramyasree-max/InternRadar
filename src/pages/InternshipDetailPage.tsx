import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { StatusText } from '../components/StatusText.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  apiFetch,
  formatDateShort,
  formatDateTime,
  type Internship,
  type SkillMatchResult,
} from '../lib/api.ts';

const TRACKER_STATUSES = ['Saved', 'Applied', 'Assessment', 'Interview', 'Shortlisted', 'Selected', 'Rejected'];

interface DetailResponse {
  internship: Internship;
  company: {
    id: string;
    name: string;
    websiteUrl: string;
    careersUrl: string;
    sourcePlatform: string;
    integrationStatus: string;
    lastSuccessAt: string | null;
  } | null;
  verificationHistory: Array<{
    id: string;
    checkedAt: string;
    previousStatus: string | null;
    newStatus: string;
    changeSummary: string;
    httpStatus: number | null;
  }>;
  application: { id: string; status: string } | null;
  cachedMatch: SkillMatchResult | null;
}

export function InternshipDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [match, setMatch] = useState<SkillMatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [trackerStatus, setTrackerStatus] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<DetailResponse>(`/api/internships/${id}`)
      .then((d) => {
        setDetail(d);
        setMatch(d.cachedMatch);
        setTrackerStatus(d.application?.status || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load internship details'))
      .finally(() => setLoading(false));
  }, [id]);

  const runSkillMatch = async (refresh = false) => {
    if (!id || !user) return;
    setMatchingBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ match: SkillMatchResult }>(`/api/skills/match/${id}`, {
        method: 'POST',
        body: JSON.stringify({ refresh }),
      });
      setMatch(res.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze skills');
    } finally {
      setMatchingBusy(false);
    }
  };

  const updateApplicationStatus = async (newStatus: string) => {
    if (!detail || !user || !newStatus) return;
    try {
      await apiFetch('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
          internshipId: detail.internship.id,
          companyName: detail.internship.companyName,
          internshipTitle: detail.internship.title,
          status: newStatus,
        }),
      });
      setTrackerStatus(newStatus);
      setFeedback(`Application status updated to "${newStatus}" in your tracker.`);
      setTimeout(() => setFeedback(''), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tracker');
    }
  };

  return (
    <AppShell
      title={detail ? detail.internship.title : 'Internship Details'}
      subtitle={detail ? `${detail.internship.companyName} · ${detail.internship.sourcePlatform}` : 'Verified opportunity record'}
      actions={
        <Link
          to="/discover"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#14243A] whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Discovery</span>
        </Link>
      }
    >
      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : error && !detail ? (
        <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">{error}</div>
      ) : detail ? (
        <div className="space-y-6">
          {feedback && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-medium text-[#0F9D78]">
              {feedback}
            </div>
          )}

          {/* Header Summary Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] mb-2">
                  <span className="font-semibold text-[#14243A]">{detail.internship.companyName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#4F46E5]">{detail.internship.sector}</span>
                  <span aria-hidden="true">·</span>
                  <span>{detail.internship.category}</span>
                  <span aria-hidden="true">·</span>
                  <StatusText status={detail.internship.verificationStatus} />
                  {detail.internship.isDemo && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#D69E36]">DEMO SAMPLE LISTING</span>
                    </>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-[#14243A]">{detail.internship.title}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {user && (
                  <select
                    value={trackerStatus}
                    onChange={(e) => updateApplicationStatus(e.target.value)}
                    aria-label="Track application status"
                    className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-[#14243A]"
                  >
                    <option value="">Track Application...</option>
                    {TRACKER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        Status: {s}
                      </option>
                    ))}
                  </select>
                )}
                <a
                  href={detail.internship.originalApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] transition-colors whitespace-nowrap"
                >
                  <span>Apply on Official Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Structured Official Facts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div>
                <p className="text-[#64748B]">Location</p>
                <p className="mt-1 font-semibold text-[#14243A]">{detail.internship.location}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Work Arrangement</p>
                <p className="mt-1 font-semibold text-[#14243A]">{detail.internship.workArrangement}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Stipend / Compensation</p>
                <p className="mt-1 font-semibold text-[#14243A]">{detail.internship.stipendText}</p>
              </div>
              <div>
                <p className="text-[#64748B]">Application Deadline</p>
                <p className="mt-1 font-semibold text-[#14243A] tabular-nums">
                  {detail.internship.deadlineAt ? formatDateShort(detail.internship.deadlineAt) : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Published Date</p>
                <p className="mt-1 font-medium text-[#14243A] tabular-nums">
                  {detail.internship.publishedAt ? formatDateShort(detail.internship.publishedAt) : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">First Discovered</p>
                <p className="mt-1 font-mono text-[#14243A] tabular-nums">
                  {formatDateTime(detail.internship.firstDiscoveredAt)}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Last Verified</p>
                <p className="mt-1 font-mono text-[#0F9D78] tabular-nums">
                  {formatDateTime(detail.internship.lastVerifiedAt)}
                </p>
              </div>
              <div>
                <p className="text-[#64748B]">Original Source</p>
                <a
                  href={detail.internship.originalListingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-medium text-[#4F46E5] hover:underline"
                >
                  <span>{detail.internship.sourcePlatform}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Description, Eligibility & Verification History */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-semibold text-[#14243A]">Role Description & Requirements</h3>
                <div className="text-sm text-[#14243A]/90 whitespace-pre-line leading-relaxed max-w-[70ch]">
                  {detail.internship.description}
                </div>
                <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <p>
                    <span className="font-semibold text-[#14243A]">Eligibility Criteria: </span>
                    <span className="text-[#64748B]">{detail.internship.eligibility}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-[#14243A]">Extracted Required Skills: </span>
                    <span className="text-[#64748B]">
                      {detail.internship.requiredSkills.length > 0
                        ? detail.internship.requiredSkills.join(' · ')
                        : 'Not specified'}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold text-[#14243A]">Extracted Preferred Skills: </span>
                    <span className="text-[#64748B]">
                      {detail.internship.preferredSkills.length > 0
                        ? detail.internship.preferredSkills.join(' · ')
                        : 'Not specified'}
                    </span>
                  </p>
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-[#0F9D78]" />
                  <h3 className="text-base font-semibold text-[#14243A]">Verification Audit Trail</h3>
                </div>
                {detail.verificationHistory.length === 0 ? (
                  <p className="text-xs text-[#64748B]">Initial discovery record logged.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {detail.verificationHistory.map((h) => (
                      <div key={h.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                        <div>
                          <p className="font-medium text-[#14243A]">{h.changeSummary}</p>
                          <p className="text-[#64748B] mt-0.5">
                            Status: {h.newStatus} {h.httpStatus ? `· HTTP ${h.httpStatus}` : ''}
                          </p>
                        </div>
                        <span className="font-mono text-[#64748B] tabular-nums shrink-0">
                          {formatDateTime(h.checkedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right: AI Skill Matcher Panel */}
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                    <h3 className="text-base font-semibold text-[#14243A]">AI Skill Matcher</h3>
                  </div>
                  {user && match && (
                    <button
                      type="button"
                      onClick={() => runSkillMatch(true)}
                      disabled={matchingBusy}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#4F46E5] hover:underline cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${matchingBusy ? 'animate-spin' : ''}`} />
                      <span>Re-analyze</span>
                    </button>
                  )}
                </div>

                {!user ? (
                  <div className="py-4 space-y-3 border-t border-slate-100">
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Sign in to compare your technical skills, programming languages, and portfolio projects against this official internship description.
                    </p>
                    <Link
                      to="/auth"
                      className="inline-block px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA]"
                    >
                      Sign In for Skill Analysis
                    </Link>
                  </div>
                ) : !match ? (
                  <div className="py-4 space-y-3 border-t border-slate-100">
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Run Gemini AI comparison against your student profile to surface matching skills, missing requirements, eligibility warnings, and project ideas.
                    </p>
                    <button
                      type="button"
                      onClick={() => runSkillMatch(false)}
                      disabled={matchingBusy}
                      className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer"
                    >
                      {matchingBusy ? 'Analyzing profile vs listing...' : 'Run AI Skill Match'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-slate-100 pt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-[#64748B]">Estimated Skill Alignment</span>
                      <span className="text-2xl font-bold text-[#4F46E5] font-mono tabular-nums">
                        {match.estimatedMatchPercentage}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      Estimate only for preparation planning — not a guarantee of selection.{' '}
                      {match.usedAi ? 'Analyzed via Gemini backend.' : 'Computed via deterministic skill matcher.'}
                    </p>

                    <p className="text-xs text-[#14243A] leading-relaxed">{match.explanation}</p>

                    <div>
                      <h4 className="text-xs font-semibold text-[#0F9D78] mb-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D78]" />
                        <span>Matching Skills</span>
                      </h4>
                      <p className="text-xs text-[#14243A]">
                        {match.matchingSkills.length > 0 ? match.matchingSkills.join(' · ') : 'None identified yet'}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-[#D69E36] mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#D69E36]" />
                        <span>Skills to Improve (Missing)</span>
                      </h4>
                      <p className="text-xs text-[#14243A]">
                        {match.missingSkills.length > 0 ? match.missingSkills.join(' · ') : 'No major gaps identified'}
                      </p>
                    </div>

                    {match.eligibilityWarnings.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                        <p className="font-semibold">Eligibility Notes</p>
                        {match.eligibilityWarnings.map((w, idx) => (
                          <p key={idx}>{w}</p>
                        ))}
                      </div>
                    )}

                    {match.recommendedResources.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-[#14243A] mb-2">Recommended Learning Resources</h4>
                        <ul className="space-y-2 text-xs text-[#64748B]">
                          {match.recommendedResources.map((r, idx) => (
                            <li key={idx}>
                              <strong className="text-[#14243A]">{r.topic}</strong> ({r.resourceType}): {r.action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {match.suggestedProjects.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-[#14243A] mb-2">Suggested Portfolio Projects</h4>
                        <div className="space-y-2.5 text-xs">
                          {match.suggestedProjects.map((p, idx) => (
                            <div key={idx}>
                              <p className="font-medium text-[#14243A]">{p.title}</p>
                              <p className="text-[#64748B] mt-0.5">{p.scope}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
