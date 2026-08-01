// ─── FCM Registration for Super Admin Dashboard ─────────────────────────────
// Registers FCM token on login, saves to Supabase notification_tokens table
// ─────────────────────────────────────────────────────────────────────────────

import { requestFCMToken, initMessaging, onForegroundMessage } from './firebase'
import { supabase } from './supabase'

/**
 * Detect browser name
 */
function detectBrowser() {
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  return 'Unknown'
}

/**
 * Register the Firebase Messaging service worker.
 */
export async function registerFirebaseSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM-SA] Service workers not supported')
    return null
  }
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
    console.log('[FCM-SA] Firebase SW registered:', reg.scope)
    return reg
  } catch (err) {
    console.error('[FCM-SA] Firebase SW registration failed:', err)
    return null
  }
}

/**
 * Save FCM token to Supabase notification_tokens table.
 */
async function saveFCMToken(userId, fcmToken) {
  if (!userId || !fcmToken) return

  const browser = detectBrowser()

  try {
    const { data: existing } = await supabase
      .from('notification_tokens')
      .select('id, fcm_token')
      .eq('user_id', userId)
      .eq('browser', browser)
      .maybeSingle()

    if (existing) {
      if (existing.fcm_token !== fcmToken) {
        await supabase
          .from('notification_tokens')
          .update({
            fcm_token: fcmToken,
            role: 'super_admin',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        console.log('[FCM-SA] Token updated for', browser)
      }
    } else {
      const { error } = await supabase
        .from('notification_tokens')
        .insert({
          user_id: userId,
          fcm_token: fcmToken,
          role: 'super_admin',
          browser,
        })

      if (error && error.code === '23505') {
        // Unique constraint violation — update instead
        await supabase
          .from('notification_tokens')
          .update({
            fcm_token: fcmToken,
            role: 'super_admin',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('browser', browser)
      }
      console.log('[FCM-SA] Token saved for', browser)
    }
  } catch (err) {
    console.error('[FCM-SA] Token save error:', err)
  }
}

/**
 * Initialize FCM for Super Admin.
 * Call this after successful login.
 *
 * @param {string} userId - Supabase user UUID
 * @param {(notification: {title: string, body: string}) => void} onNotification - foreground callback
 */
export async function initializeSuperAdminFCM(userId, onNotification) {
  if (!('Notification' in window)) return null
  if (Notification.permission === 'denied') return null

  try {
    await registerFirebaseSW()
    await initMessaging()

    const fcmToken = await requestFCMToken()
    if (!fcmToken) return null

    await saveFCMToken(userId, fcmToken)

    if (onNotification) {
      onForegroundMessage((payload) => {
        const notification = payload.notification || {}
        const data = payload.data || {}
        onNotification({
          title: notification.title || data.title || 'GramSeva',
          body: notification.body || data.body || 'New notification',
          data,
        })
      })
    }

    // Listen for notification clicks from service worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CLICK') {
          const url = event.data.url
          if (url && url !== window.location.pathname) {
            window.location.href = url
          }
        }
      })
    }

    return fcmToken
  } catch (err) {
    console.error('[FCM-SA] Initialization failed:', err)
    return null
  }
}
