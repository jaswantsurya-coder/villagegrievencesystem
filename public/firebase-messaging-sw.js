// ─── Firebase Messaging Service Worker ──────────────────────────────────────
// GramSeva Super Admin Dashboard — Background push notification handler
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBEjFdqBGcVn_fce-bLFjacJBltNQiCRjA',
  authDomain: 'grievance-system-e72c5.firebaseapp.com',
  projectId: 'grievance-system-e72c5',
  storageBucket: 'grievance-system-e72c5.firebasestorage.app',
  messagingSenderId: '588141633888',
  appId: '1:588141633888:web:516a05530cbf4322af7e05',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'GramSeva Admin';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: payload.data?.click_action || payload.fcmOptions?.link || '/approvals',
      ...payload.data,
    },
    tag: 'gramseva-admin-' + Date.now(),
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/approvals';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
