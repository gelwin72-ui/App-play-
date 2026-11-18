import { useState } from 'react';
import { Bell, Check, Megaphone, ShieldAlert, X } from 'lucide-react';
import { AnnouncementRecord, NotificationRecord } from '../types';
import { markNotificationRead } from '../services/firestoreService';
import { formatTimestamp } from '../utils/validation';
import { requestPushNotificationToken } from '../firebase/config';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationRecord[];
  announcements: AnnouncementRecord[];
  onOpenApp: (appId: string) => void;
}

export function NotificationsDrawer({
  open,
  onClose,
  notifications,
  announcements,
  onOpenApp,
}: NotificationsDrawerProps) {
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [enablingPush, setEnablingPush] = useState(false);

  if (!open) return null;

  const handleEnablePush = async () => {
    setEnablingPush(true);
    const res = await requestPushNotificationToken();
    if (res.token) {
      setPushStatus('Push alerts active for this browser via Firebase Cloud Messaging.');
    } else {
      setPushStatus(res.reason || 'Push alerts could not be enabled.');
    }
    setEnablingPush(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => markNotificationRead(n.notificationId)));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Notifications
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {unreadCount} unread · {announcements.length} announcements
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 whitespace-nowrap"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <p className="font-medium text-slate-900 dark:text-slate-200">
                Real-time Push Alerts
              </p>
              <p className="mt-0.5">Receive submission &amp; approval updates.</p>
            </div>
            <button
              type="button"
              disabled={enablingPush}
              onClick={handleEnablePush}
              className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:opacity-90 whitespace-nowrap shrink-0"
            >
              {enablingPush ? 'Checking...' : 'Enable Push'}
            </button>
          </div>
          {pushStatus && (
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">{pushStatus}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {announcements.length > 0 && (
            <div className="p-4 space-y-2.5 bg-blue-50/40 dark:bg-blue-950/15">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Owner Announcements
              </p>
              {announcements.map((ann) => (
                <div
                  key={ann.announcementId}
                  className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {ann.title}
                    </span>
                    <span className="text-slate-400 tabular-nums">{formatTimestamp(ann.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {ann.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No notifications yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submission alerts, approval outcomes, and security updates appear here in real time.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.notificationId}
                className={`p-4 space-y-1.5 transition-colors ${
                  item.read ? 'bg-white dark:bg-slate-900' : 'bg-blue-50/50 dark:bg-blue-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.type === 'SECURITY_ALERT' || item.type === 'REPORT_ALERT' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </p>
                  </div>
                  {!item.read && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(item.notificationId)}
                      title="Mark as read"
                      className="p-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                  {item.message}
                </p>
                <div className="pl-6 flex items-center justify-between text-xs text-slate-400 tabular-nums">
                  <span>{formatTimestamp(item.createdAt)}</span>
                  {item.relatedAppId && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenApp(item.relatedAppId!);
                        onClose();
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      Inspect App
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
