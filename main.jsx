import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n'
import 'regenerator-runtime/runtime'

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
    <App />
  </React.StrictMode>,
)
