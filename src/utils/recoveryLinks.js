const SCHEMES = {
  development: 'patanosexpo-development',
  staging: 'patanosexpo-staging',
  production: 'patanosexpo',
}

export function recoveryRedirect(environment) {
  if (!SCHEMES[environment]) throw new Error('Unknown recovery environment')
  return `${SCHEMES[environment]}://reset-password`
}

export function isRecoveryPath(path) {
  if (typeof path !== 'string') return false
  try {
    const url = new URL(path, 'https://local.invalid')
    return url.hostname === 'reset-password' || url.pathname === '/reset-password'
  } catch { return false }
}

export function parseRecoveryLink(path, redirect) {
  if (!isRecoveryPath(path)) return null
  try {
    const url = new URL(path)
    // No bearer tokens, arbitrary redirects, duplicate parameters or other build variants.
    if (`${url.protocol}//${url.host}${url.pathname}` !== redirect || url.hash ||
      [...url.searchParams.keys()].some(key => key !== 'code') || url.searchParams.getAll('code').length !== 1) {
      return { error: 'Open the latest recovery email on the same phone and app version that requested it.' }
    }
    const code = url.searchParams.get('code')
    if (!/^[A-Za-z0-9_-]{8,256}$/.test(code || '')) return { error: 'This recovery link is incomplete. Request a new link.' }
    return { code }
  } catch { return { error: 'This recovery link is invalid. Request a new link.' } }
}

export function validateRecoveryPassword(password, confirmation) {
  if (typeof password !== 'string' || password.length < 12) return 'Use at least 12 characters for the new password.'
  if (password.length > 64) return 'Use no more than 64 characters.'
  if (password !== confirmation) return 'The passwords do not match.'
  return null
}
