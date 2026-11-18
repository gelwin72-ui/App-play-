import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileWarning,
  Flag,
  Layers,
  Lock,
  Megaphone,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AdminSettingsRecord,
  ApplicationRecord,
  AppStatus,
  AuditLogRecord,
  DEFAULT_ADMIN_SETTINGS,
  DeletionRequestRecord,
  DownloadEventRecord,
  NotificationRecord,
  ReportRecord,
  ReviewRecord,
  TestingChecklist,
  UserAccount,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  ownerModerateApplication,
  ownerResolveDeletionRequest,
  ownerResolveReport,
  ownerToggleUserAccountStatus,
  publishAnnouncement,
  saveAdminSettings,
  seedDefaultCategoriesIfOwner,
  subscribeAllApplicationsForOwner,
  subscribeOwnerAuditLogs,
  subscribeOwnerDeletionRequests,
  subscribeOwnerDownloads,
  subscribeOwnerReports,
  subscribeOwnerTestReviews,
  subscribeOwnerUsers,
} from '../services/firestoreService';
import { downloadPackageForOwnerReview, resolveApprovedPackageDownloadUrl } from '../services/storageService';
import { formatBytes, formatTimestamp, getDateFromTimestamp } from '../utils/validation';
import { formatReadableFirebaseError } from '../firebase/errors';
import { AppIcon } from '../components/AppCard';

type DashboardTab =
  | 'overview'
  | 'submissions'
  | 'users'
  | 'analytics'
  | 'reports'
  | 'audit'
  | 'settings';

interface OwnerDashboardPageProps {
  ownerNotifications: NotificationRecord[];
  adminSettings: Omit<AdminSettingsRecord, 'updatedAt'>;
}

