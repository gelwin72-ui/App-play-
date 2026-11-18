import { Compass, FolderGit2, Home, PlusSquare, User } from 'lucide-react';
import { AppRoute } from '../types';

interface BottomNavProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export function BottomNav({ currentRoute, onNavigate }: BottomNavProps) {
  const items: { id: AppRoute['name']; label: string; icon: typeof Home; route: AppRoute }[] = [
    { id: 'home', label: 'HOME', icon: Home, route: { name: 'home' } },
    { id: 'explore', label: 'EXPLORE', icon: Compass, route: { name: 'explore' } },
    { id: 'upload', label: 'UPLOAD', icon: PlusSquare, route: { name: 'upload' } },
    { id: 'my-apps', label: 'MY APPS', icon: FolderGit2, route: { name: 'my-apps' } },
    { id: 'profile', label: 'PROFILE', icon: User, route: { name: 'profile' } },
  ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800"
    >
      <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            currentRoute.name === item.id ||
            (item.id === 'explore' && currentRoute.name === 'games');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.route)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
