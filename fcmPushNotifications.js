// ─── FCM Push Notification Client Module ────────────────────────────────────
// GramSeva — Manages FCM token lifecycle, saves to Supabase, foreground alerts
// ─────────────────────────────────────────────────────────────────────────────

import { requestFCMToken, initMessaging, onForegroundMessage } from './firebase';
import { supabase } from './supabaseClient';

/**
 * Detect browser name for notification_tokens.browser column
 */
function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown';
}

/**
 * Register the Firebase Messaging service worker.
 * Must be called early in the app lifecycle.
 */
export async function registerFirebaseSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM-Push] Service workers not supported');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    console.log('[FCM-Push] Firebase SW registered:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[FCM-Push] Firebase SW registration failed:', err);
    return null;
  }
}

/**
 * Save or update FCM token in Supabase notification_tokens table.
 * Uses upsert on (user_id, browser) to prevent duplicates.
 * 
 * @param {string} userId - Supabase user UUID
 * @param {string} fcmToken - FCM device token
 * @param {string} role - User's current role
 * @param {number|null} villageId - User's village_id
 */
async function saveFCMTokenToSupabase(userId, fcmToken, role, villageId) {
  if (!supabase || !userId || !fcmToken) return;

  const browser = detectBrowser();

  try {
    // Check if a token already exists for this user + browser
    const { data: existing, error: fetchErr } = await supabase
      .from('notification_tokens')
      .select('id, fcm_token')
      .eq('user_id', userId)
      .eq('browser', browser)
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      console.error('[FCM-Push] Error checking existing token:', fetchErr);
    }

    if (existing) {
      // Update existing token (same user + browser)
      if (existing.fcm_token !== fcmToken) {
        const { error: updateErr } = await supabase
          .from('notification_tokens')
          .update({
            fcm_token: fcmToken,
            role: role || 'citizen',
            village_id: villageId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          console.error('[FCM-Push] Token update failed:', updateErr);
        } else {
          console.log('[FCM-Push] Token updated for', browser);
        }
      } else {
        // Token unchanged — just update role/village if needed
        const { error: updateErr } = await supabase
          .from('notification_tokens')
          .update({
            role: role || 'citizen',
            village_id: villageId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          console.error('[FCM-Push] Token metadata update failed:', updateErr);
        }
      }
    } else {
      // Insert new token
      const { error: insertErr } = await supabase
        .from('notification_tokens')
        .insert({
          user_id: userId,
          fcm_token: fcmToken,
          role: role || 'citizen',
          village_id: villageId || null,
          browser: browser,
        });

      if (insertErr) {
        // Handle unique constraint violation (race condition)
        if (insertErr.code === '23505') {
          console.log('[FCM-Push] Token already exists, updating...');
          await supabase
            .from('notification_tokens')
            .update({
              fcm_token: fcmToken,
              role: role || 'citizen',
              village_id: villageId || null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('browser', browser);
        } else {
          console.error('[FCM-Push] Token insert failed:', insertErr);
        }
      } else {
        console.log('[FCM-Push] Token saved for', browser);
      }
    }
  } catch (err) {
    console.error('[FCM-Push] saveFCMTokenToSupabase error:', err);
  }
}

/**
 * Remove FCM token from Supabase (on logout or permission revoke).
 * @param {string} userId
 */
export async function removeFCMToken(userId) {
  if (!supabase || !userId) return;
  const browser = detectBrowser();
  try {
    await supabase
      .from('notification_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('browser', browser);
    console.log('[FCM-Push] Token removed for', browser);
  } catch (err) {
    console.error('[FCM-Push] Token removal failed:', err);
  }
}

/**
 * Main initialization: Request permission, get FCM token, save to Supabase,
 * and set up foreground message handling.
 * 
 * Call this AFTER successful user login.
 * 
 * @param {string} userId - Supabase user UUID
 * @param {string} role - User's role (citizen, officer, village_admin, etc.)
 * @param {number|null} villageId - User's village_id
 * @param {(notification: {title: string, body: string, data?: object}) => void} onNotification - Callback for foreground notifications
 * @returns {Promise<string|null>} FCM token or null
 */
export async function initializeFCMPush(userId, role, villageId, onNotification) {
  if (!('Notification' in window)) {
    console.warn('[FCM-Push] Notifications API not available');
    return null;
  }

  // Don't ask if already denied
  if (Notification.permission === 'denied') {
    console.warn('[FCM-Push] Notification permission was denied by user');
    return null;
  }

  try {
    // 1. Register Firebase service worker
    await registerFirebaseSW();

    // 2. Initialize messaging
    await initMessaging();

    // 3. Request permission and get token
    const fcmToken = await requestFCMToken();
    if (!fcmToken) {
      console.warn('[FCM-Push] Could not obtain FCM token');
      return null;
    }

    // 4. Save token to Supabase
    await saveFCMTokenToSupabase(userId, fcmToken, role, villageId);

    // 5. Set up foreground message listener
    if (onNotification) {
      onForegroundMessage((payload) => {
        const notification = payload.notification || {};
        const data = payload.data || {};

        onNotification({
          title: notification.title || data.title || 'GramSeva',
          body: notification.body || data.body || 'New notification',
          data: data,
        });
      });
    }

    // 6. Listen for notification clicks from the service worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          const url = event.data.url;
          if (url && url !== window.location.pathname + window.location.search) {
            window.location.href = url;
          }
        }
      });
    }

    return fcmToken;
  } catch (err) {
    console.error('[FCM-Push] Initialization failed:', err);
    return null;
  }
}

/**
 * Refresh FCM token (call periodically or when token changes).
 * Firebase auto-refreshes tokens, but this ensures Supabase stays in sync.
 * 
 * @param {string} userId
 * @param {string} role
 * @param {number|null} villageId
 */
export async function refreshFCMToken(userId, role, villageId) {
  try {
    const fcmToken = await requestFCMToken();
    if (fcmToken) {
      await saveFCMTokenToSupabase(userId, fcmToken, role, villageId);
    }
  } catch (err) {
    console.error('[FCM-Push] Token refresh failed:', err);
  }
}
