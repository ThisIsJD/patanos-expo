import { describe, expect, test } from '@jest/globals'
import { MONITORING_PROBE_MESSAGE, sanitizeMonitoringEvent } from '@/src/utils/monitoringPrivacy'

describe('monitoring event allowlist', () => {
  test('removes credentials, customer data, breadcrumbs, and request bodies', () => {
    const input = {
      event_id: 'test-event', environment: 'staging', release: 'test-release',
      user: { email: 'customer@example.test' },
      request: { headers: { Authorization: 'secret-token' }, data: { payment_ref: 'receipt' } },
      breadcrumbs: [{ message: 'Customer notes' }], extra: { password: 'private' },
      contexts: { transaction: { notes: 'delivery address' } }, message: 'private payment details',
      exception: { values: [{ type: 'Error', value: 'secret-token', stacktrace: {
        frames: [{ filename: 'file:///private/user/app.jsx?token=secret-token',
          function: 'placeOrder', lineno: 20, colno: 4, vars: { password: 'private' } }],
      } }] },
    }
    const output = sanitizeMonitoringEvent(input)
    expect(output.environment).toBe('staging')
    expect(output.exception.values[0].stacktrace.frames[0]).toMatchObject({
      filename: 'app.jsx', function: 'placeOrder', lineno: 20,
    })
    expect(JSON.stringify(output)).not.toMatch(/secret-token|customer@|delivery address|private|receipt/)
    expect(input.exception.values[0].value).toBe('secret-token')
  })
  test('retains only the fixed safe probe message', () => {
    expect(sanitizeMonitoringEvent({ exception: { values: [
      { type: 'Error', value: MONITORING_PROBE_MESSAGE },
    ] } }).exception.values[0].value).toBe(MONITORING_PROBE_MESSAGE)
  })
  test('handles events without exception details', () => {
    expect(sanitizeMonitoringEvent({ user: { id: 'staff' }, timestamp: 123 })).toEqual({ timestamp: 123 })
  })
})
