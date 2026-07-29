// ─── Firebase Configuration (Modular SDK v9+) ──────────────────────────────
// GramSeva — Firebase Cloud Messaging + Auth + Analytics
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyBEjFdqBGcVn_fce-bLFjacJBltNQiCRjA',
  authDomain: 'grievance-system-e72c5.firebaseapp.com',
  projectId: 'grievance-system-e72c5',
  storageBucket: 'grievance-system-e72c5.firebasestorage.app',
  messagingSenderId: '588141633888',
  appId: '1:588141633888:web:516a05530cbf4322af7e05',
  measurementId: 'G-H5YDV1YPDS',
};

// VAPID key for Web Push (from Firebase Console → Cloud Messaging → Web Push certificates)
export const VAPID_KEY = 'BHxo1RSwKQS5FRIjJdWGsJSO1722Fv92F2XlPHG13ICt3_PwAu3fe8qGsfgQXWyiTl4PFXFnpHJd379NxCZ4rX8';

// ─── App Initialization ─────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

// ─── Auth (existing) ─────────────────────────────────────────────────────────
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup };

// ─── Cloud Messaging ─────────────────────────────────────────────────────────
let messaging = null;

/**
 * Initialize Firebase Messaging (only in supported browsers).
 * Returns the messaging instance or null if not supported.
 */
export async function initMessaging() {
  if (messaging) return messaging;
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      return messaging;
    }
    console.warn('[FCM] Push messaging not supported in this browser');
    return null;
  } catch (err) {
    console.error('[FCM] Failed to initialize messaging:', err);
    return null;
  }
}

/**
 * Request notification permission and get FCM device token.
 * @returns {Promise<string|null>} FCM token or null if denied/unsupported
 */
export async function requestFCMToken() {
  try {
    const msg = await initMessaging();
    if (!msg) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }

    // Get registration for the Firebase messaging service worker
    const swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration || undefined,
    });

    if (token) {
      console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');
      return token;
    }

    console.warn('[FCM] No token received');
    return null;
  } catch (err) {
    console.error('[FCM] Error getting token:', err);
    return null;
  }
}

/**
 * Listen for foreground push messages.
 * @param {(payload: object) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onForegroundMessage(callback) {
  if (!messaging) {
    console.warn('[FCM] Messaging not initialized. Call initMessaging() first.');
    return () => {};
  }
  return onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    callback(payload);
  });
}

export default app;
