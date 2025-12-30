import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import App from './App.tsx'
import './index.css'

// Initialize Sentry for error monitoring
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // "development" or "production"

  // Only send errors in production (disable in dev to avoid noise)
  enabled: import.meta.env.PROD,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Performance monitoring - sample 10% of transactions
  tracesSampleRate: 0.1,

  // Session replay - 10% of normal sessions
  replaysSessionSampleRate: 0.1,

  // Session replay - 100% of sessions with errors
  replaysOnErrorSampleRate: 1.0,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
          background: '#0a0a0a',
          color: '#f5f5f5'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>Something went wrong</h1>
          <p style={{ color: '#a0a0a0', marginBottom: '30px', maxWidth: '400px' }}>
            We've been notified and will fix this as soon as possible.
          </p>
          <button
            onClick={resetError}
            style={{
              padding: '12px 24px',
              background: '#c9a66b',
              border: 'none',
              borderRadius: '3px',
              color: '#0a0a0a',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
