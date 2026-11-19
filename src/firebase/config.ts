import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import { getMessaging, isSupported as isMessagingSupported, getToken } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL as string | undefined) || 'elwin.george2010@gmail.com';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createFirestoreClient() {
  try {
    const settings =
      typeof window !== 'undefined'
        ? { experimentalForceLongPolling: true }
        : {};
    return initializeFirestore(app, settings, firebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreClient();
export const auth = getAuth(app);
export const storage = getStorage(app);

// Optional Firebase App Check initialization only when explicitly configured for this project
const recaptchaSiteKey =
  (firebaseConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey?.trim() || '';

const globalForAppCheck = globalThis as typeof globalThis & {
  __APPVERSE_APP_CHECK__?: AppCheck;
};

export let appCheckActive = Boolean(globalForAppCheck.__APPVERSE_APP_CHECK__);
if (typeof window !== 'undefined' && recaptchaSiteKey && !globalForAppCheck.__APPVERSE_APP_CHECK__) {
  try {
    const existingRecaptchaContainer = document.getElementById(`fire_app_check_${app.name}`);
    if (existingRecaptchaContainer && existingRecaptchaContainer.childElementCount > 0) {
      appCheckActive = true;
    } else {
      globalForAppCheck.__APPVERSE_APP_CHECK__ = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
      appCheckActive = true;
    }
  } catch (err) {
    console.warn('App Check initialization skipped:', err);
  }
}

// Startup Firestore connectivity check (uses publicly readable settings doc to avoid permission-denied noise)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'adminSettings', 'platform'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
    }
  }
}
testConnection();

export async function requestPushNotificationToken(): Promise<{ supported: boolean; token?: string; reason?: string }> {
  try {
    const supported = await isMessagingSupported();
    if (!supported) {
      return { supported: false, reason: 'Web Push / FCM is not supported in this browser context.' };
    }
    if (typeof Notification === 'undefined') {
      return { supported: false, reason: 'Browser Notification API unavailable.' };
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { supported: true, reason: 'Notification permission was declined. In-app notifications remain active.' };
    }
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (!vapidKey) {
      return {
        supported: true,
        reason: 'Browser notification permission granted. Add VITE_FIREBASE_VAPID_KEY to enable background FCM Web Push tokens.',
      };
    }
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey });
    return { supported: true, token };
  } catch (err) {
    return {
      supported: false,
      reason: err instanceof Error ? err.message : 'Unable to register FCM token.',
    };
  }
}

export { firebaseConfig };
export default app;
