import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, KeyRound, Radar, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';

type Mode = 'login' | 'register' | 'forgot';

export function AuthPage() {
  const { login, register, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accountNotFoundEmail, setAccountNotFoundEmail] = useState('');
  const [info, setInfo] = useState('');

  // Login / Forgot fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [name, setName] = useState('');
  const [showOptionalAcademics, setShowOptionalAcademics] = useState(false);
  const [educationLevel, setEducationLevel] = useState('Undergraduate (B.S. / B.Tech)');
  const [college, setCollege] = useState('');
  const [degreeBranch, setDegreeBranch] = useState('');
  const [graduationYear, setGraduationYear] = useState('2027');
  const [skillsText, setSkillsText] = useState('React, TypeScript, Python, SQL');
  const [rolesText, setRolesText] = useState('Software Engineer Intern, Frontend Intern');
  const [workArrangement, setWorkArrangement] = useState('Any');

  // Password reset fields
  const [resetStage, setResetStage] = useState<'request' | 'confirm'>('request');
  const [resetCode, setResetCode] = useState('');
  const [issuedCodeHint, setIssuedCodeHint] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAccountNotFoundEmail('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const eObj = err as Error & { code?: string };
      setError(eObj.message || 'Unable to sign in');
      if (eObj.code === 'ACCOUNT_NOT_FOUND') {
        setAccountNotFoundEmail(email.trim());
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAccountNotFoundEmail('');
    setBusy(true);
    try {
      await register({
        name,
        email,
        password,
        educationLevel,
        college,
        degreeBranch,
        graduationYear,
        skills: skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredRoles: rolesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        workArrangement,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setAccountNotFoundEmail('');
    setBusy(true);
    try {
      await loginAsDemo();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login unavailable');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (resetStage === 'request') {
        const res = await apiFetch<{ message: string; verificationCodeForLocalTesting?: string }>(
          '/api/auth/forgot-password',
          {
            method: 'POST',
            body: JSON.stringify({ email }),
          }
        );
        setInfo(res.message);
        if (res.verificationCodeForLocalTesting) {
          setIssuedCodeHint(res.verificationCodeForLocalTesting);
        }
        setResetStage('confirm');
      } else {
        const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, code: resetCode, newPassword }),
        });
        setInfo(res.message);
        setMode('login');
        setResetStage('request');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password recovery failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-lg w-full mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] hover:text-[#14243A]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-2 font-bold text-[#14243A]">
            <Radar className="w-5 h-5 text-[#4F46E5]" />
            <span>InternRadar</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="flex items-center gap-1 p-1 bg-[#F4F6FA] rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setAccountNotFoundEmail('');
                setInfo('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login' ? 'bg-white text-[#14243A] shadow-xs' : 'text-[#64748B] hover:text-[#14243A]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setAccountNotFoundEmail('');
                setInfo('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register' ? 'bg-white text-[#14243A] shadow-xs' : 'text-[#64748B] hover:text-[#14243A]'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError('');
                setAccountNotFoundEmail('');
                setInfo('');
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'forgot' ? 'bg-white text-[#14243A] shadow-xs' : 'text-[#64748B] hover:text-[#14243A]'
              }`}
            >
              Reset Password
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
              <p>{error}</p>
              {accountNotFoundEmail && (
                <button
                  type="button"
                  onClick={() => {
                    setEmail(accountNotFoundEmail);
                    setMode('register');
                    setError('');
                    setAccountNotFoundEmail('');
                  }}
                  className="inline-block px-3 py-1.5 font-semibold text-white bg-[#4F46E5] rounded-md hover:bg-[#4338CA] cursor-pointer"
                >
                  Create account with {accountNotFoundEmail}
                </button>
              )}
            </div>
          )}
          {info && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-[#0F9D78]">
              {info}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#14243A]">Sign in to your workspace</h2>
                <p className="text-xs text-[#64748B] mt-1">
                  Works with any email address — Gmail, Outlook, Yahoo, personal, or university email.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {busy ? 'Signing in...' : 'Sign In'}
              </button>
              <p className="text-xs text-center text-[#64748B]">
                New to InternRadar?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                >
                  Create a free account with any email
                </button>
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#14243A]">Create your student account</h2>
                <p className="text-xs text-[#64748B] mt-1">
                  Use any email address (Gmail, Outlook, personal, or college email). No .edu domain required.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#14243A] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ramya D."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14243A] mb-1">Email Address (Any Email)</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Create Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowOptionalAcademics((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4F46E5] hover:underline cursor-pointer"
                >
                  {showOptionalAcademics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Optional: Add college, degree & skills now (or set later in Settings)</span>
                </button>
              </div>

              {showOptionalAcademics && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#14243A] mb-1">Education Level</label>
                      <select
                        value={educationLevel}
                        onChange={(e) => setEducationLevel(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        <option>Undergraduate (B.S. / B.Tech)</option>
                        <option>Master’s (M.S. / M.Tech)</option>
                        <option>Ph.D.</option>
                        <option>Diploma / Self-Taught</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#14243A] mb-1">Preferred Arrangement</label>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[#14243A] mb-1">College / University</label>
                      <input
                        type="text"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#14243A] mb-1">Grad Year</label>
                      <input
                        type="text"
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#14243A] mb-1">Degree & Branch</label>
                    <input
                      type="text"
                      value={degreeBranch}
                      onChange={(e) => setDegreeBranch(e.target.value)}
                      placeholder="Computer Science"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#14243A] mb-1">
                      Technical Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={skillsText}
                      onChange={(e) => setSkillsText(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#14243A] mb-1">
                      Preferred Roles (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={rolesText}
                      onChange={(e) => setRolesText(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {busy ? 'Creating account...' : 'Create Account & Continue'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#4F46E5]" />
                <h2 className="text-lg font-bold text-[#14243A]">Password recovery</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14243A] mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>
              {resetStage === 'confirm' && (
                <>
                  {issuedCodeHint && (
                    <div className="p-3 rounded-lg bg-[#F4F6FA] border border-slate-200 text-xs text-[#14243A]">
                      Verification code: <strong className="font-mono">{issuedCodeHint}</strong>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-[#14243A] mb-1">Verification Code</label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#14243A] mb-1">New Password (min 6 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4F46E5]"
                    />
                  </div>
                </>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#4F46E5] rounded-lg hover:bg-[#4338CA] transition-colors cursor-pointer"
              >
                {resetStage === 'request' ? 'Request Verification Code' : 'Update Password'}
              </button>
            </form>
          )}

          {/* Clearly Labelled Demo Student Sign-In */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-[#64748B] mb-3">
              Want to explore immediately without registering? Sign in with the Demo Student profile.
            </p>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-[#14243A] bg-[#F4F6FA] border border-slate-300 rounded-lg hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-[#4F46E5]" />
              <span>Sign In as Demo Student (Alex Chen)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
