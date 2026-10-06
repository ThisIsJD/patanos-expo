import * as Sentry from '@sentry/react-native'
import { MONITORING_PROBE_MESSAGE, sanitizeMonitoringEvent } from '@/src/utils/monitoringPrivacy'

let enabled = false
const environment = process.env.EXPO_PUBLIC_APP_ENV || 'development'

export function initializeMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN
  if (!dsn || enabled) return enabled
  if (!['development', 'staging', 'production'].includes(environment)) {
    throw new Error('Invalid monitoring environment')
  }
  Sentry.init({
    dsn,
    environment,
    enabled: true,
    sendDefaultPii: false,
    enableNative: false,
    enableAutoSessionTracking: false,
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeMonitoringEvent,
    beforeSendTransaction: () => null,
  })
  enabled = true
  return true
}

// Native crash collection stays off until its privacy behavior is qualified.
export const wrapWithMonitoring = component => enabled ? Sentry.wrap(component) : component

export async function captureMonitoringProbe() {
  if (!enabled || environment !== 'staging') return null
  const eventId = Sentry.captureException(new Error(MONITORING_PROBE_MESSAGE))
  const flushed = await Sentry.flush(5000)
  return { eventId, flushed }
}
