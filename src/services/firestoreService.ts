import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { OperationType, handleFirestoreError } from '../firebase/errors';
import {
  AdminSettingsRecord,
  AnnouncementRecord,
  AppStatus,
  ApplicationRecord,
  AuditLogRecord,
  CategoryRecord,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_CATEGORIES,
  DeletionRequestRecord,
  DownloadEventRecord,
  NotificationRecord,
  NotificationType,
  PublicDeveloper,
  ReportRecord,
  ReviewRecord,
  TestingChecklist,
  UserAccount,
} from '../types';
import { clampString, FIELD_LIMITS, generateSafeId } from '../utils/validation';

function sortByTimestampDesc<T>(items: T[], field: keyof T): T[] {
  return [...items].sort((a, b) => {
    const ta = toMillis(a[field]);
    const tb = toMillis(b[field]);
    return tb - ta;
  });
}

function toMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'object' && val !== null && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime() || 0;
  return 0;
}

// ---------------------------------------------------------------------------
// Public & Developer Real-Time Subscriptions
// ---------------------------------------------------------------------------

export function subscribeApprovedApplications(
  callback: (apps: ApplicationRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'applications';
  const q = query(collection(db, path), where('status', '==', 'APPROVED'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as ApplicationRecord);
      callback(sortByTimestampDesc(items, 'uploadDate'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeDeveloperApplications(
  developerId: string,
  callback: (apps: ApplicationRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'applications';
  const q = query(collection(db, path), where('developerId', '==', developerId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as ApplicationRecord);
      callback(sortByTimestampDesc(items, 'uploadDate'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeAllApplicationsForOwner(
  callback: (apps: ApplicationRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'applications';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as ApplicationRecord);
      callback(sortByTimestampDesc(items, 'uploadDate'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeSingleApplication(
  appId: string,
  callback: (app: ApplicationRecord | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `applications/${appId}`;
  return onSnapshot(
    doc(db, 'applications', appId),
    (snap) => {
      callback(snap.exists() ? (snap.data() as ApplicationRecord) : null);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeCategories(callback: (cats: CategoryRecord[]) => void): Unsubscribe {
  const path = 'categories';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      if (snap.empty) {
        callback(DEFAULT_CATEGORIES);
        return;
      }
      callback(snap.docs.map((d) => d.data() as CategoryRecord));
    },
    (err) => {
      console.warn('Categories listener fallback:', err);
      callback(DEFAULT_CATEGORIES);
    }
  );
}

export function subscribeAdminSettings(
  callback: (settings: Omit<AdminSettingsRecord, 'updatedAt'> & { updatedAt?: unknown }) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'adminSettings', 'platform'),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as AdminSettingsRecord);
      } else {
        callback(DEFAULT_ADMIN_SETTINGS);
      }
    },
    () => {
      callback(DEFAULT_ADMIN_SETTINGS);
    }
  );
}

export function subscribeAnnouncements(callback: (items: AnnouncementRecord[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'announcements'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as AnnouncementRecord).filter((a) => a.active);
      callback(sortByTimestampDesc(list, 'createdAt'));
    },
    (err) => {
      console.warn('Announcements listener error:', err);
      callback([]);
    }
  );
}

export function subscribeNotificationsForUser(
  recipientId: string,
  callback: (items: NotificationRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, path), where('recipientId', '==', recipientId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as NotificationRecord);
      callback(sortByTimestampDesc(items, 'createdAt'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeUserReviews(appId: string, callback: (reviews: ReviewRecord[]) => void): Unsubscribe {
  const path = 'reviews';
  const q = query(collection(db, path), where('appId', '==', appId), where('reviewType', '==', 'USER_REVIEW'));
  return onSnapshot(
    q,
    (snap) => {
      callback(sortByTimestampDesc(snap.docs.map((d) => d.data() as ReviewRecord), 'createdAt'));
    },
    (err) => {
      console.warn('Reviews listener error:', err);
      callback([]);
    }
  );
}

export function subscribeOwnerTestReviews(
  appId: string,
  callback: (reviews: ReviewRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'reviews';
  const q = query(collection(db, path), where('appId', '==', appId));
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => d.data() as ReviewRecord);
      callback(sortByTimestampDesc(all.filter((r) => r.reviewType === 'OWNER_TEST'), 'createdAt'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

// ---------------------------------------------------------------------------
// Owner Dashboard Real-Time Subscriptions
// ---------------------------------------------------------------------------

export function subscribeOwnerUsers(
  callback: (users: UserAccount[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByTimestampDesc(snap.docs.map((d) => d.data() as UserAccount), 'registrationDate'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeOwnerReports(
  callback: (reports: ReportRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'reports';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByTimestampDesc(snap.docs.map((d) => d.data() as ReportRecord), 'createdAt'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeOwnerDownloads(
  callback: (events: DownloadEventRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'downloads';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByTimestampDesc(snap.docs.map((d) => d.data() as DownloadEventRecord), 'createdAt'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeOwnerAuditLogs(
  callback: (logs: AuditLogRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'auditLogs';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByTimestampDesc(snap.docs.map((d) => d.data() as AuditLogRecord), 'createdAt'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeOwnerDeletionRequests(
  callback: (reqs: DeletionRequestRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'deletionRequests';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      callback(sortByTimestampDesc(snap.docs.map((d) => d.data() as DeletionRequestRecord), 'createdAt'));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export async function fetchPublicDeveloper(developerId: string): Promise<{
  developer: PublicDeveloper | null;
  apps: ApplicationRecord[];
}> {
  try {
    const devSnap = await getDoc(doc(db, 'developers', developerId));
    const appsSnap = await getDocs(
      query(
        collection(db, 'applications'),
        where('developerId', '==', developerId),
        where('status', '==', 'APPROVED')
      )
    );
    const apps = sortByTimestampDesc(
      appsSnap.docs.map((d) => d.data() as ApplicationRecord),
      'uploadDate'
    );
    return {
      developer: devSnap.exists() ? (devSnap.data() as PublicDeveloper) : null,
      apps,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `developers/${developerId}`);
  }
}

// ---------------------------------------------------------------------------
// Mutations (Validated & Logged)
// ---------------------------------------------------------------------------

export async function sendNotification(params: {
  recipientId: string;
  senderId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedAppId?: string;
}): Promise<void> {
  const notificationId = generateSafeId('notif');
  const path = `notifications/${notificationId}`;
  try {
    await setDoc(doc(db, 'notifications', notificationId), {
      notificationId,
      recipientId: params.recipientId,
      senderId: params.senderId,
      type: params.type,
      title: clampString(params.title, 140),
      message: clampString(params.message, 600),
      ...(params.relatedAppId ? { relatedAppId: params.relatedAppId } : {}),
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function createAuditLog(params: {
  actorId: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}): Promise<void> {
  const logId = generateSafeId('audit');
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      logId,
      actorId: params.actorId,
      ...(params.actorEmail ? { actorEmail: clampString(params.actorEmail, 160) } : {}),
      action: clampString(params.action, 80),
      targetType: clampString(params.targetType, 60),
      targetId: clampString(params.targetId, 128),
      details: clampString(params.details, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function createApplicationSubmission(params: {
  appId: string;
  appName: string;
  description: string;
  developerId: string;
  developerName: string;
  developerEmail?: string;
  platform: 'android' | 'ios';
  fileType: 'apk' | 'aab' | 'ipa';
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  fileStoragePath: string;
  iconStoragePath?: string;
  iconUrl?: string;
  screenshots?: string[];
  version: string;
  category: string;
  isGame: boolean;
  privacyPolicyUrl?: string;
  supportContact: string;
  packageInspection: ApplicationRecord['packageInspection'];
}): Promise<void> {
  const path = `applications/${params.appId}`;
  try {
    await setDoc(doc(db, 'applications', params.appId), {
      appId: params.appId,
      appName: clampString(params.appName, FIELD_LIMITS.appName.max),
      description: clampString(params.description, FIELD_LIMITS.description.max),
      developerId: params.developerId,
      developerName: clampString(params.developerName, FIELD_LIMITS.developerName.max),
      platform: params.platform,
      fileType: params.fileType,
      fileName: clampString(params.fileName, 200),
      fileSizeBytes: params.fileSizeBytes,
      fileSha256: params.fileSha256,
      fileStoragePath: clampString(params.fileStoragePath, 500),
      ...(params.iconStoragePath ? { iconStoragePath: clampString(params.iconStoragePath, 500) } : {}),
      ...(params.iconUrl ? { iconUrl: clampString(params.iconUrl, 1500) } : {}),
      screenshots: (params.screenshots || []).slice(0, FIELD_LIMITS.maxScreenshots),
      version: clampString(params.version, FIELD_LIMITS.version.max),
      category: clampString(params.category, FIELD_LIMITS.category.max),
      isGame: params.isGame,
      status: 'PENDING',
      uploadDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
      packageInspection: params.packageInspection || {},
      ...(params.privacyPolicyUrl ? { privacyPolicyUrl: clampString(params.privacyPolicyUrl, 500) } : {}),
      supportContact: clampString(params.supportContact, FIELD_LIMITS.supportContact.max),
      downloadCount: 0,
      featured: false,
      averageRating: 0,
      ratingCount: 0,
    });

    // Update user's uploaded count
    await updateDoc(doc(db, 'users', params.developerId), {
      uploadedCount: increment(1),
      lastActivity: serverTimestamp(),
    });

    // Notify developer
    await sendNotification({
      recipientId: params.developerId,
      senderId: params.developerId,
      type: 'UPLOAD_RECEIVED',
      title: `Submission Received: ${params.appName}`,
      message: `Your ${params.fileType.toUpperCase()} build v${params.version} is queued for Owner security review.`,
      relatedAppId: params.appId,
    });

    // Immediately notify Owner
    await sendNotification({
      recipientId: 'OWNER',
      senderId: params.developerId,
      type: 'SUBMISSION_ALERT',
      title: `New App Pending Review: ${params.appName}`,
      message: `${params.developerName} uploaded ${params.platform.toUpperCase()} (${params.fileType.toUpperCase()}) v${params.version}.`,
      relatedAppId: params.appId,
    });

    await createAuditLog({
      actorId: params.developerId,
      actorEmail: params.developerEmail,
      action: 'APPLICATION_SUBMITTED',
      targetType: 'application',
      targetId: params.appId,
      details: `Submitted ${params.appName} v${params.version} (${params.fileType.toUpperCase()}, SHA-256: ${params.fileSha256.slice(0, 12)}...)`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateDeveloperAppMetadata(
  appId: string,
  updates: {
    appName: string;
    description: string;
    category: string;
    isGame: boolean;
    version: string;
    privacyPolicyUrl?: string;
    supportContact: string;
  }
): Promise<void> {
  const path = `applications/${appId}`;
  try {
    await updateDoc(doc(db, 'applications', appId), {
      appName: clampString(updates.appName, FIELD_LIMITS.appName.max),
      description: clampString(updates.description, FIELD_LIMITS.description.max),
      category: clampString(updates.category, FIELD_LIMITS.category.max),
      isGame: updates.isGame,
      version: clampString(updates.version, FIELD_LIMITS.version.max),
      privacyPolicyUrl: clampString(updates.privacyPolicyUrl || '', 500),
      supportContact: clampString(updates.supportContact, FIELD_LIMITS.supportContact.max),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteUnpublishedApp(appId: string): Promise<void> {
  const path = `applications/${appId}`;
  try {
    await deleteDoc(doc(db, 'applications', appId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function requestApprovedAppDeletion(params: {
  appId: string;
  appName: string;
  developerId: string;
  reason: string;
}): Promise<void> {
  const requestId = generateSafeId('delreq');
  const path = `deletionRequests/${requestId}`;
  try {
    await setDoc(doc(db, 'deletionRequests', requestId), {
      requestId,
      appId: params.appId,
      appName: clampString(params.appName, 80),
      developerId: params.developerId,
      reason: clampString(params.reason, 600),
      status: 'PENDING',
      createdAt: serverTimestamp(),
    });

    await sendNotification({
      recipientId: 'OWNER',
      senderId: params.developerId,
      type: 'SECURITY_ALERT',
      title: `Deletion Request: ${params.appName}`,
      message: `Developer requested removal of published app "${params.appName}". Reason: ${clampString(params.reason, 200)}`,
      relatedAppId: params.appId,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function ownerModerateApplication(params: {
  app: ApplicationRecord;
  reviewerId: string;
  reviewerEmail: string;
  decision: AppStatus;
  rejectionReason?: string;
  reviewNotes?: string;
  testingChecklist?: TestingChecklist;
  featured?: boolean;
  publicDownloadUrl?: string;
}): Promise<void> {
  const { app, reviewerId, reviewerEmail, decision, rejectionReason, reviewNotes, testingChecklist, featured, publicDownloadUrl } = params;
  const path = `applications/${app.appId}`;

  try {
    const updatePayload: Record<string, unknown> = {
      status: decision,
      reviewerId,
      reviewDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
      reviewNotes: clampString(reviewNotes || '', FIELD_LIMITS.reviewNotes.max),
      rejectionReason: decision === 'REJECTED' || decision === 'SUSPENDED' ? clampString(rejectionReason || '', FIELD_LIMITS.rejectionReason.max) : '',
    };

    if (testingChecklist) {
      updatePayload.testingChecklist = testingChecklist;
    }
    if (typeof featured === 'boolean') {
      updatePayload.featured = featured;
    }
    if (publicDownloadUrl) {
      updatePayload.publicDownloadUrl = clampString(publicDownloadUrl, 1500);
    }

    await updateDoc(doc(db, 'applications', app.appId), updatePayload);

    // Log Owner testing review if checklist/notes present
    if (testingChecklist) {
      const reviewId = generateSafeId('testrev');
      const trimmedNotes = (reviewNotes || '').trim();
      const reviewComment =
        trimmedNotes.length >= 2 ? trimmedNotes : `Status changed to ${decision}`;
      await setDoc(doc(db, 'reviews', reviewId), {
        reviewId,
        appId: app.appId,
        authorId: reviewerId,
        authorName: 'APPVERSE Owner Review',
        reviewType: 'OWNER_TEST',
        comment: clampString(reviewComment, FIELD_LIMITS.reviewComment.max),
        testDevice: clampString(testingChecklist.testDevice || 'Owner Test Bench', 120),
        testOutcome: testingChecklist.testOutcome || (decision === 'APPROVED' ? 'PASSED' : 'FAILED'),
        createdAt: serverTimestamp(),
      });
    }

    // Update public developer approvedAppCount when transitioning to/from APPROVED
    if (app.status !== 'APPROVED' && decision === 'APPROVED') {
      const devRef = doc(db, 'developers', app.developerId);
      const devSnap = await getDoc(devRef);
      if (devSnap.exists()) {
        await updateDoc(devRef, { approvedAppCount: increment(1) });
      }
    } else if (app.status === 'APPROVED' && decision !== 'APPROVED') {
      const devRef = doc(db, 'developers', app.developerId);
      const devSnap = await getDoc(devRef);
      if (devSnap.exists() && (devSnap.data().approvedAppCount || 0) > 0) {
        await updateDoc(devRef, { approvedAppCount: increment(-1) });
      }
    }

    // Notify developer of outcome
    const notifType: NotificationType =
      decision === 'APPROVED'
        ? 'APPROVED'
        : decision === 'REJECTED'
          ? 'REJECTED'
          : decision === 'SUSPENDED'
            ? 'SUSPENDED'
            : 'UNDER_REVIEW';

    await sendNotification({
      recipientId: app.developerId,
      senderId: reviewerId,
      type: notifType,
      title: `App ${decision.replace('_', ' ')}: ${app.appName}`,
      message:
        decision === 'APPROVED'
          ? `${app.appName} v${app.version} passed Owner security review and is now live on APPVERSE.`
          : decision === 'REJECTED'
            ? `${app.appName} was not approved. Reason: ${rejectionReason || 'Failed review criteria.'}`
            : decision === 'SUSPENDED'
              ? `${app.appName} has been suspended. Reason: ${rejectionReason || 'Policy review.'}`
              : `${app.appName} is currently under Owner technical inspection.`,
      relatedAppId: app.appId,
    });

    await createAuditLog({
      actorId: reviewerId,
      actorEmail: reviewerEmail,
      action: `APP_STATUS_${decision}`,
      targetType: 'application',
      targetId: app.appId,
      details: `${app.appName} -> ${decision}${rejectionReason ? ` (${rejectionReason})` : ''}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function recordApprovedDownload(app: ApplicationRecord, downloaderId?: string): Promise<void> {
  const downloadId = generateSafeId('dl');
  try {
    await updateDoc(doc(db, 'applications', app.appId), {
      downloadCount: increment(1),
    });

    await setDoc(doc(db, 'downloads', downloadId), {
      downloadId,
      appId: app.appId,
      appName: clampString(app.appName, 80),
      platform: app.platform,
      fileType: app.fileType,
      ...(downloaderId ? { downloaderId } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `downloads/${downloadId}`);
  }
}

export async function submitUserReview(params: {
  app: ApplicationRecord;
  authorId: string;
  authorName: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const reviewId = generateSafeId('rev');
  try {
    await setDoc(doc(db, 'reviews', reviewId), {
      reviewId,
      appId: params.app.appId,
      authorId: params.authorId,
      authorName: clampString(params.authorName, 80),
      reviewType: 'USER_REVIEW',
      rating: Math.min(5, Math.max(1, Math.round(params.rating))),
      comment: clampString(params.comment, FIELD_LIMITS.reviewComment.max),
      createdAt: serverTimestamp(),
    });

    const prevCount = params.app.ratingCount || 0;
    const prevAvg = params.app.averageRating || 0;
    const newCount = prevCount + 1;
    const newAvg = Number(((prevAvg * prevCount + params.rating) / newCount).toFixed(2));

    await updateDoc(doc(db, 'applications', params.app.appId), {
      averageRating: newAvg,
      ratingCount: newCount,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewId}`);
  }
}

export async function submitAbuseReport(params: {
  app: ApplicationRecord;
  reporterId: string;
  reason: ReportRecord['reason'];
  details: string;
}): Promise<void> {
  const reportId = generateSafeId('rep');
  try {
    await setDoc(doc(db, 'reports', reportId), {
      reportId,
      appId: params.app.appId,
      appName: clampString(params.app.appName, 80),
      reporterId: params.reporterId,
      reason: params.reason,
      details: clampString(params.details, FIELD_LIMITS.reportDetails.max),
      status: 'OPEN',
      createdAt: serverTimestamp(),
    });

    await sendNotification({
      recipientId: 'OWNER',
      senderId: params.reporterId,
      type: 'REPORT_ALERT',
      title: `Abuse Report: ${params.app.appName}`,
      message: `Reason: ${params.reason}. ${clampString(params.details, 200)}`,
      relatedAppId: params.app.appId,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
  }
}

export async function updateDeveloperProfileInfo(params: {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  supportEmail: string;
  website: string;
  avatarUrl: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', params.uid), {
      username: clampString(params.username, FIELD_LIMITS.username.max),
      displayName: clampString(params.displayName, FIELD_LIMITS.displayName.max),
      developerBio: clampString(params.bio, FIELD_LIMITS.bio.max),
      supportEmail: clampString(params.supportEmail, 160),
      website: clampString(params.website, 300),
      avatarUrl: clampString(params.avatarUrl, 1000),
      lastActivity: serverTimestamp(),
    });

    await updateDoc(doc(db, 'developers', params.uid), {
      username: clampString(params.username, FIELD_LIMITS.username.max),
      displayName: clampString(params.displayName, FIELD_LIMITS.displayName.max),
      bio: clampString(params.bio, FIELD_LIMITS.bio.max),
      website: clampString(params.website, 300),
      avatarUrl: clampString(params.avatarUrl, 1000),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.uid}`);
  }
}

export async function saveAdminSettings(
  settings: Omit<AdminSettingsRecord, 'updatedAt' | 'updatedBy'>,
  ownerUid: string,
  ownerEmail: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'adminSettings', 'platform'), {
      ...settings,
      settingId: 'platform',
      updatedBy: ownerUid,
      updatedAt: serverTimestamp(),
    });
    await createAuditLog({
      actorId: ownerUid,
      actorEmail: ownerEmail,
      action: 'SETTINGS_UPDATED',
      targetType: 'adminSettings',
      targetId: 'platform',
      details: `Updated limits: APK ${settings.maxApkSizeMb}MB, AAB ${settings.maxAabSizeMb}MB, IPA ${settings.maxIpaSizeMb}MB`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'adminSettings/platform');
  }
}

export async function publishAnnouncement(params: {
  title: string;
  body: string;
  severity: 'INFO' | 'UPDATE' | 'WARNING';
  ownerUid: string;
  ownerEmail: string;
}): Promise<void> {
  const announcementId = generateSafeId('ann');
  try {
    await setDoc(doc(db, 'announcements', announcementId), {
      announcementId,
      title: clampString(params.title, 140),
      body: clampString(params.body, 1500),
      severity: params.severity,
      authorId: params.ownerUid,
      active: true,
      createdAt: serverTimestamp(),
    });
    await createAuditLog({
      actorId: params.ownerUid,
      actorEmail: params.ownerEmail,
      action: 'ANNOUNCEMENT_PUBLISHED',
      targetType: 'announcement',
      targetId: announcementId,
      details: params.title,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `announcements/${announcementId}`);
  }
}

export async function ownerToggleUserAccountStatus(params: {
  user: UserAccount;
  newStatus: 'ACTIVE' | 'SUSPENDED';
  ownerUid: string;
  ownerEmail: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', params.user.uid), {
      accountStatus: params.newStatus,
    });
    const devRef = doc(db, 'developers', params.user.uid);
    const devSnap = await getDoc(devRef);
    if (devSnap.exists()) {
      await updateDoc(devRef, { accountStatus: params.newStatus });
    }
    await sendNotification({
      recipientId: params.user.uid,
      senderId: params.ownerUid,
      type: 'ACCOUNT_UPDATE',
      title: `Account Status: ${params.newStatus}`,
      message:
        params.newStatus === 'SUSPENDED'
          ? 'Your APPVERSE developer account has been suspended by the Owner. Contact support for review.'
          : 'Your APPVERSE developer account has been reactivated.',
    });
    await createAuditLog({
      actorId: params.ownerUid,
      actorEmail: params.ownerEmail,
      action: `USER_${params.newStatus}`,
      targetType: 'user',
      targetId: params.user.uid,
      details: `${params.user.email} status set to ${params.newStatus}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.user.uid}`);
  }
}

export async function ownerResolveReport(params: {
  report: ReportRecord;
  status: ReportRecord['status'];
  resolutionNotes: string;
  ownerUid: string;
  ownerEmail: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', params.report.reportId), {
      status: params.status,
      resolutionNotes: clampString(params.resolutionNotes, 1000),
    });
    await createAuditLog({
      actorId: params.ownerUid,
      actorEmail: params.ownerEmail,
      action: `REPORT_${params.status}`,
      targetType: 'report',
      targetId: params.report.reportId,
      details: `${params.report.appName}: ${params.resolutionNotes}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${params.report.reportId}`);
  }
}

export async function ownerResolveDeletionRequest(params: {
  req: DeletionRequestRecord;
  decision: 'COMPLETED' | 'DECLINED';
  ownerUid: string;
  ownerEmail: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'deletionRequests', params.req.requestId), {
      status: params.decision,
      resolvedAt: serverTimestamp(),
    });
    if (params.decision === 'COMPLETED') {
      await deleteDoc(doc(db, 'applications', params.req.appId));
    }
    await sendNotification({
      recipientId: params.req.developerId,
      senderId: params.ownerUid,
      type: 'ACCOUNT_UPDATE',
      title: `Deletion Request ${params.decision}: ${params.req.appName}`,
      message:
        params.decision === 'COMPLETED'
          ? `Your request to remove ${params.req.appName} has been completed.`
          : `Your deletion request for ${params.req.appName} was declined by the Owner.`,
    });
    await createAuditLog({
      actorId: params.ownerUid,
      actorEmail: params.ownerEmail,
      action: `DELETION_REQUEST_${params.decision}`,
      targetType: 'deletionRequest',
      targetId: params.req.requestId,
      details: params.req.appName,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `deletionRequests/${params.req.requestId}`);
  }
}

export async function seedDefaultCategoriesIfOwner(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (snap.empty) {
      await Promise.all(
        DEFAULT_CATEGORIES.map((cat) =>
          setDoc(doc(db, 'categories', cat.categoryId), cat)
        )
      );
    }
  } catch (err) {
    console.warn('Category seed check skipped:', err);
  }
}
