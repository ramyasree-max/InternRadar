import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { apiFetch, formatDateTime } from '../lib/api.ts';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedInternshipId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pushState, setPushState] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const load = async () => {
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setItems(data.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
  };

  const requestPush = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setPushState(perm);
  };

  const filtered = onlyUnread ? items.filter((i) => !i.isRead) : items;

  return (
    <AppShell
      title="Notification Centre"
      subtitle="Verified internship alerts, requirement updates, deadlines, and preparation reminders"
      actions={
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#14243A] bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark All Read</span>
        </button>
      }
    >
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyUnread(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                !onlyUnread ? 'bg-[#4F46E5] text-white' : 'bg-[#F4F6FA] text-[#64748B]'
              }`}
            >
              All Alerts ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnread(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                onlyUnread ? 'bg-[#4F46E5] text-white' : 'bg-[#F4F6FA] text-[#64748B]'
              }`}
            >
              Unread ({items.filter((i) => !i.isRead).length})
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {pushState === 'default' && (
              <button
                type="button"
                onClick={requestPush}
                className="inline-flex items-center gap-1.5 text-[#4F46E5] font-medium hover:underline cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Enable Browser Push Alerts</span>
              </button>
            )}
            <Link to="/settings" className="text-[#64748B] hover:text-[#14243A]">
              Notification Preferences
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-[#64748B]">
            No notifications in this view.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {filtered.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${n.isRead ? 'opacity-80' : 'bg-indigo-50/25'}`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#64748B]">
                    <span className="font-semibold text-[#14243A]">{n.title}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatDateTime(n.createdAt)}</span>
                    {!n.isRead && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#4F46E5] font-semibold">Unread</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-[#14243A]">{n.message}</p>
                  {n.relatedInternshipId && (
                    <Link
                      to={`/internships/${n.relatedInternshipId}`}
                      className="inline-block text-xs font-semibold text-[#4F46E5] hover:underline pt-1"
                    >
                      View Opportunity Details
                    </Link>
                  )}
                </div>

                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#64748B] hover:text-[#14243A] border border-slate-200 rounded-md cursor-pointer shrink-0"
                  >
                    <Check className="w-3 h-3" />
                    <span>Mark read</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
