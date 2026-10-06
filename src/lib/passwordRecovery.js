import { parseRecoveryLink, validateRecoveryPassword } from '@/src/utils/recoveryLinks'

const LINK_ERROR = 'Unable to verify this link. Request the latest email on this phone; check your connection and try again.'
const REQUEST_ERROR = 'Unable to send a recovery email. Check your connection or ask the owner for help.'
const HOUR = 60 * 60 * 1000

// Keep the recovery gate durable before a code exchange can create a signed-in session.
export function createPasswordRecovery({ auth, storage, redirect, enabled = () => true, supported = () => true, now = Date.now }) {
  const markerKey = `patanos:recovery:${redirect}:gate`
  const quotaKey = `patanos:recovery:${redirect}:requests`
  let snapshot = { status: 'checking', error: null, notice: null, userId: null }
  let version = 0
  let alive = true
  let requesting = false
  let mutating = false
  let acceptedCode = null
  const listeners = new Set()
  const publish = patch => {
    if (!alive) return
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }
  const current = attempt => alive && version === attempt

  async function handleURL(path) {
    const link = parseRecoveryLink(path, redirect)
    if (!link || !alive || mutating || snapshot.status === 'processing' || (link.code && link.code === acceptedCode)) return
    const attempt = ++version
    publish({ status: 'processing', error: null, notice: null, userId: null })
    try {
      await storage.setItem(markerKey, JSON.stringify({ pending: true }))
      if (!current(attempt)) return
      if (link.error) throw new Error(link.error)
      const { data, error } = await auth.exchangeCodeForSession(link.code)
      if (!current(attempt)) return
      // Installed auth-js emits SIGNED_IN here, not PASSWORD_RECOVERY. Check its verified result.
      if (error || data?.redirectType !== 'PASSWORD_RECOVERY' || !data?.session?.user?.id ||
        data.user?.id !== data.session.user.id) throw new Error(LINK_ERROR)
      acceptedCode = link.code
      await storage.setItem(markerKey, JSON.stringify({ userId: data.user.id }))
      if (current(attempt)) publish({ status: 'ready', userId: data.user.id })
    } catch {
      if (current(attempt)) publish({ status: 'error', error: link.error || LINK_ERROR, userId: null })
    }
  }

  async function initialize(path) {
    if (!alive) { snapshot = { ...snapshot, status: 'checking' }; acceptedCode = null }
    alive = true
    if (snapshot.status !== 'checking') return
    const attempt = ++version
    publish({ status: 'checking', error: null })
    if (parseRecoveryLink(path, redirect)) { await handleURL(path); return }
    try {
      const raw = await storage.getItem(markerKey)
      if (!current(attempt)) return
      if (!raw) { publish({ status: 'idle' }); return }
      const marker = JSON.parse(raw)
      if (!marker?.userId) throw new Error(LINK_ERROR)
      const { data, error } = await auth.getUser()
      if (!current(attempt)) return
      if (error || data?.user?.id !== marker.userId) throw new Error(LINK_ERROR)
      publish({ status: 'ready', userId: marker.userId })
    } catch {
      if (current(attempt)) publish({ status: 'error', error: LINK_ERROR, userId: null })
    }
  }

  async function requestReset(email) {
    if (!enabled()) return { error: 'Recovery email is not enabled for this environment yet. Ask the owner for help.' }
    if (!supported()) return { error: 'Use the matching installed Android app with secure recovery support.' }
    if (requesting || snapshot.status !== 'idle') return { error: 'Finish the current recovery action first.' }
    const address = typeof email === 'string' ? email.trim() : ''
    if (address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { error: 'Enter a valid staff email address.' }
    requesting = true
    try {
      const raw = await storage.getItem(quotaKey)
      const history = raw ? JSON.parse(raw) : []
      const timestamp = now()
      if (!Array.isArray(history) || history.some(time => !Number.isFinite(time) || time < 0 || time > timestamp)) throw new Error(REQUEST_ERROR)
      const recent = history.filter(time => timestamp - time < HOUR)
      if (recent.length >= 2 || (recent.length && timestamp - recent[recent.length - 1] < 60000)) {
        return { error: 'Recovery emails are limited. Wait before retrying; the server also has a shared email quota. Ask the owner if urgent.' }
      }
      // Reserve before sending: a lost response must not encourage immediate duplicate email requests.
      await storage.setItem(quotaKey, JSON.stringify([...recent, timestamp]))
      const { error } = await auth.resetPasswordForEmail(address, { redirectTo: redirect })
      if (error) return { error: REQUEST_ERROR }
      return { error: null, message: 'If this is a registered staff account, a recovery email has been requested. Open the newest email on this phone in the same app. Check spam too.' }
    } catch { return { error: REQUEST_ERROR } }
    finally { requesting = false }
  }

  async function endRecovery(passwordSaved = false) {
    if (mutating || ['checking', 'processing'].includes(snapshot.status) ||
      (snapshot.status === 'updating' && !passwordSaved)) return { error: 'Please wait for the current action.' }
    mutating = true
    const attempt = ++version
    publish({ status: 'completing', error: null })
    try {
      const { error } = await auth.signOut({ scope: 'local' })
      if (error) throw error
      await storage.removeItem(markerKey)
      if (current(attempt)) publish({ status: 'idle', userId: null,
        notice: passwordSaved ? 'Password updated. Sign in with your new password.' : null })
      return { error: null, saved: passwordSaved }
    } catch {
      const error = passwordSaved ? 'Password updated, but sign-out or recovery cleanup was not confirmed. Retry returning to login.'
        : 'Unable to finish recovery. Check your connection and retry returning to login.'
      if (current(attempt)) publish({ status: passwordSaved ? 'saved' : 'error', error })
      return { error, saved: passwordSaved }
    } finally { mutating = false }
  }

  async function updatePassword(password, confirmation) {
    if (snapshot.status !== 'ready' || mutating) return { error: 'Verify a recovery link before changing your password.' }
    const validation = validateRecoveryPassword(password, confirmation)
    if (validation) return { error: validation }
    mutating = true
    const attempt = ++version
    const userId = snapshot.userId
    publish({ status: 'updating', error: null })
    try {
      const verified = await auth.getUser()
      if (!current(attempt)) return { error: LINK_ERROR }
      if (verified.error || verified.data?.user?.id !== userId) throw new Error(LINK_ERROR)
      const { data, error } = await auth.updateUser({ password })
      if (!current(attempt)) return { error: LINK_ERROR }
      if (error || data?.user?.id !== userId) throw new Error(LINK_ERROR)
    } catch {
      const error = 'Unable to update the password. Check your connection, verify the link, or try a stronger password.'
      if (current(attempt)) publish({ status: 'ready', error })
      return { error }
    } finally { mutating = false }
    return endRecovery(true)
  }

  return {
    markerKey, quotaKey, initialize, handleURL, requestReset, updatePassword, endRecovery,
    isRequestAvailable: () => enabled() && supported(),
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    observeSession(session) {
      if (['ready', 'updating'].includes(snapshot.status) && session?.user?.id !== snapshot.userId) {
        ++version
        publish({ status: 'error', error: 'The recovery account changed. Return to login and request a new link.', userId: null })
      }
    },
    dispose() { alive = false; ++version; listeners.clear() },
  }
}
