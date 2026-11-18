import {
  Bell,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Mail,
  Moon,
  Settings,
  Shield,
  Sun,
  UserCog,
  X,
} from 'lucide-react';
import { AppRoute } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LANGUAGE_LABELS, LanguageCode, useTheme } from '../contexts/ThemeContext';

interface DrawerMenuProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: AppRoute) => void;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  unreadNotifications: number;
}

export function DrawerMenu({
  open,
  onClose,
  onNavigate,
  onOpenNotifications,
  onOpenAuth,
  unreadNotifications,
}: DrawerMenuProps) {
  const { firebaseUser, isOwner, logout } = useAuth();
  const { theme, setTheme, language, setLanguage } = useTheme();

  if (!open) return null;

  const go = (route: AppRoute) => {
    onNavigate(route);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/45 backdrop-blur-sm">
      <div className="w-full max-w-xs bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
              APPVERSE
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Platform Menu &amp; Governance
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {isOwner && (
            <div className="space-y-1">
              <p className="px-3 text-xs font-semibold text-blue-600 dark:text-blue-400">
                Administration
              </p>
              <button
                type="button"
                onClick={() => go({ name: 'owner' })}
                className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>Owner Dashboard</span>
              </button>
            </div>
          )}

          <div className="space-y-1">
            <p className="px-3 text-xs font-medium text-slate-400">Account &amp; Workspace</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNotifications();
              }}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center justify-between text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-slate-500" />
                Notifications
              </span>
              {unreadNotifications > 0 && (
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => (firebaseUser ? go({ name: 'profile' }) : (onClose(), onOpenAuth()))}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <UserCog className="w-4 h-4 text-slate-500" />
              <span>{firebaseUser ? 'Edit Profile' : 'Sign In / Register'}</span>
            </button>

            <button
              type="button"
              onClick={() => go({ name: 'settings' })}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={() => go({ name: 'settings' })}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Account Security</span>
            </button>
          </div>

          <div className="space-y-2 px-3">
            <p className="text-xs font-medium text-slate-400">Theme Settings</p>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`min-h-[36px] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`min-h-[36px] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Dark
              </button>
            </div>
          </div>

          <div className="space-y-1.5 px-3">
            <label htmlFor="drawer-lang" className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Language Settings
            </label>
            <select
              id="drawer-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <p className="px-3 text-xs font-medium text-slate-400">Information &amp; Support</p>
            <button
              type="button"
              onClick={() => go({ name: 'about' })}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Info className="w-4 h-4 text-slate-500" />
              <span>About APPVERSE</span>
            </button>
            <button
              type="button"
              onClick={() => go({ name: 'help' })}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>Help and Support</span>
            </button>
            <button
              type="button"
              onClick={() => go({ name: 'contact' })}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Mail className="w-4 h-4 text-slate-500" />
              <span>Contact Owner</span>
            </button>
            <button
              type="button"
              onClick={() => go({ name: 'privacy' })}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Privacy Policy</span>
            </button>
            <button
              type="button"
              onClick={() => go({ name: 'terms' })}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Terms and Conditions</span>
            </button>
          </div>
        </div>

        {firebaseUser && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={async () => {
                await logout();
                onClose();
                onNavigate({ name: 'home' });
              }}
              className="w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