export function OwnerDashboardPage({
  ownerNotifications,
  adminSettings,
}: OwnerDashboardPageProps) {
  const { firebaseUser, isOwner } = useAuth();

  const [tab, setTab] = useState<DashboardTab>('overview');
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [downloads, setDownloads] = useState<DownloadEventRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [deletionReqs, setDeletionReqs] = useState<DeletionRequestRecord[]>([]);

  const [statusFilter, setStatusFilter] = useState<'ALL' | AppStatus>('ALL');
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [testReviews, setTestReviews] = useState<ReviewRecord[]>([]);

  // Testing Bench state
  const [checklist, setChecklist] = useState<TestingChecklist>({
    signatureVerified: false,
    manifestInspected: false,
    screenshotsReviewed: false,
    privacyPolicyChecked: false,
    manualInstallTested: false,
    testDevice: '',
    testOutcome: 'PASSED',
  });
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [featuredToggle, setFeaturedToggle] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // User search
  const [userSearch, setUserSearch] = useState('');

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annSeverity, setAnnSeverity] = useState<'INFO' | 'UPDATE' | 'WARNING'>('INFO');

  // Settings form
  const [settingsDraft, setSettingsDraft] = useState(adminSettings);

  useEffect(() => {
    setSettingsDraft(adminSettings);
  }, [adminSettings]);

  useEffect(() => {
    if (!isOwner) return;
    const onSubError = (err: unknown) => {
      setFeedback(formatReadableFirebaseError(err));
    };
    const u1 = subscribeAllApplicationsForOwner(setApps, onSubError);
    const u2 = subscribeOwnerUsers(setUsers, onSubError);
    const u3 = subscribeOwnerReports(setReports, onSubError);
    const u4 = subscribeOwnerDownloads(setDownloads, onSubError);
    const u5 = subscribeOwnerAuditLogs(setAuditLogs, onSubError);
    const u6 = subscribeOwnerDeletionRequests(setDeletionReqs, onSubError);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, [isOwner]);

  useEffect(() => {
    if (!selectedApp || !isOwner) {
      setTestReviews([]);
      return;
    }
    setChecklist(
      selectedApp.testingChecklist || {
        signatureVerified: Boolean(selectedApp.packageInspection?.valid),
        manifestInspected: Boolean(selectedApp.packageInspection?.hasManifest),
        screenshotsReviewed: false,
        privacyPolicyChecked: false,
        manualInstallTested: false,
        testDevice: '',
        testOutcome: 'PASSED',
      }
    );
    setReviewNotes(selectedApp.reviewNotes || '');
    setRejectionReason(selectedApp.rejectionReason || '');
    setFeaturedToggle(Boolean(selectedApp.featured));

    const unsub = subscribeOwnerTestReviews(selectedApp.appId, setTestReviews, (err) =>
      setFeedback(formatReadableFirebaseError(err))
    );
    return () => unsub();
  }, [selectedApp?.appId, isOwner]);

  const kpis = useMemo(() => {
    const activeUsers = users.filter((u) => u.accountStatus === 'ACTIVE').length;
    const pending = apps.filter((a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW').length;
    const approved = apps.filter((a) => a.status === 'APPROVED').length;
    const rejected = apps.filter((a) => a.status === 'REJECTED' || a.status === 'SUSPENDED').length;
    const totalDownloads = apps.reduce((sum, a) => sum + (a.downloadCount || 0), 0);
    return {
      totalUsers: users.length,
      activeUsers,
      totalApps: apps.length,
      pending,
      approved,
      rejected,
      totalDownloads,
      openReports: reports.filter((r) => r.status === 'OPEN' || r.status === 'INVESTIGATING').length,
    };
  }, [users, apps, reports]);

  const analytics = useMemo(() => {
    const now = Date.now();
    const dayMs = 86_400_000;
    const dailyRegs = users.filter((u) => {
      const d = getDateFromTimestamp(u.registrationDate);
      return d && now - d.getTime() <= dayMs;
    }).length;
    const weeklyRegs = users.filter((u) => {
      const d = getDateFromTimestamp(u.registrationDate);
      return d && now - d.getTime() <= 7 * dayMs;
    }).length;
    const monthlyRegs = users.filter((u) => {
      const d = getDateFromTimestamp(u.registrationDate);
      return d && now - d.getTime() <= 30 * dayMs;
    }).length;

    const categoryCounts = new Map<string, number>();
    for (const a of apps) {
      categoryCounts.set(a.category, (categoryCounts.get(a.category) || 0) + 1);
    }
    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const topDownloaded = [...apps]
      .filter((a) => a.status === 'APPROVED')
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .slice(0, 5);

    const formatBreakdown = {
      apk: apps.filter((a) => a.fileType === 'apk').length,
      aab: apps.filter((a) => a.fileType === 'aab').length,
      ipa: apps.filter((a) => a.fileType === 'ipa').length,
    };

    return {
      dailyRegs,
      weeklyRegs,
      monthlyRegs,
      topCategories,
      topDownloaded,
      formatBreakdown,
    };
  }, [users, apps]);

  const filteredApps = useMemo(() => {
    if (statusFilter === 'ALL') return apps;
    return apps.filter((a) => a.status === statusFilter);
  }, [apps, statusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  if (!isOwner || !firebaseUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            403 — Owner Authorization Required
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This console is restricted exclusively to the verified APPVERSE Platform Owner. Ordinary users cannot view submissions, PII, or moderation controls.
          </p>
        </div>
      </div>
    );
  }

  const handleModerate = async (decision: AppStatus) => {
    if (!selectedApp) return;
    if ((decision === 'REJECTED' || decision === 'SUSPENDED') && !rejectionReason.trim()) {
      setFeedback('Please provide a clear rejection or suspension reason before submitting.');
      return;
    }

    setActionBusy(true);
    setFeedback(null);
    try {
      let publicUrl = selectedApp.publicDownloadUrl;
      if (decision === 'APPROVED' && selectedApp.fileStoragePath.startsWith('vault/')) {
        publicUrl = `/api/storage/download/${encodeURIComponent(selectedApp.appId)}`;
      } else if (decision === 'APPROVED' && !publicUrl) {
        try {
          publicUrl = await resolveApprovedPackageDownloadUrl({
            appId: selectedApp.appId,
            fileStoragePath: selectedApp.fileStoragePath,
          });
        } catch {
          publicUrl = '';
        }
      }

      await ownerModerateApplication({
        app: selectedApp,
        reviewerId: firebaseUser.uid,
        reviewerEmail: firebaseUser.email || '',
        decision,
        rejectionReason: rejectionReason.trim(),
        reviewNotes: reviewNotes.trim(),
        testingChecklist: checklist,
        featured: featuredToggle,
        publicDownloadUrl: publicUrl,
      });
      setFeedback(`${selectedApp.appName} updated to ${decision}. Developer notified.`);
      setSelectedApp((prev) => (prev ? { ...prev, status: decision } : null));
    } catch (err) {
      setFeedback(formatReadableFirebaseError(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDownloadForTest = async (app: ApplicationRecord) => {
    setFeedback(null);
    try {
      await downloadPackageForOwnerReview({
        appId: app.appId,
        fileStoragePath: app.fileStoragePath,
        fileName: app.fileName,
      });
      setFeedback(`Downloaded ${app.fileName} for manual Owner security inspection.`);
    } catch (err) {
      setFeedback(formatReadableFirebaseError(err));
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await publishAnnouncement({
        title: annTitle,
        body: annBody,
        severity: annSeverity,
        ownerUid: firebaseUser.uid,
        ownerEmail: firebaseUser.email || '',
      });
      setAnnTitle('');
      setAnnBody('');
      setFeedback('Announcement published to all APPVERSE visitors.');
    } catch (err) {
      setFeedback(formatReadableFirebaseError(err));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      await saveAdminSettings(settingsDraft, firebaseUser.uid, firebaseUser.email || '');
      await seedDefaultCategoriesIfOwner();
      setFeedback('Platform upload limits & categories saved.');
    } catch (err) {
      setFeedback(formatReadableFirebaseError(err));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      {/* Console Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            APPVERSE Governance
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mt-1">
            Owner Dashboard &amp; Review Console
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'submissions', label: `Reviews (${kpis.pending})`, icon: ClipboardCheck },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'reports', label: `Reports (${kpis.openReports})`, icon: Flag },
              { id: 'audit', label: 'Audit & Alerts', icon: ShieldAlert },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  tab === item.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200">
          {feedback}
        </div>
      )}

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-500">Total Registered Users</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{kpis.totalUsers}</p>
              <p className="text-xs text-emerald-600 mt-1 tabular-nums">{kpis.activeUsers} active</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-500">Total Uploaded Apps</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{kpis.totalApps}</p>
              <p className="text-xs text-slate-500 mt-1 tabular-nums">{kpis.approved} live · {kpis.rejected} rejected</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-500">Pending Review Queue</p>
              <p className="text-2xl font-bold text-amber-600 mt-1 tabular-nums">{kpis.pending}</p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('PENDING');
                  setTab('submissions');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                Inspect queue
              </button>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-xs text-slate-500">Total Downloads</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {kpis.totalDownloads.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1 tabular-nums">{downloads.length} recorded events</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Awaiting Owner Review
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('submissions')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Open Testing Bench
                </button>
              </div>
              {apps.filter((a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW').length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No pending submissions right now.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {apps
                    .filter((a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW')
                    .slice(0, 5)
                    .map((app) => (
                      <div key={app.appId} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <AppIcon iconUrl={app.iconUrl} appName={app.appName} isGame={app.isGame} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {app.appName}
                            </p>
                            <p className="text-xs text-slate-500 truncate tabular-nums">
                              {app.platform.toUpperCase()} · {app.fileType.toUpperCase()} · v{app.version} · {app.developerName}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApp(app);
                            setTab('submissions');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium shrink-0"
                        >
                          Inspect
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Recent Audit Trail
              </h2>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No audit events recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditLogs.slice(0, 6).map((log) => (
                    <div key={log.logId} className="py-2.5 text-xs space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {log.action}
                        </span>
                        <span className="text-slate-400 tabular-nums">{formatTimestamp(log.createdAt)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 truncate">{log.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* SUBMISSIONS & TESTING BENCH TAB */}
      {tab === 'submissions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Submission List */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {filteredApps.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No submissions in this filter.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[650px] overflow-y-auto">
                {filteredApps.map((app) => (
                  <button
                    key={app.appId}
                    type="button"
                    onClick={() => setSelectedApp(app)}
                    className={`w-full text-left py-3 px-2.5 rounded-xl flex items-start gap-3 transition-colors ${
                      selectedApp?.appId === app.appId
                        ? 'bg-blue-50 dark:bg-blue-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <AppIcon iconUrl={app.iconUrl} appName={app.appName} isGame={app.isGame} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {app.appName}
                        </p>
                        <span className="text-[11px] font-mono font-semibold text-slate-500 shrink-0">
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate tabular-nums">
                        {app.platform.toUpperCase()} · {app.fileType.toUpperCase()} · v{app.version} · {formatBytes(app.fileSizeBytes)}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        by {app.developerName} · {formatTimestamp(app.uploadDate)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dedicated Application Testing & Review Interface */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            {!selectedApp ? (
              <div className="py-16 text-center space-y-2">
                <ClipboardCheck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Select an application to inspect &amp; test
                </p>
                <p className="text-xs text-slate-500">
                  Review package integrity, download builds for manual device testing, and record your approval decision.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <AppIcon iconUrl={selectedApp.iconUrl} appName={selectedApp.appName} isGame={selectedApp.isGame} />
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                        {selectedApp.appName}
                      </h2>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {selectedApp.developerName} ({selectedApp.developerId.slice(0, 8)}...) · v{selectedApp.version} · {selectedApp.status}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadForTest(selectedApp)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-2 hover:opacity-90 shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Download .{selectedApp.fileType.toUpperCase()} for Review
                  </button>
                </div>

                {/* Package Inspection & Platform Testing Guidance */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Binary Security &amp; Platform Testing Workflow
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    {selectedApp.fileType === 'apk'
                      ? 'APK Testing: Verify ZIP/APK signature and test manually on a sandboxed Android device or emulator. Never auto-install untrusted packages.'
                      : selectedApp.fileType === 'aab'
                        ? 'AAB Testing: AAB bundles cannot be installed directly on Android phones. Extract APKs with bundletool (bundletool build-apks) on your workstation.'
                        : 'IPA Testing: IPA installation depends on Apple code signing and provisioning profiles. Inspect Info.plist and test via authorized provisioning or Xcode.'}
                  </p>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 break-all">
                    <p>Storage Path: {selectedApp.fileStoragePath}</p>
                    <p>SHA-256: {selectedApp.fileSha256}</p>
                    <p>
                      Scan: {selectedApp.packageInspection?.malwareScanStatus || 'PENDING'} · Marker:{' '}
                      {selectedApp.packageInspection?.detectedPlatformMarker || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Description & Screenshots */}
                <div className="space-y-2 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Submitted Description</p>
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                    {selectedApp.description}
                  </p>
                  <p className="text-slate-500">
                    Support: {selectedApp.supportContact} {selectedApp.privacyPolicyUrl ? `· Privacy: ${selectedApp.privacyPolicyUrl}` : ''}
                  </p>
                </div>

                {selectedApp.screenshots && selectedApp.screenshots.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {selectedApp.screenshots.map((s, i) => (
                      <img
                        key={i}
                        src={s}
                        alt={`Screenshot ${i + 1}`}
                        referrerPolicy="no-referrer"
                        className="h-36 w-auto rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
                      />
                    ))}
                  </div>
                )}

                {/* Testing Checklist */}
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Owner Verification Checklist
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {(
                      [
                        ['signatureVerified', 'Binary signature & SHA-256 verified'],
                        ['manifestInspected', 'Manifest / Info.plist inspected'],
                        ['screenshotsReviewed', 'Screenshots & icon policy checked'],
                        ['privacyPolicyChecked', 'Support & privacy disclosures checked'],
                        ['manualInstallTested', 'Manual device / sandbox test completed'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={Boolean(checklist[key])}
                          onChange={(e) =>
                            setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                          className="rounded border-slate-300"
                        />
                        {label}
                      </label>
                    ))}
                    <label className="flex items-center gap-2 cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                      <input
                        type="checkbox"
                        checked={featuredToggle}
                        onChange={(e) => setFeaturedToggle(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <Star className="w-3.5 h-3.5" />
                      Feature on Homepage
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium mb-1">Test Device / Environment</label>
                      <input
                        type="text"
                        value={checklist.testDevice || ''}
                        onChange={(e) =>
                          setChecklist((prev) => ({ ...prev, testDevice: e.target.value }))
                        }
                        placeholder="Pixel 8 Android 15 / iPhone 15 iOS 18"
                        className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Testing Outcome</label>
                      <select
                        value={checklist.testOutcome || 'PASSED'}
                        onChange={(e) =>
                          setChecklist((prev) => ({
                            ...prev,
                            testOutcome: e.target.value as TestingChecklist['testOutcome'],
                          }))
                        }
                        className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                      >
                        <option value="PASSED">PASSED</option>
                        <option value="NEEDS_CHANGES">NEEDS CHANGES</option>
                        <option value="FAILED">FAILED</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Review &amp; Testing Notes</label>
                    <textarea
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Technical findings, compatibility observations..."
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Rejection / Suspension Reason (Required if rejecting or suspending)
                    </label>
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain policy violation or build error to developer..."
                      className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleModerate('UNDER_REVIEW')}
                      className="min-h-[40px] px-4 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                    >
                      Mark Under Review
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleModerate('APPROVED')}
                      className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve &amp; Publish
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleModerate('REJECTED')}
                      className="min-h-[40px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleModerate('SUSPENDED')}
                      className="min-h-[40px] px-4 rounded-xl border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold"
                    >
                      Suspend
                    </button>
                  </div>
                </div>

                {/* Test Log History */}
                {testReviews.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      Submission Testing History
                    </p>
                    {testReviews.map((tr) => (
                      <div key={tr.reviewId} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {tr.testOutcome} · {tr.testDevice || 'Owner Console'}
                          </span>
                          <span className="text-slate-400 tabular-nums">{formatTimestamp(tr.createdAt)}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{tr.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* USER MANAGEMENT TAB */}
      {tab === 'users' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Registered Users ({users.length})
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by username, email, or UID..."
                className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">User</th>
                  <th className="py-2.5 pr-4 font-medium">Email</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Uploads</th>
                  <th className="py-2.5 pr-4 font-medium">Registered</th>
                  <th className="py-2.5 pr-4 font-medium">Last Activity</th>
                  <th className="py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{u.displayName}</p>
                      <p className="font-mono text-[11px] text-slate-400">@{u.username} · {u.uid.slice(0, 8)}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{u.email}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`font-semibold ${
                          u.accountStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {u.accountStatus}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums font-medium">{u.uploadedCount}</td>
                    <td className="py-3 pr-4 tabular-nums text-slate-500">{formatTimestamp(u.registrationDate)}</td>
                    <td className="py-3 pr-4 tabular-nums text-slate-500">{formatTimestamp(u.lastActivity)}</td>
                    <td className="py-3 text-right">
                      {u.email.toLowerCase() !== firebaseUser.email?.toLowerCase() && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const next = u.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                              await ownerToggleUserAccountStatus({
                                user: u,
                                newStatus: next,
                                ownerUid: firebaseUser.uid,
                                ownerEmail: firebaseUser.email || '',
                              });
                              setFeedback(`Account ${u.email} set to ${next}.`);
                            } catch (err) {
                              setFeedback(formatReadableFirebaseError(err));
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            u.accountStatus === 'ACTIVE'
                              ? 'border border-red-200 dark:border-red-900 text-red-600'
                              : 'border border-emerald-200 dark:border-emerald-900 text-emerald-600'
                          }`}
                        >
                          {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Registrations (Last 24h)</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {analytics.dailyRegs}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Registrations (Last 7 Days)</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {analytics.weeklyRegs}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-500">Registrations (Last 30 Days)</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {analytics.monthlyRegs}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Popular Categories
              </h2>
              {analytics.topCategories.length === 0 ? (
                <p className="text-xs text-slate-500">No applications uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topCategories.map(([cat, count]) => {
                    const pct = apps.length ? Math.round((count / apps.length) * 100) : 0;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{cat}</span>
                          <span className="tabular-nums text-slate-500">{count} apps ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-slate-500">APK</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{analytics.formatBreakdown.apk}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-slate-500">AAB</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{analytics.formatBreakdown.aab}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-slate-500">IPA</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5">{analytics.formatBreakdown.ipa}</p>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Most Downloaded Applications
              </h2>
              {analytics.topDownloaded.length === 0 ? (
                <p className="text-xs text-slate-500">No approved downloads recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {analytics.topDownloaded.map((app) => (
                    <div key={app.appId} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{app.appName}</p>
                        <p className="text-slate-500">{app.platform.toUpperCase()} · {app.category}</p>
                      </div>
                      <span className="font-mono font-bold text-sm tabular-nums text-blue-600 dark:text-blue-400">
                        {app.downloadCount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* REPORTS & DELETION REQUESTS TAB */}
      {tab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-red-500" />
              Abuse &amp; Security Reports ({reports.length})
            </h2>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-500">No reports filed.</p>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div key={rep.reportId} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span>{rep.appName} · {rep.reason}</span>
                      <span className="text-amber-600">{rep.status}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{rep.details}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await ownerResolveReport({
                              report: rep,
                              status: 'RESOLVED',
                              resolutionNotes: 'Reviewed and handled by Owner.',
                              ownerUid: firebaseUser.uid,
                              ownerEmail: firebaseUser.email || '',
                            });
                            setFeedback(`Report for ${rep.appName} resolved.`);
                          } catch (err) {
                            setFeedback(formatReadableFirebaseError(err));
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-medium"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await ownerResolveReport({
                              report: rep,
                              status: 'DISMISSED',
                              resolutionNotes: 'No violation found.',
                              ownerUid: firebaseUser.uid,
                              ownerEmail: firebaseUser.email || '',
                            });
                            setFeedback(`Report for ${rep.appName} dismissed.`);
                          } catch (err) {
                            setFeedback(formatReadableFirebaseError(err));
                          }
                        }}
                        className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Developer Deletion Requests ({deletionReqs.length})
            </h2>
            {deletionReqs.length === 0 ? (
              <p className="text-xs text-slate-500">No deletion requests pending.</p>
            ) : (
              <div className="space-y-3">
                {deletionReqs.map((req) => (
                  <div key={req.requestId} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span>{req.appName}</span>
                      <span>{req.status}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{req.reason}</p>
                    {req.status === 'PENDING' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await ownerResolveDeletionRequest({
                                req,
                                decision: 'COMPLETED',
                                ownerUid: firebaseUser.uid,
                                ownerEmail: firebaseUser.email || '',
                              });
                              setFeedback(`Approved removal of ${req.appName}.`);
                            } catch (err) {
                              setFeedback(formatReadableFirebaseError(err));
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-red-600 text-white font-medium"
                        >
                          Approve &amp; Delete App
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await ownerResolveDeletionRequest({
                                req,
                                decision: 'DECLINED',
                                ownerUid: firebaseUser.uid,
                                ownerEmail: firebaseUser.email || '',
                              });
                              setFeedback(`Declined removal request for ${req.appName}.`);
                            } catch (err) {
                              setFeedback(formatReadableFirebaseError(err));
                            }
                          }}
                          className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* AUDIT & ANNOUNCEMENTS TAB */}
      {tab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handlePublishAnnouncement}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 h-fit"
          >
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-600" />
              Publish Owner Announcement
            </h2>
            <div>
              <label className="block text-xs font-medium mb-1">Title</label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Platform Maintenance or Policy Update"
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Severity</label>
              <select
                value={annSeverity}
                onChange={(e) => setAnnSeverity(e.target.value as 'INFO' | 'UPDATE' | 'WARNING')}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="INFO">Info</option>
                <option value="UPDATE">Update</option>
                <option value="WARNING">Warning</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Announcement Body</label>
              <textarea
                required
                rows={3}
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-[40px] rounded-xl bg-blue-600 text-white text-xs font-medium"
            >
              Broadcast Announcement
            </button>
          </form>

          <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Owner Notifications ({ownerNotifications.length}) &amp; Immutable Audit Logs ({auditLogs.length})
            </h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <div key={log.logId} className="pt-2.5 text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {log.action} · {log.targetType}
                    </span>
                    <span className="text-slate-400 tabular-nums">{formatTimestamp(log.createdAt)}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{log.details}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Actor: {log.actorEmail || log.actorId}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* PLATFORM SETTINGS TAB */}
      {tab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 max-w-2xl"
        >
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Configurable Free-Tier Limits &amp; Security Policy
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Control maximum upload file sizes and per-user quotas to stay within Firebase free-tier limits.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium mb-1">Max APK Size (MB)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={settingsDraft.maxApkSizeMb}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, maxApkSizeMb: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Max AAB Size (MB)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={settingsDraft.maxAabSizeMb}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, maxAabSizeMb: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Max IPA Size (MB)</label>
              <input
                type="number"
                min={1}
                max={500}
                value={settingsDraft.maxIpaSizeMb}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, maxIpaSizeMb: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Max Icon (MB)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settingsDraft.maxIconSizeMb}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, maxIconSizeMb: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Max Screenshot (MB)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={settingsDraft.maxScreenshotSizeMb}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, maxScreenshotSizeMb: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Max Apps / User</label>
              <input
                type="number"
                min={1}
                max={100}
                value={settingsDraft.maxAppsPerUser}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, maxAppsPerUser: Number(e.target.value) })}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settingsDraft.allowGuestDownloads}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, allowGuestDownloads: e.target.checked })
                }
              />
              Allow guest visitors to download approved applications without signing in
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="min-h-[42px] px-5 rounded-xl bg-blue-600 text-white text-xs font-semibold"
            >
              Save Settings &amp; Sync Categories
            </button>
            <button
              type="button"
              onClick={() => setSettingsDraft(DEFAULT_ADMIN_SETTINGS)}
              className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
            >
              Reset Defaults
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
