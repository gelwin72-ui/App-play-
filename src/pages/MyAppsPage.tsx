import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Lock,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ApplicationRecord, AppRoute, AppStatus, CategoryRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { AppIcon } from '../components/AppCard';
import { formatBytes, formatTimestamp, validateAppMetadataInput } from '../utils/validation';
import {
  deleteUnpublishedApp,
  requestApprovedAppDeletion,
  updateDeveloperAppMetadata,
} from '../services/firestoreService';
import { formatReadableFirebaseError } from '../firebase/errors';

interface MyAppsPageProps {
  myApps: ApplicationRecord[];
  categories: CategoryRecord[];
  loading: boolean;
  onNavigate: (route: AppRoute) => void;
  onOpenAuth: () => void;
}

export function MyAppsPage({
  myApps,
  categories,
  loading,
  onNavigate,
  onOpenAuth,
}: MyAppsPageProps) {
  const { firebaseUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'ALL' | AppStatus>('ALL');
  const [editingApp, setEditingApp] = useState<ApplicationRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSupport, setEditSupport] = useState('');
  const [editPrivacy, setEditPrivacy] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ApplicationRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const stats = useMemo(() => {
    return {
      total: myApps.length,
      pending: myApps.filter((a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW').length,
      approved: myApps.filter((a) => a.status === 'APPROVED').length,
      rejected: myApps.filter((a) => a.status === 'REJECTED' || a.status === 'SUSPENDED').length,
      downloads: myApps.reduce((acc, a) => acc + (a.downloadCount || 0), 0),
    };
  }, [myApps]);

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return myApps;
    return myApps.filter((a) => a.status === statusFilter);
  }, [myApps, statusFilter]);

  if (!firebaseUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <Lock className="w-10 h-10 text-blue-600 mx-auto" />
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Sign in to View My Apps
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Track pending Owner reviews, edit application details, and monitor live download counts.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const openEdit = (app: ApplicationRecord) => {
    setEditingApp(app);
    setEditName(app.appName);
    setEditVersion(app.version);
    setEditCategory(app.category);
    setEditDescription(app.description);
    setEditSupport(app.supportContact);
    setEditPrivacy(app.privacyPolicyUrl || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;
    const err = validateAppMetadataInput({
      appName: editName,
      description: editDescription,
      version: editVersion,
      category: editCategory,
      supportContact: editSupport,
      privacyPolicyUrl: editPrivacy,
    });
    if (err) {
      setEditError(err);
      return;
    }
    setSavingEdit(true);
    try {
      await updateDeveloperAppMetadata(editingApp.appId, {
        appName: editName,
        description: editDescription,
        category: editCategory,
        isGame: editingApp.isGame,
        version: editVersion,
        privacyPolicyUrl: editPrivacy,
        supportContact: editSupport,
      });
      setEditingApp(null);
      setFeedback('Application metadata updated.');
    } catch (e2) {
      setEditError(formatReadableFirebaseError(e2));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    try {
      if (deleteTarget.status === 'PENDING' || deleteTarget.status === 'REJECTED') {
        await deleteUnpublishedApp(deleteTarget.appId);
        setFeedback(`Deleted ${deleteTarget.appName}.`);
      } else {
        await requestApprovedAppDeletion({
          appId: deleteTarget.appId,
          appName: deleteTarget.appName,
          developerId: firebaseUser.uid,
          reason: deleteReason,
        });
        setFeedback(`Deletion request sent to Owner for ${deleteTarget.appName}.`);
      }
      setDeleteTarget(null);
      setDeleteReason('');
    } catch (err) {
      setFeedback(formatReadableFirebaseError(err));
    }
  };

  const renderStatus = (status: AppStatus) => {
    if (status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approved
        </span>
      );
    }
    if (status === 'REJECTED' || status === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
          <XCircle className="w-3.5 h-3.5" />
          {status === 'REJECTED' ? 'Rejected' : 'Suspended'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5" />
        {status === 'UNDER_REVIEW' ? 'Under Review' : 'Pending Review'}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            My Applications
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage submissions, inspect Owner feedback, and track live downloads.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'upload' })}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Upload
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Uploaded</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">In Owner Review</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Approved Live</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{stats.approved}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Downloads</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {stats.downloads.toLocaleString()}
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300">
          {feedback}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto w-fit">
        {(['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === st
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            No applications in this status
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload your first APK, AAB, or IPA release to begin Owner verification.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => (
            <div
              key={app.appId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <AppIcon iconUrl={app.iconUrl} appName={app.appName} isGame={app.isGame} />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                        {app.appName}
                      </h3>
                      {renderStatus(app.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{app.platform.toUpperCase()}</span>
                      <span>·</span>
                      <span className="font-mono uppercase">{app.fileType}</span>
                      <span>·</span>
                      <span>v{app.version}</span>
                      <span>·</span>
                      <span>{formatBytes(app.fileSizeBytes)}</span>
                      <span>·</span>
                      <span>Uploaded {formatTimestamp(app.uploadDate)}</span>
                      <span>·</span>
                      <span>{app.downloadCount} downloads</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate({ name: 'app-details', appId: app.appId })}
                    className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                  {app.status !== 'SUSPENDED' && (
                    <button
                      type="button"
                      onClick={() => openEdit(app)}
                      className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(app);
                      setDeleteReason('');
                    }}
                    className="min-h-[38px] px-3 rounded-xl border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-600 dark:text-red-400 inline-flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {app.status === 'PENDING' || app.status === 'REJECTED' ? 'Delete' : 'Request Removal'}
                  </button>
                </div>
              </div>

              {(app.rejectionReason || app.reviewNotes) && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  {app.rejectionReason && (
                    <p className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Reason: {app.rejectionReason}
                    </p>
                  )}
                  {app.reviewNotes && (
                    <p className="text-slate-600 dark:text-slate-300">
                      Owner Notes: {app.reviewNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Edit {editingApp.appName}
            </h3>
            {editError && <p className="text-xs text-red-600 dark:text-red-400">{editError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">App Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Version</label>
                <input
                  type="text"
                  required
                  value={editVersion}
                  onChange={(e) => setEditVersion(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Description</label>
              <textarea
                rows={4}
                required
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Support Contact</label>
                <input
                  type="text"
                  required
                  value={editSupport}
                  onChange={(e) => setEditSupport(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Privacy URL</label>
                <input
                  type="url"
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete / Removal Request Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleDeleteConfirm}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {deleteTarget.status === 'PENDING' || deleteTarget.status === 'REJECTED'
                ? `Delete ${deleteTarget.appName}?`
                : `Request Removal for ${deleteTarget.appName}`}
            </h3>
            {deleteTarget.status === 'PENDING' || deleteTarget.status === 'REJECTED' ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                This will permanently remove your unpublished submission from APPVERSE.
              </p>
            ) : (
              <div>
                <label className="block text-xs font-medium mb-1">Reason for removal request</label>
                <textarea
                  required
                  minLength={4}
                  maxLength={600}
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Explain why this approved listing should be removed..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-medium"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
