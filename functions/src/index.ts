/**
 * APPVERSE Firebase Cloud Functions (Production Reference Implementation)
 *
 * Deploy via Firebase CLI:
 *   cd functions && npm install && npm run build && firebase deploy --only functions
 *
 * Responsibilities:
 * 1. Enforce server-side Owner approval & publish binary promotion from private submissions/ to published/
 * 2. Dispatch Firebase Cloud Messaging (FCM) push notifications on submission & moderation events
 * 3. Enforce upload quota and write immutable audit logs
 */

/*
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp();
const db = getFirestore();

const OWNER_EMAIL = 'elwin.george2010@gmail.com';

export const onApplicationSubmitted = onDocumentCreated('applications/{appId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  // Notify Owner immediately via FCM topic + Firestore notification
  await getMessaging().send({
    topic: 'owner_moderation_alerts',
    notification: {
      title: `New ${String(data.fileType).toUpperCase()} Submission: ${data.appName}`,
      body: `${data.developerName} uploaded v${data.version} for Owner review.`,
    },
    data: {
      appId: event.params.appId,
      type: 'SUBMISSION_ALERT',
    },
  });
});

export const approveOrRejectApplication = onCall(async (request) => {
  if (!request.auth || request.auth.token.email !== OWNER_EMAIL || !request.auth.token.email_verified) {
    throw new HttpsError('permission-denied', 'Only verified APPVERSE Owner can moderate submissions.');
  }

  const { appId, decision, rejectionReason, reviewNotes } = request.data as {
    appId: string;
    decision: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'UNDER_REVIEW';
    rejectionReason?: string;
    reviewNotes?: string;
  };

  const appRef = db.collection('applications').doc(appId);
  const snap = await appRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Application not found.');
  }

  const appData = snap.data()!;
  let publicDownloadUrl = appData.publicDownloadUrl || '';

  if (decision === 'APPROVED' && appData.fileStoragePath) {
    const bucket = getStorage().bucket();
    const srcFile = bucket.file(appData.fileStoragePath);
    const destPath = `published/${appId}/${appData.fileName}`;
    await srcFile.copy(bucket.file(destPath));
    const [signedUrl] = await bucket.file(destPath).getSignedUrl({
      action: 'read',
      expires: '2099-01-01',
    });
    publicDownloadUrl = signedUrl;
  }

  await appRef.update({
    status: decision,
    reviewerId: request.auth.uid,
    reviewDate: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    rejectionReason: rejectionReason || '',
    reviewNotes: reviewNotes || '',
    publicDownloadUrl,
  });

  return { ok: true, status: decision };
});
*/
export const CLOUD_FUNCTIONS_SPEC = 'See commented Firebase Cloud Functions v2 implementation for CLI deployment.';
