import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, type StudentProject } from '../lib/api.ts';

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [college, setCollege] = useState('');
  const [degreeBranch, setDegreeBranch] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [languagesText, setLanguagesText] = useState('');
  const [rolesText, setRolesText] = useState('');
  const [locationsText, setLocationsText] = useState('');
  const [workArrangement, setWorkArrangement] = useState('Any');
  const [categoriesText, setCategoriesText] = useState('');
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [newMatches, setNewMatches] = useState(true);
  const [updates, setUpdates] = useState(true);
  const [deadlines, setDeadlines] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [privacyPublic, setPrivacyPublic] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEducationLevel(user.educationLevel);
    setCollege(user.college);
    setDegreeBranch(user.degreeBranch);
    setGraduationYear(user.graduationYear);
    setSkillsText(user.skills.join(', '));
    setLanguagesText(user.languages.join(', '));
    setRolesText(user.preferredRoles.join(', '));
    setLocationsText(user.preferredLocations.join(', '));
    setWorkArrangement(user.workArrangement || 'Any');
    setCategoriesText(user.preferredCategories.join(', '));
    setProjects(user.projects || []);
    setNewMatches(user.notificationPrefs?.newMatches ?? true);
    setUpdates(user.notificationPrefs?.updates ?? true);
    setDeadlines(user.notificationPrefs?.deadlines ?? true);
    setWeeklySummary(user.notificationPrefs?.weeklySummary ?? true);
    setPrivacyPublic(user.privacyPublic);
  }, [user]);

  const splitCsv = (str: string) =>
    str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          educationLevel,
          college,
          degreeBranch,
          graduationYear,
          skills: splitCsv(skillsText),
          languages: splitCsv(languagesText),
          preferredRoles: splitCsv(rolesText),
          preferredLocations: splitCsv(locationsText),
          workArrangement,
          preferredCategories: splitCsv(categoriesText),
          projects,
          notificationPrefs: {
            newMatches,
            updates,
            deadlines,
            weeklySummary,
          },
          privacyPublic,
        }),
      });
      await refreshUser();
      setMessage('Profile, skills, and preferences saved. Cached AI skill matches refreshed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    }
  };

  return (
    <AppShell
      title="Profile & Settings"
      subtitle="Manage your academic profile, technical skills, portfolio projects, and account security"
    >
      <div className="space-y-6 max-w-4xl">
        {message && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-[#0F9D78]">
            {message}
          </div>
        )}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Academic Details */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#14243A]">Personal & Academic Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Education Level</label>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Select level</option>
                  <option>Undergraduate (B.S.)</option>
                  <option>Undergraduate (B.Tech / B.E.)</option>
                  <option>Master’s (M.S. / M.Tech)</option>
                  <option>Ph.D.</option>
                  <option>Bootcamp / Diploma</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">College / University</label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Degree & Branch</label>
                <input
                  type="text"
                  value={degreeBranch}
                  onChange={(e) => setDegreeBranch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Graduation Year</label>
                <input
                  type="text"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Work Arrangement Preference</label>
                <select
                  value={workArrangement}
                  onChange={(e) => setWorkArrangement(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option>Any</option>
                  <option>Remote</option>
                  <option>Hybrid</option>
                  <option>Onsite</option>
                </select>
              </div>
            </div>
          </section>

          {/* Skills & Preferences */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#14243A]">Skills & Internship Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">
                  Technical Skills & Frameworks (comma-separated)
                </label>
                <input
                  type="text"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="React, Node.js, PostgreSQL, Docker, Git"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">
                  Programming Languages (comma-separated)
                </label>
                <input
                  type="text"
                  value={languagesText}
                  onChange={(e) => setLanguagesText(e.target.value)}
                  placeholder="TypeScript, Python, SQL, Java"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#14243A] mb-1">Preferred Roles</label>
                  <input
                    type="text"
                    value={rolesText}
                    onChange={(e) => setRolesText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14243A] mb-1">Preferred Locations</label>
                  <input
                    type="text"
                    value={locationsText}
                    onChange={(e) => setLocationsText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Preferred Internship Categories</label>
                <input
                  type="text"
                  value={categoriesText}
                  onChange={(e) => setCategoriesText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </section>

          {/* Project Portfolio */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#14243A]">Project Portfolio</h2>
              <button
                type="button"
                onClick={() => setProjects([...projects, { title: '', summary: '', stack: '' }])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Project</span>
              </button>
            </div>
            {projects.length === 0 ? (
              <p className="text-xs text-[#64748B]">Add engineering or academic projects to improve AI matching accuracy.</p>
            ) : (
              <div className="space-y-4 divide-y divide-slate-100">
                {projects.map((proj, idx) => (
                  <div key={idx} className="pt-4 first:pt-0 space-y-2.5">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={proj.title}
                        onChange={(e) => {
                          const next = [...projects];
                          next[idx] = { ...proj, title: e.target.value };
                          setProjects(next);
                        }}
                        placeholder="Project title"
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={proj.stack}
                        onChange={(e) => {
                          const next = [...projects];
                          next[idx] = { ...proj, stack: e.target.value };
                          setProjects(next);
                        }}
                        placeholder="Tech stack (e.g. React, Python)"
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setProjects(projects.filter((_, i) => i !== idx))}
                        aria-label="Remove project"
                        className="p-2 text-[#64748B] hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={proj.summary}
                      onChange={(e) => {
                        const next = [...projects];
                        next[idx] = { ...proj, summary: e.target.value };
                        setProjects(next);
                      }}
                      placeholder="Brief outcome or architecture summary"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Notifications & Privacy */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 text-xs">
            <h2 className="text-base font-semibold text-[#14243A]">Notification & Privacy Settings</h2>
            <label className="flex items-center gap-2.5 text-[#14243A] cursor-pointer">
              <input type="checkbox" checked={newMatches} onChange={(e) => setNewMatches(e.target.checked)} />
              <span>Notify me when hourly scans discover newly verified internships matching my skills</span>
            </label>
            <label className="flex items-center gap-2.5 text-[#14243A] cursor-pointer">
              <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} />
              <span>Notify me when tracked or matching internships change requirements or stipends</span>
            </label>
            <label className="flex items-center gap-2.5 text-[#14243A] cursor-pointer">
              <input type="checkbox" checked={deadlines} onChange={(e) => setDeadlines(e.target.checked)} />
              <span>Upcoming application deadline reminders</span>
            </label>
            <label className="flex items-center gap-2.5 text-[#14243A] cursor-pointer">
              <input type="checkbox" checked={weeklySummary} onChange={(e) => setWeeklySummary(e.target.checked)} />
              <span>Weekly career progress summary alerts</span>
            </label>
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2.5 text-[#64748B] cursor-pointer">
                <input type="checkbox" checked={privacyPublic} onChange={(e) => setPrivacyPublic(e.target.checked)} />
                <span>Allow private portfolio summary export (private student info is never exposed to other users)</span>
              </label>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Profile & Preferences'}</span>
            </button>
          </div>
        </form>

        {/* Account Security */}
        <form onSubmit={handlePasswordChange} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#14243A]">Account Security</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#14243A] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#14243A] mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-[#14243A] bg-[#F4F6FA] border border-slate-300 rounded-lg hover:bg-slate-200/70 cursor-pointer"
          >
            Update Password
          </button>
        </form>
      </div>
    </AppShell>
  );
}
