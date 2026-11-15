import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { apiFetch, formatDateShort } from '../lib/api.ts';

const STATUSES = ['All', 'Saved', 'Applied', 'Assessment', 'Interview', 'Shortlisted', 'Selected', 'Rejected'] as const;

interface ApplicationItem {
  id: string;
  internshipId: string | null;
  companyName: string;
  internshipTitle: string;
  status: string;
  appliedDate: string;
  notes: string;
  importantDates: string;
  followUpDate: string;
  originalApplicationUrl: string | null;
  verificationStatus: string | null;
  isDemo: boolean;
  updatedAt: string;
}

export function TrackerPage() {
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [newCompany, setNewCompany] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newStatus, setNewStatus] = useState('Applied');
  const [newAppliedDate, setNewAppliedDate] = useState(new Date().toISOString().slice(0, 10));
  const [newNotes, setNewNotes] = useState('');
  const [newFollowUp, setNewFollowUp] = useState('');

  const loadApps = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ applications: ApplicationItem[] }>('/api/applications');
      setApps(data.applications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/applications', {
      method: 'POST',
      body: JSON.stringify({
        companyName: newCompany,
        internshipTitle: newTitle,
        status: newStatus,
        appliedDate: newAppliedDate,
        notes: newNotes,
        followUpDate: newFollowUp,
      }),
    });
    setNewCompany('');
    setNewTitle('');
    setNewNotes('');
    setNewFollowUp('');
    setShowAdd(false);
    await loadApps();
  };

  const updateField = async (id: string, patch: Record<string, string>) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    await apiFetch(`/api/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  };

  const removeApp = async (id: string) => {
    setApps((prev) => prev.filter((a) => a.id !== id));
    await apiFetch(`/api/applications/${id}`, { method: 'DELETE' });
  };

  const filtered = apps.filter((a) => {
    const matchStatus = filterStatus === 'All' || a.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch =
      !q || a.companyName.toLowerCase().includes(q) || a.internshipTitle.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <AppShell
      title="Application Tracker"
      subtitle="Organize saved internships, active applications, interviews, and follow-up dates"
      actions={
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAdd ? 'Close Form' : 'Log Application'}</span>
        </button>
      }
    >
      <div className="space-y-6">
        <p className="text-xs text-[#64748B] bg-white border border-slate-200 rounded-xl px-4 py-3">
          <strong className="text-[#14243A]">How tracking works:</strong> Click any status box below to filter your pipeline. Saving an internship in Discovery adds it here automatically, and notes or follow-up dates save when you finish typing.
        </p>

        {/* Pipeline Summary Row */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {STATUSES.filter((s) => s !== 'All').map((st) => {
            const count = apps.filter((a) => a.status === st).length;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(filterStatus === st ? 'All' : st)}
                className={`text-left bg-white border rounded-xl p-3.5 transition-colors cursor-pointer ${
                  filterStatus === st ? 'border-[#4F46E5] ring-1 ring-[#4F46E5]' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-xs text-[#64748B] truncate">{st}</p>
                <p className="mt-1 text-xl font-bold text-[#14243A] tabular-nums">{count}</p>
              </button>
            );
          })}
        </section>

        {showAdd && (
          <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-[#14243A]">Add Application Entry</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Company</label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Stripe"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Internship Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Software Engineer Intern"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {STATUSES.filter((s) => s !== 'All').map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Application Date</label>
                <input
                  type="date"
                  value={newAppliedDate}
                  onChange={(e) => setNewAppliedDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Follow-up Reminder Date</label>
                <input
                  type="date"
                  value={newFollowUp}
                  onChange={(e) => setNewFollowUp(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Notes</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Referral or portal confirmation ID"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#14243A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] cursor-pointer"
              >
                Save Entry
              </button>
            </div>
          </form>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracked company or role..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  filterStatus === s ? 'bg-[#4F46E5] text-white' : 'bg-[#F4F6FA] text-[#64748B] hover:text-[#14243A]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <h3 className="text-base font-semibold text-[#14243A]">No tracked applications in this view</h3>
            <p className="text-sm text-[#64748B]">
              Save internships from Discovery or click "Log Application" above to organize your pipeline.
            </p>
            <Link
              to="/discover"
              className="inline-block px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA]"
            >
              Browse Internships
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => (
              <div key={app.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                      <span className="font-semibold text-[#14243A]">{app.companyName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Applied: {app.appliedDate ? formatDateShort(app.appliedDate) : 'Not applied yet'}
                      </span>
                      {app.isDemo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#D69E36] font-semibold">DEMO</span>
                        </>
                      )}
                    </div>
                    {app.internshipId ? (
                      <Link
                        to={`/internships/${app.internshipId}`}
                        className="text-base font-semibold text-[#14243A] hover:text-[#4F46E5]"
                      >
                        {app.internshipTitle}
                      </Link>
                    ) : (
                      <p className="text-base font-semibold text-[#14243A]">{app.internshipTitle}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <select
                      value={app.status}
                      onChange={(e) => updateField(app.id, { status: e.target.value })}
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-[#14243A]"
                    >
                      {STATUSES.filter((s) => s !== 'All').map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {app.originalApplicationUrl && (
                      <a
                        href={app.originalApplicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#4F46E5] border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <span>Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => removeApp(app.id)}
                      aria-label="Delete application entry"
                      className="p-1.5 text-[#64748B] hover:text-red-600 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <label className="block text-[#64748B] mb-1">Important Dates / Milestones</label>
                    <input
                      type="text"
                      defaultValue={app.importantDates}
                      onBlur={(e) => updateField(app.id, { importantDates: e.target.value })}
                      placeholder="e.g. OA due Friday 5 PM"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] mb-1">Follow-up Reminder Date</label>
                    <input
                      type="date"
                      defaultValue={app.followUpDate}
                      onBlur={(e) => updateField(app.id, { followUpDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#64748B] mb-1">Personal Notes</label>
                    <input
                      type="text"
                      defaultValue={app.notes}
                      onBlur={(e) => updateField(app.id, { notes: e.target.value })}
                      placeholder="Add interview prep notes..."
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
