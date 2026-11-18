import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileArchive,
  ImagePlus,
  Info,
  Lock,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  AdminSettingsRecord,
  ApplicationRecord,
  AppRoute,
  CategoryRecord,
  FileType,
  PackageInspection,
  PlatformType,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  formatBytes,
  generateSafeId,
  getMaxBytesForFileType,
  validateAppMetadataInput,
  validatePlatformAndFileType,
} from '../utils/validation';
import { inspectApplicationPackage, validateImageFile } from '../utils/packageInspector';
import { uploadAppBinary, uploadAppImage, UploadProgressInfo } from '../services/storageService';
import { createApplicationSubmission } from '../services/firestoreService';
import { formatReadableFirebaseError } from '../firebase/errors';

interface UploadPageProps {
  categories: CategoryRecord[];
  adminSettings: Omit<AdminSettingsRecord, 'updatedAt'>;
  myAppsCount: number;
  onNavigate: (route: AppRoute) => void;
  onOpenAuth: () => void;
}

export function UploadPage({
  categories,
  adminSettings,
  myAppsCount,
  onNavigate,
  onOpenAuth,
}: UploadPageProps) {
  const { firebaseUser, userProfile, isVerified, resendVerificationEmail, refreshAuthUser } = useAuth();

  const [platform, setPlatform] = useState<PlatformType>('android');
  const [fileType, setFileType] = useState<FileType>('apk');
  const [appName, setAppName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [developerName, setDeveloperName] = useState(
    userProfile?.displayName || firebaseUser?.displayName || ''
  );
  const [isGame, setIsGame] = useState(false);
  const [category, setCategory] = useState('Productivity');
  const [description, setDescription] = useState('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
  const [supportContact, setSupportContact] = useState(
    userProfile?.supportEmail || firebaseUser?.email || ''
  );

  const [packageFile, setPackageFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspection, setInspection] = useState<PackageInspection | null>(null);

  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgressInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedApp, setSubmittedApp] = useState<ApplicationRecord | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  useEffect(() => {
    const defaultDev = userProfile?.displayName || firebaseUser?.displayName || '';
    const defaultSupport = userProfile?.supportEmail || firebaseUser?.email || '';
    if (defaultDev) {
      setDeveloperName((prev) => prev || defaultDev);
    }
    if (defaultSupport) {
      setSupportContact((prev) => prev || defaultSupport);
    }
  }, [userProfile?.displayName, userProfile?.supportEmail, firebaseUser?.displayName, firebaseUser?.email]);

  useEffect(() => {
    return () => {
      if (iconPreview) URL.revokeObjectURL(iconPreview);
    };
  }, [iconPreview]);

  useEffect(() => {
    return () => {
      screenshotPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [screenshotPreviews]);

  const availableCategories = categories.filter((c) => (isGame ? c.type === 'game' : c.type === 'app'));

  const handlePlatformChange = (nextPlatform: PlatformType) => {
    setPlatform(nextPlatform);
    const nextFileType: FileType = nextPlatform === 'android' ? 'apk' : 'ipa';
    setFileType(nextFileType);
    setPackageFile(null);
    setInspection(null);
    setError(null);
  };

  const handlePackageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setInspection(null);
    setPackageFile(file);
    setInspecting(true);

    const maxBytes = getMaxBytesForFileType(fileType, adminSettings);
    const result = await inspectApplicationPackage(file, fileType, maxBytes);
    setInspecting(false);

    if (!result.ok) {
      setError(result.error);
      setPackageFile(null);
      return;
    }
    setInspection(result.inspection);
  };

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file, adminSettings.maxIconSizeMb, 'App Icon');
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleScreenshotsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6);
    for (const f of files) {
      const err = validateImageFile(f, adminSettings.maxScreenshotSizeMb, 'Screenshot');
      if (err) {
        setError(err);
        return;
      }
    }
    setError(null);
    setScreenshotFiles(files);
    setScreenshotPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !isVerified) return;

    setError(null);

    if (userProfile?.accountStatus === 'SUSPENDED') {
      setError('Your developer account is currently suspended and cannot submit new applications.');
      return;
    }

    if (myAppsCount >= adminSettings.maxAppsPerUser) {
      setError(`You have reached the free platform quota of ${adminSettings.maxAppsPerUser} applications per user.`);
      return;
    }

    const platformMismatch = validatePlatformAndFileType(platform, fileType);
    if (platformMismatch) {
      setError(platformMismatch);
      return;
    }

    const metaErr = validateAppMetadataInput({
      appName,
      description,
      version,
      category,
      supportContact,
      privacyPolicyUrl,
    });
    if (metaErr) {
      setError(metaErr);
      return;
    }

    if (!packageFile || !inspection || !inspection.valid) {
      setError('Please select and validate a valid APK, AAB, or IPA application package first.');
      return;
    }

    setUploading(true);
    const appId = generateSafeId('app');

    try {
      setProgress({
        percent: 5,
        bytesTransferred: 0,
        totalBytes: packageFile.size,
        stage: 'uploading_binary',
      });

      const binaryRes = await uploadAppBinary({
        file: packageFile,
        developerId: firebaseUser.uid,
        appId,
        fileType,
        onProgress: setProgress,
      });

      setProgress({
        percent: 90,
        bytesTransferred: packageFile.size,
        totalBytes: packageFile.size,
        stage: 'uploading_media',
      });

      let iconUrl = '';
      let iconStoragePath = '';
      if (iconFile) {
        const iconRes = await uploadAppImage({
          file: iconFile,
          developerId: firebaseUser.uid,
          appId,
          kind: 'icon',
        });
        iconUrl = iconRes.url;
        iconStoragePath = iconRes.storagePath;
      }

      const screenshots: string[] = [];
      for (let i = 0; i < screenshotFiles.length; i++) {
        const scRes = await uploadAppImage({
          file: screenshotFiles[i],
          developerId: firebaseUser.uid,
          appId,
          kind: 'screenshot',
          index: i,
        });
        screenshots.push(scRes.url);
      }

      setProgress({
        percent: 96,
        bytesTransferred: packageFile.size,
        totalBytes: packageFile.size,
        stage: 'saving_record',
      });

      const finalDevName = (developerName.trim() || userProfile?.displayName || firebaseUser.displayName || 'Developer').slice(0, 80);

      await createApplicationSubmission({
        appId,
        appName,
        description,
        developerId: firebaseUser.uid,
        developerName: finalDevName,
        developerEmail: firebaseUser.email || undefined,
        platform,
        fileType,
        fileName: packageFile.name,
        fileSizeBytes: packageFile.size,
        fileSha256: inspection.sha256,
        fileStoragePath: binaryRes.storagePath,
        iconStoragePath,
        iconUrl,
        screenshots,
        version,
        category,
        isGame,
        privacyPolicyUrl,
        supportContact,
        packageInspection: inspection,
      });

      setSubmittedApp({
        appId,
        appName,
        description,
        developerId: firebaseUser.uid,
        developerName: finalDevName,
        platform,
        fileType,
        fileName: packageFile.name,
        fileSizeBytes: packageFile.size,
        fileSha256: inspection.sha256,
        fileStoragePath: binaryRes.storagePath,
        version,
        category,
        isGame,
        status: 'PENDING',
        uploadDate: new Date(),
        updatedAt: new Date(),
        supportContact,
        downloadCount: 0,
        featured: false,
      });
    } catch (err) {
      setError(formatReadableFirebaseError(err));
    } finally {
      setUploading(false);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Authentication Required to Upload
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Guests can browse and explore APPVERSE freely, but developer authentication is mandatory before uploading Android (APK/AAB) or iOS (IPA) applications.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            Sign In or Create Account
          </button>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-16">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <MailCheck className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Verify Your Email Address
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            For marketplace security, only verified email accounts ({firebaseUser.email}) can submit binaries for Owner review.
          </p>
          {verifyMsg && (
            <p className="text-xs text-blue-600 dark:text-blue-400">{verifyMsg}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await resendVerificationEmail();
                  setVerifyMsg('Verification email resent. Check your inbox and spam folder.');
                } catch (err) {
                  setVerifyMsg(formatReadableFirebaseError(err));
                }
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await refreshAuthUser();
                  setVerifyMsg('Checked verification status.');
                } catch (err) {
                  setVerifyMsg(formatReadableFirebaseError(err));
                }
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              I Verified My Email
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submittedApp) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-14">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Submission Queued for Owner Review
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            <strong>{submittedApp.appName}</strong> v{submittedApp.version} has been saved with status <span className="font-mono font-semibold">PENDING</span>. The APPVERSE Owner has been notified immediately. Your build stays private until approved.
          </p>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1.5 font-mono text-slate-600 dark:text-slate-300">
            <p>App ID: {submittedApp.appId}</p>
            <p>Package: {submittedApp.fileName} ({formatBytes(submittedApp.fileSizeBytes)})</p>
            <p className="break-all">SHA-256: {submittedApp.fileSha256}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'my-apps' })}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
            >
              Go to My Apps
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmittedApp(null);
                setPackageFile(null);
                setInspection(null);
                setAppName('');
                setDescription('');
                setIconFile(null);
                setIconPreview(null);
                setScreenshotFiles([]);
                setScreenshotPreviews([]);
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium"
            >
              Upload Another App
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          Upload Application
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Free submission for Android (APK, AAB) and iOS (IPA). Unpublished files remain private until Owner approval.
        </p>
      </div>

      {/* Platform Quotas & Supported Formats Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Free Platform Storage Limits
            </p>
            <p className="tabular-nums">
              Max APK: {adminSettings.maxApkSizeMb} MB · Max AAB: {adminSettings.maxAabSizeMb} MB · Max IPA: {adminSettings.maxIpaSizeMb} MB
            </p>
          </div>
        </div>
        <div className="text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          Your quota: <strong>{myAppsCount}</strong> / {adminSettings.maxAppsPerUser} apps
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Platform & Package Binary */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            01. Target Platform &amp; Binary Package
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Platform
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handlePlatformChange('android')}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                    platform === 'android'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Android
                </button>
                <button
                  type="button"
                  onClick={() => handlePlatformChange('ios')}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                    platform === 'ios'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  iOS
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Package Format
              </label>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {(platform === 'android' ? (['apk', 'aab'] as const) : (['ipa'] as const)).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => {
                      setFileType(fmt);
                      setPackageFile(null);
                      setInspection(null);
                    }}
                    className={`flex-1 min-h-[40px] rounded-lg text-xs font-semibold uppercase transition-colors ${
                      fileType === fmt
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Select .{fileType.toUpperCase()} File
            </label>
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 cursor-pointer transition-colors bg-slate-50/70 dark:bg-slate-800/30 text-center">
              <FileArchive className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {packageFile ? packageFile.name : `Choose a valid .${fileType.toUpperCase()} package`}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Magic-byte signature, manifest structure, and SHA-256 verified automatically
              </span>
              <input
                type="file"
                accept={`.${fileType}`}
                onChange={handlePackageSelect}
                className="sr-only"
              />
            </label>
          </div>

          {inspecting && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Inspecting binary signature, ZIP entries, and computing SHA-256 checksum...
            </p>
          )}

          {inspection && inspection.valid && (
            <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1.5">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Binary Inspection Passed
              </p>
              <p className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                Detected: {inspection.detectedPlatformMarker} · {inspection.entryCount} entries · {formatBytes(inspection.fileSizeBytes)}
              </p>
              <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 break-all">
                SHA-256: {inspection.sha256}
              </p>
            </div>
          )}
        </section>

        {/* Step 2: Application Metadata */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            02. Application Metadata
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Application Name *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={80}
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. Pocket Note Studio"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Version Number *
              </label>
              <input
                type="text"
                required
                minLength={1}
                maxLength={32}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Developer / Studio Name *
              </label>
              <input
                type="text"
                required
                maxLength={80}
                value={developerName}
                onChange={(e) => setDeveloperName(e.target.value)}
                placeholder="Your Developer Name"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Listing Type &amp; Category *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isGame;
                    setIsGame(next);
                    const first = categories.find((c) => c.type === (next ? 'game' : 'app'));
                    if (first) setCategory(first.name);
                  }}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-medium whitespace-nowrap ${
                    isGame
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isGame ? 'Game' : 'App'}
                </button>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                >
                  {availableCategories.map((c) => (
                    <option key={c.categoryId} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Application Description *
            </label>
            <textarea
              required
              minLength={10}
              maxLength={4000}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe features, permissions needed, and release notes..."
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Support Contact (Email or URL) *
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={supportContact}
                onChange={(e) => setSupportContact(e.target.value)}
                placeholder="support@example.com"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Privacy Policy URL (Optional)
              </label>
              <input
                type="url"
                maxLength={500}
                value={privacyPolicyUrl}
                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                placeholder="https://example.com/privacy"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Step 3: Icon & Screenshots */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            03. Icon &amp; Screenshots
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Application Icon (PNG/JPEG/WebP, max {adminSettings.maxIconSizeMb} MB)
              </label>
              <label className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                {iconPreview ? (
                  <img
                    src={iconPreview}
                    alt="Icon preview"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                )}
                <div className="text-xs">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {iconFile ? iconFile.name : 'Select Icon Image'}
                  </p>
                  <p className="text-slate-500">Recommended 512x512 px</p>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleIconSelect}
                  className="sr-only"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Screenshots (Up to 6 images, max {adminSettings.maxScreenshotSizeMb} MB each)
              </label>
              <label className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                  <ImagePlus className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {screenshotFiles.length > 0
                      ? `${screenshotFiles.length} screenshots selected`
                      : 'Select Screenshots'}
                  </p>
                  <p className="text-slate-500">PNG, JPEG, or WebP</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleScreenshotsSelect}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {screenshotPreviews.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {screenshotPreviews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Screenshot preview ${i + 1}`}
                  className="h-28 w-auto rounded-xl border border-slate-200 dark:border-slate-700 object-cover"
                />
              ))}
            </div>
          )}
        </section>

        {/* Real-time Upload Progress */}
        {uploading && progress && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-700 dark:text-slate-300 capitalize">
                {progress.stage.replace('_', ' ')}...
              </span>
              <span className="tabular-nums text-blue-600 dark:text-blue-400">
                {progress.percent}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={uploading || inspecting || !inspection?.valid}
            className="min-h-[48px] px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading Release...' : 'Submit for Owner Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
