import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Safety net for promise rejections nothing else caught (ErrorBoundary only covers
// render-phase errors, not rejected promises) — at minimum this stops failures from
// vanishing into the browser console with no trace a user or developer would notice.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promesa rechazada sin manejar:', event.reason);
  Sentry.captureException(event.reason);
});

// Register the service worker only in production builds. In dev it would fight Vite's
// HMR (serving stale modules from cache), so the PWA/offline features are exercised via
// `npm run build && npm run preview`, not the dev server.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('No se pudo registrar el service worker:', err);
    });
  });
}
