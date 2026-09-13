import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from "@sentry/react";
import App from './App.jsx'
import './index.css'
import './i18n'
import 'regenerator-runtime/runtime'

// ─── Sentry Error Tracking ─────────────────────────────────────────────────
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA,
  enabled: import.meta.env.PROD,                   // don't spam from local dev
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,                   // replay only on error — bandwidth matters for rural 3G
  replaysSessionSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event) {
    // Strip PII this app handles: phone, email, OTP, Aadhaar last-4
    const s = JSON.stringify(event);
    if (/\b\d{10}\b|aadhaar|otp/i.test(s)) {
      event.request && delete event.request.data;
    }
    return event;
  },
});

// ─── Error Fallback Component ───────────────────────────────────────────────
function ErrorFallback() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '2.5rem', maxWidth: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ color: '#1e293b', margin: '0 0 0.75rem', fontSize: '1.25rem' }}>Something went wrong</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 1.5rem', fontSize: '0.9rem' }}>
          An unexpected error occurred. Our team has been notified automatically.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#1D4ED8', color: 'white', border: 'none', borderRadius: '10px',
            padding: '0.75rem 2rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

// Register Service Workers for PWA + Firebase Cloud Messaging
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // PWA Service Worker
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('⚠️ SW registration failed:', error);
      });

    // Firebase Messaging Service Worker (for background push notifications)
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('✅ Firebase SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('⚠️ Firebase SW registration failed:', error);
      });
  });
}

// Offline/Online indicator
const updateOnlineStatus = () => {
  const indicator = document.getElementById('offline-indicator');
  if (indicator) {
    indicator.style.display = navigator.onLine ? 'none' : 'block';
  }
};
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />} showDialog={false}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
