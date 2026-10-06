import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/src/contexts/AuthContext'
import { supabase } from '@/src/lib/supabase'
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus'

export function useStaffAdministration() {
  const { session, role, canOperate, runStaffOperation } = useAuth()
  const { isOnline } = useNetworkStatus()
  const ownerId = role === 'admin' ? session?.user?.id : null
  const identity = `${ownerId ?? ''}:${isOnline}`
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity
  const generation = useRef(0)
  const submitting = useRef(false)
  const [state, setState] = useState({ rows: [], identity: null, loading: false, busy: false, error: null })

  const refresh = useCallback(async () => {
    const version = ++generation.current
    if (!ownerId || !isOnline) {
      setState({ rows: [], identity, loading: false, busy: false, error: null })
      return
    }
    setState(previous => ({ ...previous, rows: [], identity, loading: true, error: null }))
    try {
      const { data, error } = await supabase.from('profiles')
        .select('id,email,full_name,role,is_enabled').order('email', { ascending: true })
      if (version !== generation.current || identity !== currentIdentity.current) return
      if (error || !Array.isArray(data)) throw new Error('Staff lookup failed')
      setState(previous => ({ ...previous, rows: data, identity, loading: false, error: null }))
    } catch {
      if (version !== generation.current || identity !== currentIdentity.current) return
      setState(previous => ({ ...previous, rows: [], identity, loading: false,
        error: 'Unable to verify staff accounts. Check your connection and owner access, then refresh.' }))
    }
  }, [identity, isOnline, ownerId])

  useEffect(() => {
    submitting.current = false
    setState({ rows: [], identity: null, loading: false, busy: false, error: null })
    void refresh()
    return () => { generation.current += 1; submitting.current = null }
  }, [refresh])

  const save = useCallback(async ({ userId, enabled, staffRole, reason }) => {
    if (!ownerId || !isOnline) return { error: 'Owner access and an online connection are required.' }
    if (!canOperate(ownerId)) return { error: 'Unlock the owner account before changing staff access.' }
    if (submitting.current || state.loading) return { error: 'Please wait for the current request.' }
    if (state.identity !== identity || state.error || !state.rows.some(row => row.id === userId)) {
      return { error: 'Refresh staff accounts before making this change.' }
    }
    if (userId === ownerId) return { error: 'Ask another owner to change your own access.' }
    if (typeof enabled !== 'boolean' || !['admin', 'cashier'].includes(staffRole)
        || typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 240) {
      return { error: 'Choose a role and enter a reason of 3–240 characters.' }
    }
    const submission = { identity }
    submitting.current = submission
    const version = ++generation.current
    setState(previous => ({ ...previous, busy: true, error: null }))
    try {
      const { data, error } = await runStaffOperation(ownerId, () => supabase.rpc(enabled ? 'approve_staff' : 'set_staff_enabled', enabled
        ? { p_user_id: userId, p_role: staffRole, p_reason: reason.trim() }
        : { p_user_id: userId, p_enabled: false, p_reason: reason.trim() }))
      if (version !== generation.current || identity !== currentIdentity.current) return { error: 'Account changed. Refresh to verify the result.' }
      if (error || data?.user_id !== userId || data?.is_enabled !== enabled || (enabled && data?.role !== staffRole)) {
        throw new Error('Unconfirmed staff change')
      }
      await refresh()
      if (identity !== currentIdentity.current || submitting.current !== submission) return { error: 'Account changed. Refresh to verify the result.' }
      return { saved: true }
    } catch {
      if (version !== generation.current || identity !== currentIdentity.current) return { error: 'Account changed. Refresh to verify the result.' }
      const error = 'Could not confirm this change. Refresh staff accounts before retrying. The last active owner must remain enabled.'
      setState(previous => ({ ...previous, rows: [], error }))
      return { error }
    } finally {
      if (identity === currentIdentity.current && submitting.current === submission) {
        submitting.current = false
        setState(previous => ({ ...previous, busy: false }))
      }
    }
  }, [identity, isOnline, ownerId, refresh, state, canOperate, runStaffOperation])

  const visible = Boolean(ownerId && state.identity === identity)
  return { ownerId, isOnline, staff: visible ? state.rows : [], loading: visible && state.loading,
    busy: visible && state.busy, error: visible ? state.error : null, refresh, save }
}
