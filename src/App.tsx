import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SplashScreen } from './components/SplashScreen';
import { TopBar } from './navigation/TopBar';
import { BottomNav } from './navigation/BottomNav';
import { DrawerMenu } from './components/DrawerMenu';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { AppDetailsPage } from './pages/AppDetailsPage';
import { DeveloperProfilePage } from './pages/DeveloperProfilePage';
import { UploadPage } from './pages/UploadPage';
import { MyAppsPage } from './pages/MyAppsPage';
import { ProfilePage } from './pages/ProfilePage';
import { InfoPages } from './pages/InfoPages';
import { OwnerDashboardPage } from './admin/OwnerDashboardPage';
import {
  AdminSettingsRecord,
  AnnouncementRecord,
  ApplicationRecord,
  AppRoute,
  CategoryRecord,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_CATEGORIES,
  NotificationRecord,
} from './types';
import {
  subscribeAdminSettings,
  subscribeAnnouncements,
  subscribeApprovedApplications,
  subscribeCategories,
  subscribeDeveloperApplications,
  subscribeNotificationsForUser,
} from './services/firestoreService';

function parseHashToRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash || hash === 'home') return { name: 'home' };
  if (hash === 'explore') return { name: 'explore' };
  if (hash === 'games') return { name: 'games' };
  if (hash === 'upload') return { name: 'upload' };
  if (hash === 'my-apps') return { name: 'my-apps' };
  if (hash === 'profile') return { name: 'profile' };
  if (hash === 'owner') return { name: 'owner' };
  if (hash === 'settings') return { name: 'settings' };
  if (hash === 'privacy') return { name: 'privacy' };
  if (hash === 'terms') return { name: 'terms' };
  if (hash === 'about') return { name: 'about' };
  if (hash === 'help') return { name: 'help' };
  if (hash === 'contact') return { name: 'contact' };
  if (hash.startsWith('app/')) return { name: 'app-details', appId: hash.slice(4) };
  if (hash.startsWith('developer/')) return { name: 'developer', developerId: hash.slice(10) };
  return { name: 'home' };
}

function routeToHash(route: AppRoute): string {
  switch (route.name) {
    case 'app-details':
      return `#/app/${route.appId}`;
    case 'developer':
      return `#/developer/${route.developerId}`;
    default:
      return `#/${route.name}`;
  }
}

