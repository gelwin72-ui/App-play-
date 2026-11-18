import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Search, SlidersHorizontal } from 'lucide-react';
import { ApplicationRecord, AppRoute, CategoryRecord } from '../types';
import { AppCard } from '../components/AppCard';
import gamesArcadeBannerImg from '../assets/images/games_arcade_banner_1795018728605.jpg';

interface ExplorePageProps {
  approvedApps: ApplicationRecord[];
  categories: CategoryRecord[];
  loading: boolean;
  gamesOnly?: boolean;
  initialFilter?: 'all' | 'android' | 'ios' | 'games';
  initialCategory?: string;
  onNavigate: (route: AppRoute) => void;
}

export function ExplorePage({
  approvedApps,
  categories,
  loading,
  gamesOnly = false,
  initialFilter = 'all',
  initialCategory = 'All',
  onNavigate,
}: ExplorePageProps) {
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'android' | 'ios' | 'games'>(
    gamesOnly ? 'games' : initialFilter
  );
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<'recent' | 'downloads' | 'rating'>('recent');

  useEffect(() => {
    setPlatformFilter(gamesOnly ? 'games' : initialFilter);
    setSelectedCategory(initialCategory);
  }, [gamesOnly, initialFilter, initialCategory]);

  const activeCategories = useMemo(() => {
    const filtered = gamesOnly || platformFilter === 'games'
      ? categories.filter((c) => c.type === 'game')
      : categories;
    return ['All', ...filtered.map((c) => c.name)];
  }, [categories, gamesOnly, platformFilter]);

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = approvedApps.filter((app) => {
      if (gamesOnly && !app.isGame) return false;
      if (platformFilter === 'android' && app.platform !== 'android') return false;
      if (platformFilter === 'ios' && app.platform !== 'ios') return false;
      if (platformFilter === 'games' && !app.isGame) return false;
      if (selectedCategory !== 'All' && app.category !== selectedCategory) return false;
      if (q) {
        return (
          app.appName.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.developerName.toLowerCase().includes(q) ||
          app.category.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (sortBy === 'downloads') {
      list = [...list].sort((a, b) => b.downloadCount - a.downloadCount);
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    }
    return list;
  }, [approvedApps, gamesOnly, platformFilter, selectedCategory, search, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
      {gamesOnly ? (
        <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 relative min-h-[200px] md:min-h-[240px]">
          <img
            src={gamesArcadeBannerImg}
            alt="APPVERSE Games Arcade showcase"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover absolute inset-0"
          />
          <div className="relative z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-transparent p-6 md:p-10 flex flex-col justify-end min-h-[200px] md:min-h-[240px]">
            <p className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
              <Gamepad2 className="w-4 h-4" />
              APPVERSE Games Section
            </p>
            <h1 className="font-display text-2xl md:text-4xl font-bold text-white mt-1.5">
              Owner-Verified Mobile Games
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-xl">
              Browse approved Android and iOS games across Action, Strategy, Puzzle, and Indie Arcade categories.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Explore Applications
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Search and filter Owner-approved Android (APK/AAB) and iOS (IPA) releases.
          </p>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={gamesOnly ? 'Search approved games...' : 'Search by application name, developer, or keyword...'}
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'downloads' | 'rating')}
              aria-label="Sort applications"
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="recent">Recently Added</option>
              <option value="downloads">Most Downloaded</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {!gamesOnly && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Platforms' },
                  { id: 'android', label: 'Android' },
                  { id: 'ios', label: 'iOS' },
                  { id: 'games', label: 'Games' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setPlatformFilter(tab.id);
                    setSelectedCategory('All');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    platformFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {activeCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-2">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            No matching {gamesOnly ? 'games' : 'applications'} found
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try clearing your filters or check back once the Owner approves new submissions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <AppCard
              key={app.appId}
              app={app}
              onSelect={(id) => onNavigate({ name: 'app-details', appId: id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
