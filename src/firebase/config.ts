import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getMessaging, isSupported as isMessagingSupported, getToken } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL as string | undefined) || 'elwin.george2010@gmail.com';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Optional Firebase App Check initialization if site key is configured
const recaptchaSiteKey =
  (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined) ||
  (firebaseConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey ||
  '';

export let appCheckActive = false;
if (typeof window !== 'undefined' && recaptchaSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckActive = true;
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
