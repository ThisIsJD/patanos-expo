import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Alert, AppState } from 'react-native'
import { supabase } from '@/src/lib/supabase'
import { hasStaffAccess } from '@/src/utils/staffAccess'
import { createSessionLock } from '@/src/lib/sessionLock'

const AuthContext = createContext({
  session: null,
  profile: null,
  role: null,
  loading: true,
  signIn: async () => ({ error: null }),
  authError: null,
  refreshProfile: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
})

const PROFILE_ERROR = 'Unable to verify staff access. Check your connection and retry.'
const SESSION_ERROR = 'Unable to restore your session. Check your connection and retry.'

export function AuthProvider({ children }) {
  const [sessionLock] = useState(() => createSessionLock({ foreground: AppState.currentState === 'active' }))
  const lockState = useSyncExternalStore(sessionLock.subscribe, sessionLock.getSnapshot, sessionLock.getSnapshot)
  const authAction = useRef(false)
  const [state, setState] = useState({ session: null, profile: null, loading: true, authError: null })
  const active = useRef(false)
  const requestVersion = useRef(0)
  const currentSession = useRef(null)
  const resolvedProfile = useRef(null)
  const requests = useRef(new Set())

  const prepareSession = useCallback((nextSession) => {
    const version = ++requestVersion.current
    for (const controller of requests.current) controller.abort()
    currentSession.current = nextSession
    sessionLock.bindUser(nextSession?.user?.id)
    const sameAuthorizedIdentity = hasStaffAccess(nextSession, resolvedProfile.current)
    if (!sameAuthorizedIdentity) resolvedProfile.current = null
    setState({ session: nextSession, profile: resolvedProfile.current,
      loading: Boolean(nextSession?.user?.id && !sameAuthorizedIdentity), authError: null })
    return version
  }, [sessionLock])

  const resolveProfile = useCallback(async (nextSession, version) => {
    if (!nextSession?.user?.id || !active.current || version !== requestVersion.current) return { error: null }
    const controller = new AbortController()
    requests.current.add(controller)
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const { data, error } = await supabase.from('profiles').select('*')
        .eq('id', nextSession.user.id).abortSignal(controller.signal).single()
      if (!active.current || version !== requestVersion.current) return { error: null }
      const authError = error ? PROFILE_ERROR : !hasStaffAccess(nextSession, data)
        ? 'This account has no authorized staff access. Ask the owner to review the account.' : null
      resolvedProfile.current = authError ? null : data
      if (authError) sessionLock.lock('permission')
      setState({ session: nextSession, profile: resolvedProfile.current, loading: false, authError })
      return { error: authError }
    } catch {
      if (!active.current || version !== requestVersion.current) return { error: null }
      resolvedProfile.current = null
      sessionLock.lock('permission')
      setState({ session: nextSession, profile: null, loading: false, authError: PROFILE_ERROR })
      return { error: PROFILE_ERROR }
    } finally {
      clearTimeout(timeout)
      requests.current.delete(controller)
    }
  }, [sessionLock])

  const refreshProfile = useCallback(async () => {
    const previousVersion = requestVersion.current
    try {
      const { data, error } = await supabase.auth.getSession()
      if (!active.current || previousVersion !== requestVersion.current) return { error: null }
      if (error) throw error
      const nextSession = data?.session ?? null
      return await resolveProfile(nextSession, prepareSession(nextSession))
    } catch {
      if (!active.current || previousVersion !== requestVersion.current) return { error: null }
      resolvedProfile.current = null
      sessionLock.lock('permission')
      setState({ session: currentSession.current, profile: null, loading: false, authError: SESSION_ERROR })
      return { error: SESSION_ERROR }
    }
  }, [prepareSession, resolveProfile, sessionLock])

  useEffect(() => {
    active.current = true
    const scheduled = new Set()
    const requestControllers = requests.current
    const bootstrapVersion = requestVersion.current
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active.current) return
      const version = prepareSession(nextSession)
      // Supabase emits inside its auth lock. Start requests only after the callback returns.
      const timer = setTimeout(() => {
        scheduled.delete(timer)
        void resolveProfile(nextSession, version)
      }, 0)
      scheduled.add(timer)
    })
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!active.current || requestVersion.current !== bootstrapVersion) return
        if (error) throw error
        const nextSession = data?.session ?? null
        await resolveProfile(nextSession, prepareSession(nextSession))
      } catch {
        if (!active.current || requestVersion.current !== bootstrapVersion) return
        setState({ session: null, profile: null, loading: false, authError: SESSION_ERROR })
      }
    })()
    return () => {
      active.current = false
      requestVersion.current += 1
      subscription.unsubscribe()
      for (const timer of scheduled) clearTimeout(timer)
      for (const controller of requestControllers) controller.abort()
    }
  }, [prepareSession, resolveProfile])

  useEffect(() => {
    if (!state.session?.user?.id) return
    // Re-read permissions, not just the cached token. Bounded offline access is P1-06.
    const interval = setInterval(() => {
      if (!sessionLock.getSnapshot().locked && sessionLock.getSnapshot().foreground) void refreshProfile()
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [state.session?.user?.id, refreshProfile, sessionLock])

  useEffect(() => {
    if (lockState.foreground && !lockState.locked) supabase.auth.startAutoRefresh?.()
    else supabase.auth.stopAutoRefresh?.()
  }, [lockState.foreground, lockState.locked])

  useEffect(() => {
    // Android window blur can come from our own payment/lock Modal, not app backgrounding.
    const change = AppState.addEventListener('change', next => sessionLock.setForeground(next === 'active'))
    return () => { change.remove(); sessionLock.lock('unmount') }
  }, [sessionLock])

  const canOperate = useCallback(userId => sessionLock.canOperate(userId)
    && currentSession.current?.user?.id === userId
    && hasStaffAccess(currentSession.current, resolvedProfile.current), [sessionLock])
  const operationGuard = useCallback(userId => {
    const current = sessionLock.operationGuard(userId)
    return () => current() && canOperate(userId)
  }, [canOperate, sessionLock])
  const runStaffOperation = useCallback(async (userId, operation) => {
    if (!canOperate(userId)) return { data: null, error: 'Unlock an authorized staff account before changing orders.' }
    const finish = sessionLock.beginOperation(userId)
    if (!finish) return { data: null, error: 'Unlock this staff account before changing orders.' }
    try { return await operation() } finally { finish() }
  }, [canOperate, sessionLock])

  const signIn = async (email, password) => {
    if (authAction.current) return { error: 'Please wait for the current account action.' }
    const existingId = currentSession.current?.user?.id
    const existingEmail = currentSession.current?.user?.email || resolvedProfile.current?.email
    if (existingId && (!existingEmail || existingEmail.toLowerCase() !== email.trim().toLowerCase())) {
      return { error: 'Sign out first to switch accounts. Pending orders will be retained.' }
    }
    const ticket = sessionLock.beginUnlock()
    if (!ticket) return { error: 'Return to the app before unlocking.' }
    authAction.current = true
    try {
      await sessionLock.waitForOperations()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error.message }
      if (!data?.session?.user?.id || (existingId && existingId !== data.session.user.id)) throw new Error('Unexpected account')
      const resolved = await resolveProfile(data.session, prepareSession(data.session))
      if (resolved.error) return resolved
      if (!hasStaffAccess(currentSession.current, resolvedProfile.current)
          || currentSession.current.user.id !== data.session.user.id
          || !sessionLock.finishUnlock(ticket, data.session.user.id)) {
        return { error: 'Unlock was not confirmed. Keep the app open and retry.' }
      }
      return { error: null }
    } catch {
      return { error: 'Unable to sign in. Check your connection and try again.' }
    } finally { authAction.current = false }
  }

  const signOut = async () => {
    sessionLock.lock('signout')
    if (authAction.current) return { error: 'Please wait for the current account action, then retry sign-out.' }
    authAction.current = true
    try {
      await sessionLock.waitForOperations()
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      if (active.current) prepareSession(null)
      return { error: null }
    } catch {
      const error = 'Sign-out was not confirmed. The app stays locked; check your connection and retry. Pending orders are retained.'
      Alert.alert('Sign-out not confirmed', error)
      return { error }
    } finally { authAction.current = false }
  }

  const profile = hasStaffAccess(state.session, state.profile) ? state.profile : null
  return (
    <AuthContext.Provider
      value={{
        ...state,
        profile,
        role: profile?.role ?? null,
        lockState,
        lockSession: sessionLock.lock,
        canOperate,
        operationGuard,
        runStaffOperation,
        refreshProfile,
        signIn,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