function AppShell() {
  const { firebaseUser, isAuthReady, isOwner } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [route, setRoute] = useState<AppRoute>(() => parseHashToRoute());
  const [historyStack, setHistoryStack] = useState<AppRoute[]>([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const [approvedApps, setApprovedApps] = useState<ApplicationRecord[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [myApps, setMyApps] = useState<ApplicationRecord[]>([]);
  const [loadingMyApps, setLoadingMyApps] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>(DEFAULT_CATEGORIES);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [adminSettings, setAdminSettings] =
    useState<Omit<AdminSettingsRecord, 'updatedAt'>>(DEFAULT_ADMIN_SETTINGS);

  const [userNotifs, setUserNotifs] = useState<NotificationRecord[]>([]);
  const [ownerNotifs, setOwnerNotifs] = useState<NotificationRecord[]>([]);

  // Browser back/forward button sync
  useEffect(() => {
    const onPopState = () => {
      setRoute(parseHashToRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback(
    (next: AppRoute) => {
      setHistoryStack((prev) => [...prev.slice(-15), route]);
      setRoute(next);
      const nextHash = routeToHash(next);
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, '', nextHash);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [route]
  );

  const goBack = useCallback(() => {
    if (historyStack.length > 0) {
      window.history.back();
    } else {
      navigate({ name: 'home' });
    }
  }, [historyStack.length, navigate]);

  // Public Firestore real-time subscriptions (available to guests & signed-in users)
  useEffect(() => {
    setLoadingApps(true);
    const unsubApps = subscribeApprovedApplications(
      (apps) => {
        setApprovedApps(apps);
        setLoadingApps(false);
      },
      () => setLoadingApps(false)
    );
    const unsubCats = subscribeCategories(setCategories);
    const unsubAnn = subscribeAnnouncements(setAnnouncements);
    const unsubSettings = subscribeAdminSettings(setAdminSettings);
    return () => {
      unsubApps();
      unsubCats();
      unsubAnn();
      unsubSettings();
    };
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Authenticated user subscriptions
  useEffect(() => {
    if (!isAuthReady || !firebaseUser) {
      setMyApps([]);
      setUserNotifs([]);
      return;
    }
    setLoadingMyApps(true);
    const unsubMy = subscribeDeveloperApplications(
      firebaseUser.uid,
      (apps) => {
        setMyApps(apps);
        setLoadingMyApps(false);
      },
      () => setLoadingMyApps(false)
    );
    const unsubNotif = subscribeNotificationsForUser(
      firebaseUser.uid,
      setUserNotifs,
      (err) => console.warn('Notifications listener fallback:', err)
    );
    return () => {
      unsubMy();
      unsubNotif();
    };
  }, [isAuthReady, firebaseUser]);

  // Owner notifications subscription
  useEffect(() => {
    if (!isAuthReady || !isOwner) {
      setOwnerNotifs([]);
      return;
    }
    return subscribeNotificationsForUser(
      'OWNER',
      setOwnerNotifs,
      (err) => console.warn('Owner notifications listener fallback:', err)
    );
  }, [isAuthReady, isOwner]);

  const combinedNotifications = useMemo(() => {
    const map = new Map<string, NotificationRecord>();
    for (const n of [...ownerNotifs, ...userNotifs]) {
      map.set(n.notificationId, n);
    }
    return Array.from(map.values());
  }, [ownerNotifs, userNotifs]);

  const unreadCount = useMemo(
    () => combinedNotifications.filter((n) => !n.read).length,
    [combinedNotifications]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 pb-[72px] md:pb-0">
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      <TopBar
        currentRoute={route}
        onNavigate={navigate}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        unreadCount={unreadCount}
      />

      <main className="flex-1">
        {route.name === 'home' && (
          <HomePage
            approvedApps={approvedApps}
            categories={categories}
            announcements={announcements}
            loading={loadingApps}
            onNavigate={navigate}
            onOpenAuth={() => setAuthOpen(true)}
            isSignedIn={Boolean(firebaseUser)}
          />
        )}

        {route.name === 'explore' && (
          <ExplorePage
            approvedApps={approvedApps}
            categories={categories}
            loading={loadingApps}
            initialFilter={route.initialFilter}
            initialCategory={route.initialCategory}
            onNavigate={navigate}
          />
        )}

        {route.name === 'games' && (
          <ExplorePage
            approvedApps={approvedApps}
            categories={categories}
            loading={loadingApps}
            gamesOnly
            onNavigate={navigate}
          />
        )}

        {route.name === 'upload' && (
          <UploadPage
            categories={categories}
            adminSettings={adminSettings}
            myAppsCount={myApps.length}
            onNavigate={navigate}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}

        {route.name === 'my-apps' && (
          <MyAppsPage
            myApps={myApps}
            categories={categories}
            loading={loadingMyApps}
            onNavigate={navigate}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}

        {route.name === 'profile' && (
          <ProfilePage
            myApps={myApps}
            onNavigate={navigate}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}

        {route.name === 'app-details' && (
          <AppDetailsPage
            appId={route.appId}
            allowGuestDownloads={adminSettings.allowGuestDownloads}
            onNavigate={navigate}
            onBack={goBack}
            onOpenAuth={() => setAuthOpen(true)}
          />
        )}

        {route.name === 'developer' && (
          <DeveloperProfilePage
            developerId={route.developerId}
            onNavigate={navigate}
            onBack={goBack}
          />
        )}

        {route.name === 'owner' && (
          <OwnerDashboardPage
            ownerNotifications={ownerNotifs}
            adminSettings={adminSettings}
          />
        )}

        {(route.name === 'settings' ||
          route.name === 'privacy' ||
          route.name === 'terms' ||
          route.name === 'about' ||
          route.name === 'help' ||
          route.name === 'contact') && (
          <InfoPages page={route.name} onBack={goBack} onNavigate={navigate} />
        )}
      </main>

      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>APPVERSE · Free Android &amp; iOS Application Publishing Platform</p>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => navigate({ name: 'about' })} className="hover:text-slate-900 dark:hover:text-white">
              About
            </button>
            <button type="button" onClick={() => navigate({ name: 'privacy' })} className="hover:text-slate-900 dark:hover:text-white">
              Privacy Policy
            </button>
            <button type="button" onClick={() => navigate({ name: 'terms' })} className="hover:text-slate-900 dark:hover:text-white">
              Terms
            </button>
            <button type="button" onClick={() => navigate({ name: 'help' })} className="hover:text-slate-900 dark:hover:text-white">
              Help
            </button>
            <button type="button" onClick={() => navigate({ name: 'contact' })} className="hover:text-slate-900 dark:hover:text-white">
              Contact Owner
            </button>
          </div>
        </div>
      </footer>

      <BottomNav currentRoute={route} onNavigate={navigate} />

      <DrawerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigate}
        onOpenNotifications={() => setNotifOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        unreadNotifications={unreadCount}
      />

      <NotificationsDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={combinedNotifications}
        announcements={announcements}
        onOpenApp={(appId) => navigate({ name: 'app-details', appId })}
      />

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
