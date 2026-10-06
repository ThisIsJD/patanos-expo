const SAFE_ERROR_TYPES = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'])
export const MONITORING_PROBE_MESSAGE = 'Patanos staging monitoring probe'

// Start with an allowlist: error text, user/context/request data and breadcrumbs
// can include credentials, payment references or customer notes.
export function sanitizeMonitoringEvent(event) {
  const sanitized = {}
  for (const key of ['event_id', 'timestamp', 'platform', 'level', 'environment', 'release', 'dist']) {
    if (event[key] !== undefined) sanitized[key] = event[key]
  }
  if (event.exception?.values) {
    sanitized.exception = {
      values: event.exception.values.map(exception => ({
        type: SAFE_ERROR_TYPES.has(exception.type) ? exception.type : 'Error',
        value: exception.value === MONITORING_PROBE_MESSAGE
          ? MONITORING_PROBE_MESSAGE : 'Error details redacted',
        ...(exception.stacktrace ? {
          stacktrace: {
            frames: (exception.stacktrace.frames || []).map(frame => ({
              filename: typeof frame.filename === 'string'
                ? frame.filename.split(/[?#]/)[0].replace(/.*[\\/]/, '') : undefined,
              function: /^[\w.$<>-]+$/.test(frame.function || '') ? frame.function : undefined,
              lineno: frame.lineno,
              colno: frame.colno,
              in_app: frame.in_app,
            })),
          },
        } : {}),
      })),
    }
  }
  return sanitized
}
