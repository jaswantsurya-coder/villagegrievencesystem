import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n'
import 'regenerator-runtime/runtime'

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('✅ SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('⚠️ SW registration failed:', error);
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
