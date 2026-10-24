import * as Sentry from '@sentry/react'

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    // Safari autofill noise, not our code
    ignoreErrors: [/_logicalFormForControl/],
    beforeSend(event) {
      // Don't send errors in development
      if (import.meta.env.DEV) return null
      return event
    }
  })
}

export { Sentry }
