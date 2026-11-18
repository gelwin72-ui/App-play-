import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Compass,
  Gamepad2,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  AnnouncementRecord,
  ApplicationRecord,
  AppRoute,
  CategoryRecord,
} from '../types';
import { AppCard } from '../components/AppCard';
import heroShowcaseImg from '../assets/images/hero_appverse_showcase_1795018728136.jpg';
import devUploadStudioImg from '../assets/images/dev_upload_studio_1795018728351.jpg';

interface HomePageProps {
  approvedApps: ApplicationRecord[];
  categories: CategoryRecord[];
  announcements: AnnouncementRecord[];
  loading: boolean;
  onNavigate: (route: AppRoute) => void;
  onOpenAuth: () => void;
  isSignedIn: boolean;
}

export function HomePage({
  approvedApps,
  categories,
  announcements,
  loading,
  onNavigate,
  onOpenAuth,
  isSignedIn,
}: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showGuide, setShowGuide] = useState(() => localStorage.getItem('appverse_guide_dismissed') !== '1');

  const featuredApps = useMemo(
    () => approvedApps.filter((a) => a.featured).slice(0, 6),
    [approvedApps]
  );

  const recentlyApproved = useMemo(() => approvedApps.slice(0, 6), [approvedApps]);

  const popularApps = useMemo(
    () => [...approvedApps].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 6),
    [approvedApps]
  );

  const recommendedApps = useMemo(() => {
    const rated = [...approvedApps].sort(
      (a, b) => (b.averageRating || 0) - (a.averageRating || 0)
    );
    return rated.slice(0, 4);
  }, [approvedApps]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return approvedApps.filter(
      (a) =>
        a.appName.toLowerCase().includes(q) ||
        a.developerName.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [approvedApps, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate({ name: 'explore', initialFilter: 'all' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-10">
      {/* Live Owner Announcements */}
      {announcements.length > 0 && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/25 p-4 flex items-start gap-3">
          <Megaphone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {announcements[0].title}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              {announcements[0].body}
            </p>
          </div>
        </div>
      )}

      {/* Hero Split Showcase */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Free Android &amp; iOS Publishing · Owner-Verified Security Review
            </p>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Publish and discover verified mobile applications.
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Upload APK, AAB, and IPA builds for free within platform quotas. Every submission stays private until inspected and approved by the APPVERSE Owner.
            </p>
          </div>

          <div className="space-y-4">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search approved apps, games, or developers..."
                aria-label="Search applications"
                className="w-full min-h-[48px] pl-11 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => (isSignedIn ? onNavigate({ name: 'upload' }) : onOpenAuth())}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Submit Application
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ name: 'explore' })}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Compass className="w-4 h-4" />
                Browse Catalog
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 relative min-h-[240px]">
          <img
            src={heroShowcaseImg}
            alt="Minimalist smartphones showcasing APPVERSE marketplace applications"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent flex flex-col justify-end p-6">
            <p className="text-xs font-medium text-slate-300">
              APK · AAB · IPA Validation
            </p>
            <p className="font-display text-lg font-semibold text-white mt-1">
              Cryptographic binary checks before every release goes public.
            </p>
          </div>
        </div>
      </section>

      {/* Live Quick Search Results */}
      {searchQuery.trim() && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              Search Results ({searchResults.length})
            </h2>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear search
            </button>
          </div>
          {searchResults.length === 0 ? (
            <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-sm text-slate-500 dark:text-slate-400">
              No approved applications matched "{searchQuery}". Only Owner-approved apps appear in public search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((app) => (
                <AppCard key={app.appId} app={app} onSelect={(id) => onNavigate({ name: 'app-details', appId: id })} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Optional First-Visit Workflow Guide */}
      {showGuide && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">01. Upload Package</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Sign in with a verified account to submit APK, AAB, or IPA builds for free.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">02. Owner Review</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Unpublished binaries stay private while inspected for manifest &amp; security integrity.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">03. Public Release</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Once approved, apps appear in Storefront Search, Categories, and Games.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('appverse_guide_dismissed', '1');
                setShowGuide(false);
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white whitespace-nowrap self-start md:self-center"
            >
              Dismiss guide
            </button>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Browse Categories
          </h2>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'games' })}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            Games Arcade
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.slice(0, 12).map((cat) => (
            <button
              key={cat.categoryId}
              type="button"
              onClick={() =>
                onNavigate({
                  name: 'explore',
                  initialFilter: cat.type === 'game' ? 'games' : 'all',
                  initialCategory: cat.name,
                })
              }
              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500/60 text-left transition-colors"
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                {cat.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                {cat.type}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Main Catalog Sections */}
      {loading ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-pulse"
            />
          ))}
        </section>
      ) : approvedApps.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 md:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[4/3]">
            <img
              src={devUploadStudioImg}
              alt="Developer upload studio workspace"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:col-span-7 space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              No public applications approved yet
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              APPVERSE displays real, Owner-approved applications from Cloud Firestore rather than synthetic placeholders. Be the first developer to upload an APK, AAB, or IPA release for review.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => (isSignedIn ? onNavigate({ name: 'upload' }) : onOpenAuth())}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload First App
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {featuredApps.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                  Featured Applications
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'explore' })}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredApps.map((app) => (
                  <AppCard
                    key={app.appId}
                    app={app}
                    onSelect={(id) => onNavigate({ name: 'app-details', appId: id })}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Recently Approved Apps
              </h2>
              <button
                type="button"
                onClick={() => onNavigate({ name: 'explore' })}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Explore all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentlyApproved.map((app) => (
                <AppCard
                  key={app.appId}
                  app={app}
                  onSelect={(id) => onNavigate({ name: 'app-details', appId: id })}
                />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                Popular Apps
              </h2>
              <div className="space-y-3">
                {popularApps.map((app) => (
                  <AppCard
                    key={app.appId}
                    app={app}
                    compact
                    onSelect={(id) => onNavigate({ name: 'app-details', appId: id })}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Recommended Applications
              </h2>
              <div className="space-y-3">
                {recommendedApps.map((app) => (
                  <AppCard
                    key={app.appId}
                    app={app}
                    compact
                    onSelect={(id) => onNavigate({ name: 'app-details', appId: id })}
                  />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
