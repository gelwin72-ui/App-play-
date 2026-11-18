import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Flag,
  Info,
  ShieldCheck,
  Star,
  User,
} from 'lucide-react';
import { ApplicationRecord, AppRoute, ReviewRecord, ReportRecord } from '../types';
import {
  recordApprovedDownload,
  subscribeSingleApplication,
  subscribeUserReviews,
  submitAbuseReport,
  submitUserReview,
} from '../services/firestoreService';
import { resolveApprovedPackageDownloadUrl } from '../services/storageService';
import { formatBytes, formatTimestamp } from '../utils/validation';
import { AppIcon } from '../components/AppCard';
import { useAuth } from '../contexts/AuthContext';
import { formatReadableFirebaseError } from '../firebase/errors';

interface AppDetailsPageProps {
  appId: string;
  allowGuestDownloads: boolean;
  onNavigate: (route: AppRoute) => void;
  onBack: () => void;
  onOpenAuth: () => void;
}

export function AppDetailsPage({
  appId,
  allowGuestDownloads,
  onNavigate,
  onBack,
  onOpenAuth,
}: AppDetailsPageProps) {
  const { firebaseUser, userProfile, isVerified } = useAuth();
  const [app, setApp] = useState<ApplicationRecord | null>(null);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  // User review state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportRecord['reason']>('MISLEADING');
  const [reportDetails, setReportDetails] = useState('');
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubApp = subscribeSingleApplication(
      appId,
      (loaded) => {
        setApp(loaded);
        setLoading(false);
      },
      (err) => {
        setError(formatReadableFirebaseError(err));
        setLoading(false);
      }
    );

    const unsubRev = subscribeUserReviews(appId, setReviews);
    return () => {
      unsubApp();
      unsubRev();
    };
  }, [appId]);

  const handleDownload = async () => {
    if (!app) return;
    if (app.status !== 'APPROVED') {
      setDownloadMsg('Unpublished packages cannot be downloaded publicly before Owner approval.');
      return;
    }
    if (!allowGuestDownloads && !firebaseUser) {
      onOpenAuth();
      return;
    }
    setDownloading(true);
    setDownloadMsg(null);
    try {
      const url = await resolveApprovedPackageDownloadUrl({
        appId: app.appId,
        fileStoragePath: app.fileStoragePath,
        publicDownloadUrl: app.publicDownloadUrl,
      });

      await recordApprovedDownload(app, firebaseUser?.uid);

      const link = document.createElement('a');
      link.href = url;
      link.download = app.fileName;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();

      setDownloadMsg(`Download started for ${app.fileName} (${formatBytes(app.fileSizeBytes)}).`);
    } catch (err) {
      setDownloadMsg(formatReadableFirebaseError(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || !firebaseUser) return;
    setReviewFeedback(null);
    setSubmittingReview(true);
    try {
      await submitUserReview({
        app,
        authorId: firebaseUser.uid,
        authorName: userProfile?.displayName || firebaseUser.displayName || 'APPVERSE User',
        rating,
        comment,
      });
      setComment('');
      setReviewFeedback('Your review has been published.');
    } catch (err) {
      setReviewFeedback(formatReadableFirebaseError(err));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || !firebaseUser) return;
    setReportFeedback(null);
    try {
      await submitAbuseReport({
        app,
        reporterId: firebaseUser.uid,
        reason: reportReason,
        details: reportDetails,
      });
      setReportDetails('');
      setReportFeedback('Report submitted to the APPVERSE Owner for investigation.');
      setTimeout(() => setShowReportModal(false), 1200);
    } catch (err) {
      setReportFeedback(formatReadableFirebaseError(err));
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 space-y-6">
        <div className="h-32 rounded-3xl bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
        <div className="h-64 rounded-3xl bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Application Unavailable
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {error || 'This application either does not exist or is awaiting Owner approval.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-sm font-medium inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header Dossier */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <AppIcon iconUrl={app.iconUrl} appName={app.appName} isGame={app.isGame} size="lg" />
            <div className="space-y-2">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                {app.appName}
              </h1>
              <button
                type="button"
                onClick={() => onNavigate({ name: 'developer', developerId: app.developerId })}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <User className="w-3.5 h-3.5" />
                {app.developerName}
              </button>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span>{app.platform === 'android' ? 'Android' : 'iOS'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono uppercase">{app.fileType}</span>
                <span aria-hidden="true">·</span>
                <span>v{app.version}</span>
                <span aria-hidden="true">·</span>
                <span>{app.category}</span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(app.fileSizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>{app.downloadCount.toLocaleString()} downloads</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-3 shrink-0">
            {app.status === 'APPROVED' ? (
              <button
                type="button"
                disabled={downloading}
                onClick={handleDownload}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Preparing Package...' : `Download .${app.fileType.toUpperCase()}`}
              </button>
            ) : (
              <span className="px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-medium text-amber-800 dark:text-amber-300">
                Status: {app.status} (Private)
              </span>
            )}

            {firebaseUser && isVerified && app.status === 'APPROVED' && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400 inline-flex items-center gap-1.5 self-center md:self-end"
              >
                <Flag className="w-3.5 h-3.5" />
                Report issue or abuse
              </button>
            )}
          </div>
        </div>

        {downloadMsg && (
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{downloadMsg}</span>
          </div>
        )}

        {/* Platform Installation & Limitation Disclosure */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1">
            {app.fileType === 'apk' && (
              <p>
                <strong>Android APK Package:</strong> Compatible Android devices can install this APK manually after enabling &ldquo;Install unknown apps&rdquo; in Android settings. APPVERSE never auto-installs binaries.
              </p>
            )}
            {app.fileType === 'aab' && (
              <p>
                <strong>Android App Bundle (AAB):</strong> AAB files are publishing bundles rather than standalone installers. Use Android Studio, <code className="font-mono">bundletool</code>, or Google Play internal testing to generate device APKs.
              </p>
            )}
            {app.fileType === 'ipa' && (
              <p>
                <strong>iOS IPA Archive:</strong> Installing IPA packages on iOS requires Apple code signing, matching provisioning profiles, or authorized sideloading/TestFlight workflows. Compatibility depends on device architecture and iOS version.
              </p>
            )}
            <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">
              SHA-256: {app.fileSha256}
            </p>
          </div>
        </div>
      </section>

      {/* Screenshots */}
      {app.screenshots && app.screenshots.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Screenshots
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {app.screenshots.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${app.appName} screenshot ${i + 1}`}
                referrerPolicy="no-referrer"
                className="h-64 w-auto rounded-2xl border border-slate-200 dark:border-slate-800 object-cover shrink-0 bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        </section>
      )}

      {/* Description & Security Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            About this {app.isGame ? 'game' : 'application'}
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
            {app.description}
          </p>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Release Details
          </h2>
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Published</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-200 tabular-nums">
                {formatTimestamp(app.reviewDate || app.uploadDate)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Package Integrity</dt>
              <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                {app.packageInspection?.malwareScanStatus || 'VERIFIED'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Support Contact</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-200 truncate max-w-[180px]">
                {app.supportContact}
              </dd>
            </div>
            {app.privacyPolicyUrl && (
              <div className="pt-1">
                <a
                  href={app.privacyPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Developer Privacy Policy
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </dl>
        </section>
      </div>

      {/* Ratings & Reviews */}
      {app.status === 'APPROVED' && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                User Reviews
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {app.ratingCount || 0} ratings · Average {(app.averageRating || 0).toFixed(1)} / 5
              </p>
            </div>
          </div>

          {firebaseUser && isVerified ? (
            <form onSubmit={handleSubmitReview} className="space-y-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Rating:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                required
                minLength={2}
                maxLength={1500}
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with functionality, stability, and UI..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex items-center justify-between gap-3">
                {reviewFeedback ? (
                  <span className="text-xs text-blue-600 dark:text-blue-400">{reviewFeedback}</span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {submittingReview ? 'Posting...' : 'Post Review'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between gap-3">
              <span>Sign in with a verified account to leave a review.</span>
              {!firebaseUser && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline whitespace-nowrap"
                >
                  Sign In
                </button>
              )}
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No reviews submitted yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {reviews.map((rev) => (
                <div key={rev.reviewId} className="py-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {rev.authorName}
                    </span>
                    <span className="text-slate-400 tabular-nums">{formatTimestamp(rev.createdAt)}</span>
                  </div>
                  {rev.rating && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= rev.rating! ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-slate-700 dark:text-slate-300">{rev.comment}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Report {app.appName}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Reason
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportRecord['reason'])}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              >
                <option value="MALWARE">Malware or Security Risk</option>
                <option value="COPYRIGHT">Copyright / Trademark Infringement</option>
                <option value="MISLEADING">Misleading Metadata</option>
                <option value="BROKEN_BINARY">Corrupted or Broken Package</option>
                <option value="INAPPROPRIATE">Inappropriate Content</option>
                <option value="OTHER">Other Policy Issue</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Details
              </label>
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={4}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Describe the issue clearly for the Owner security team..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
            {reportFeedback && (
              <p className="text-xs text-blue-600 dark:text-blue-400">{reportFeedback}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-medium hover:bg-red-700"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
