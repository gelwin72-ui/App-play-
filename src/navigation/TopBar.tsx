import { Bell, Menu, Shield } from 'lucide-react';
import { AppRoute } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface TopBarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenMenu: () => void;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  unreadCount: number;
}

export function TopBar({
  currentRoute,
  onNavigate,
  onOpenMenu,
  onOpenNotifications,
  onOpenAuth,
  unreadCount,
}: TopBarProps) {
  const { firebaseUser, userProfile, isOwner } = useAuth();

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
      active
        ? 'text-slate-900 dark:text-white border-blue-600'
        : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-30 h-[52px] md:h-16 bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between gap-8">
        {/* Zone 1: Hamburger trigger + Single-line Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'home' })}
            className="font-display text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            APPVERSE
          </button>
        </div>

        {/* Zone 2: Clean single-line desktop navigation */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          <button
            type="button"
            onClick={() => onNavigate({ name: 'home' })}
            className={navLinkClass(currentRoute.name === 'home')}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'explore' })}
            className={navLinkClass(currentRoute.name === 'explore')}
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'games' })}
            className={navLinkClass(currentRoute.name === 'games')}
          >
            Games
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'upload' })}
            className={navLinkClass(currentRoute.name === 'upload')}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'my-apps' })}
            className={navLinkClass(currentRoute.name === 'my-apps')}
          >
            My Apps
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'owner' })}
              className={navLinkClass(currentRoute.name === 'owner')}
            >
              Owner Console
            </button>
          )}
        </nav>

        {/* Zone 3: Primary contextual actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isOwner && (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'owner' })}
              aria-label="Owner Dashboard"
              className="md:hidden min-h-[40px] px-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Shield className="w-3.5 h-3.5" />
              Owner
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {firebaseUser ? (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'profile' })}
              aria-label="Open profile"
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                {(userProfile?.displayName || firebaseUser.email || 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline max-w-[110px] truncate">
                {userProfile?.displayName || firebaseUser.displayName || 'Account'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
