// ─── Firebase Messaging Service Worker ──────────────────────────────────────
// GramSeva — Handles background push notifications via Firebase Cloud Messaging
// This file MUST be in /public/ and served from the root domain
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable no-restricted-globals */

// Import Firebase scripts (compat SDK for service worker context)
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: 'AIzaSyBEjFdqBGcVn_fce-bLFjacJBltNQiCRjA',
  authDomain: 'grievance-system-e72c5.firebaseapp.com',
  projectId: 'grievance-system-e72c5',
  storageBucket: 'grievance-system-e72c5.firebasestorage.app',
  messagingSenderId: '588141633888',
  appId: '1:588141633888:web:516a05530cbf4322af7e05',
  measurementId: 'G-H5YDV1YPDS',
});

const messaging = firebase.messaging();

// ─── Background Message Handler ─────────────────────────────────────────────
// Handles push notifications when the app is in the background or closed
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw] Background message received:', payload);

  const notificationData = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || notificationData.title || 'GramSeva Update';
  const body = notification.body || notificationData.body || 'You have a new notification';

  // Build action URL based on notification type
  let actionUrl = '/';
  const type = notificationData.type || '';
  const complaintId = notificationData.complaint_id || '';
  const ticketId = notificationData.ticket_id || '';

  if (type.startsWith('complaint_') && (complaintId || ticketId)) {
    actionUrl = '/?view=track&ticket=' + (ticketId || complaintId);
  } else if (type.startsWith('admin_request_')) {
    actionUrl = '/?view=admin';
  } else if (type === 'help_ticket_new') {
    actionUrl = '/?view=admin';
  } else if (type === 'escalation_reminder') {
    actionUrl = '/?view=admin';
  }

  const options = {
    body: body,
    icon: '/images/icon-192.png',
    badge: '/images/badge-72.png',
    vibrate: [200, 100, 200],
    tag: notificationData.notification_id || type || 'gramseva-notification',
    renotify: true,
    requireInteraction: type.includes('escalat') || type.includes('urgent'),
    data: {
      url: actionUrl,
      type: type,
      complaint_id: complaintId,
      ticket_id: ticketId,
      ...notificationData,
    },
    actions: [
      { action: 'view', title: '📋 View Details' },
      { action: 'dismiss', title: '✕ Dismiss' },
    ],
  };

  return self.registration.showNotification(title, options);
});

// ─── Notification Click Handler ─────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || '/';

  if (event.action === 'dismiss') {
    return; // Just close
  }

  // Open or focus the app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate existing window to the target URL
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
            data: data,
          });
          return client.focus();
        }
      }
      // No existing window — open a new one
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Push event fallback (for direct push without FCM data) ──────────────────
self.addEventListener('push', (event) => {
  // Firebase handles this via onBackgroundMessage, but this is a safety net
  if (event.data) {
    try {
      const data = event.data.json();
      // Only show if Firebase hasn't already handled it
      if (!data.notification && data.data) {
        const title = data.data.title || 'GramSeva';
        const options = {
          body: data.data.body || 'New notification',
          icon: '/images/icon-192.png',
          badge: '/images/badge-72.png',
          data: data.data,
        };
        event.waitUntil(self.registration.showNotification(title, options));
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }
});
