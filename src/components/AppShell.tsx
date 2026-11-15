import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  Bell,
  Briefcase,
  Building2,
  ClipboardList,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';
import studentAvatarImg from '../assets/images/student_avatar_portrait_1794642477326.jpg';

const NAV_GROUPS = [
  {
    heading: 'Start Here',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/discover', label: 'Discover Internships', icon: Compass },
    ],
  },
  {
    heading: 'Prepare & Grow',
    items: [
      { to: '/skills', label: 'AI Skill Matcher', icon: Sparkles },
      { to: '/tracker', label: 'Application Tracker', icon: ClipboardList },
      { to: '/growth', label: 'Motivation', icon: Award },
    ],
  },
  {
    heading: 'Explore & Trust',
    items: [
      { to: '/news', label: 'Industry News', icon: Newspaper },
      { to: '/companies', label: 'Company Directory', icon: Building2 },
      { to: '/transparency', label: 'Source Transparency', icon: ShieldCheck },
    ],
  },
  {
    heading: 'Account',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/settings', label: 'Profile & Settings', icon: Settings },
    ],
  },
];

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, logout, includeDemoData, setIncludeDemoData } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ unreadCount: number }>('/api/notifications')
      .then((d) => setUnreadCount(d.unreadCount))
      .catch(() => {});
  }, [user, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex bg-[#F4F6FA] text-[#14243A]">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#14243A]/60 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Midnight Navy Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#14243A] text-white flex flex-col border-r border-slate-900/20 transition-transform duration-200 lg:translate-x-0 lg:static lg:shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
          <Link to="/" className="flex items-center gap-2.5 text-white font-semibold tracking-tight whitespace-nowrap">
            <Radar className="w-5 h-5 text-[#4F46E5]" />
            <span className="text-base">InternRadar</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-300 hover:text-white rounded-md"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Workspace navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-medium text-slate-400 tracking-wide">
                {group.heading}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isNotif = item.to === '/notifications';
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#4F46E5] text-white shadow-xs'
                          : 'text-slate-300 hover:bg-white/8 hover:text-white'
                      }`
                    }
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {isNotif && unreadCount > 0 && (
                      <span className="text-xs font-mono tabular-nums text-indigo-200 ml-2">
                        {unreadCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3 bg-[#101E31]">
          {user ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={studentAvatarImg}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover shrink-0 bg-slate-700 ring-1 ring-white/15"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {user.isDemo ? 'Demo Student Account' : user.college || user.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold bg-[#4F46E5] text-white hover:bg-[#4338CA] transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Workspace Header */}
        <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/90 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#14243A] hover:bg-slate-100 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-[#14243A] truncate">{title}</h1>
              {subtitle && <p className="text-xs text-[#64748B] truncate hidden sm:block">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label
              title="Show sample DEMO internships alongside live company boards"
              className="hidden md:flex items-center gap-2 text-xs text-[#64748B] hover:text-[#14243A] cursor-pointer select-none whitespace-nowrap"
            >
              <input
                type="checkbox"
                checked={includeDemoData}
                onChange={(e) => setIncludeDemoData(e.target.checked)}
                className="rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
              />
              <span>Show practice DEMO listings</span>
            </label>
            {actions}
            {user && (
              <Link
                to="/notifications"
                className="relative p-2 text-[#64748B] hover:text-[#14243A] hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="sr-only">{unreadCount} unread notifications</span>
                )}
              </Link>
            )}
          </div>
        </header>

        {includeDemoData && (
          <div className="bg-amber-50/90 border-b border-amber-200/90 px-4 sm:px-8 py-2 text-xs text-amber-950 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#D69E36] shrink-0" />
              <span>
                <strong>Practice DEMO Mode On:</strong> Sample listings labelled <code className="font-mono">[DEMO]</code> are shown so you can test matching and tracking safely. Uncheck above anytime for live employer listings only.
              </span>
            </span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
