import { afterEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(), wrap: jest.fn(component => component),
  captureException: jest.fn(() => 'probe-id'), flush: jest.fn(async () => true),
}))

const originalEnvironment = process.env.EXPO_PUBLIC_APP_ENV
const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.EXPO_PUBLIC_APP_ENV
  else process.env.EXPO_PUBLIC_APP_ENV = originalEnvironment
  if (originalDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN
  else process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn
  jest.resetModules()
})

describe('monitoring is opt-in and probe is staging-only', () => {
  test('does not initialize or send without a DSN', async () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN
    const monitoring = require('@/src/lib/monitoring')
    expect(monitoring.initializeMonitoring()).toBe(false)
    expect(await monitoring.captureMonitoringProbe()).toBeNull()
  })
  test('initializes with privacy controls and flushes a mocked staging probe', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'staging'
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.test/1'
    const monitoring = require('@/src/lib/monitoring')
    const sentry = require('@sentry/react-native')
    expect(monitoring.initializeMonitoring()).toBe(true)
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({
      sendDefaultPii: false, enableNative: false, tracesSampleRate: 0,
    }))
    expect(await monitoring.captureMonitoringProbe()).toEqual({ eventId: 'probe-id', flushed: true })
  })
  test('does not send a probe in production', async () => {
    process.env.EXPO_PUBLIC_APP_ENV = 'production'
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.test/1'
    const monitoring = require('@/src/lib/monitoring')
    monitoring.initializeMonitoring()
    expect(await monitoring.captureMonitoringProbe()).toBeNull()
  })
})
