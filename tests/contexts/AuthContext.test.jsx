import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext'
import { supabase } from '@/src/lib/supabase'

jest.mock('@/src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn() }, from: jest.fn() } }))

const ownerSession = { user: { id: 'owner' } }
const cashierSession = { user: { id: 'cashier' } }
const owner = { id: 'owner', role: 'admin', email: 'owner@patanos.test' }
const cashier = { id: 'cashier', role: 'cashier', email: 'cashier@patanos.test' }
let authCallback
let appStateCallback
const unsubscribe = jest.fn()

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
function profileResponse(response) {
  const query = { abortSignal: () => query, single: () => typeof response === 'function' ? response() : response }
  supabase.from.mockReturnValue({ select: () => ({ eq: () => query }) })
}
const renderAuth = () => renderHook(useAuth, { wrapper: AuthProvider })

beforeEach(() => {
  AppState.currentState = 'active'
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
    if (event === 'change') appStateCallback = callback
    return { remove: jest.fn() }
  })
  supabase.auth.getSession.mockResolvedValue({ data: { session: ownerSession }, error: null })
  supabase.auth.onAuthStateChange.mockImplementation(callback => {
    authCallback = callback
    return { data: { subscription: { unsubscribe } } }
  })
  supabase.auth.signOut.mockResolvedValue({ error: null })
  profileResponse(Promise.resolve({ data: owner, error: null }))
})

test('initial session stays loading until the matching staff profile resolves', async () => {
  const profile = deferred()
  profileResponse(profile.promise)
  const { result } = renderAuth()
  await waitFor(() => expect(supabase.from).toHaveBeenCalled())
  expect(result.current.loading).toBe(true)
  expect(result.current.role).toBeNull()
  await act(async () => { profile.resolve({ data: owner, error: null }) })
  expect(result.current.loading).toBe(false)
  expect(result.current.role).toBe('admin')
})

test('account changes immediately mask the old role and ignore stale profile responses', async () => {
  const staleOwner = deferred()
  profileResponse(staleOwner.promise)
  const { result } = renderAuth()
  await waitFor(() => expect(supabase.from).toHaveBeenCalled())
  profileResponse(Promise.resolve({ data: cashier, error: null }))
  act(() => { authCallback('SIGNED_IN', cashierSession) })
  expect(result.current.role).toBeNull()
  await waitFor(() => expect(result.current.role).toBe('cashier'))
  await act(async () => { staleOwner.resolve({ data: owner, error: null }) })
  expect(result.current.profile).toEqual(cashier)
})

test('slow bootstrap session cannot overwrite a later Auth event', async () => {
  const bootstrap = deferred()
  supabase.auth.getSession.mockReturnValue(bootstrap.promise)
  const { result } = renderAuth()
  profileResponse(Promise.resolve({ data: cashier, error: null }))
  act(() => { authCallback('SIGNED_IN', cashierSession) })
  await waitFor(() => expect(result.current.role).toBe('cashier'))
  await act(async () => { bootstrap.resolve({ data: { session: ownerSession } }) })
  expect(result.current.session).toEqual(cashierSession)
})

test.each([
  ['missing profile', { data: null, error: null }],
  ['failed request', { data: null, error: { message: 'Backend detail must not be shown' } }],
  ['wrong identity', { data: cashier, error: null }],
  ['unsupported role', { data: { ...owner, role: 'superadmin' }, error: null }],
  ['disabled profile', { data: { ...owner, is_enabled: false }, error: null }],
])('%s never grants access and offers an actionable retry state', async (label, response) => {
  profileResponse(Promise.resolve(response))
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.role).toBeNull()
  expect(result.current.authError).toBeTruthy()
  expect(result.current.authError).not.toContain('Backend detail')
})

test('permission retry can recover from a profile request failure', async () => {
  profileResponse(() => Promise.reject(new Error('Network unavailable')))
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.loading).toBe(false))
  profileResponse(Promise.resolve({ data: owner, error: null }))
  await act(() => result.current.refreshProfile())
  expect(result.current.role).toBe('admin')
  expect(result.current.authError).toBeNull()
})

test('same-account token refresh does not remove a previously resolved staff profile while rechecking', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  const refreshedProfile = deferred()
  profileResponse(refreshedProfile.promise)
  act(() => { authCallback('TOKEN_REFRESHED', ownerSession) })
  expect(result.current.loading).toBe(false)
  expect(result.current.role).toBe('admin')
  await act(async () => { refreshedProfile.resolve({ data: { ...owner, role: 'cashier' }, error: null }) })
  await waitFor(() => expect(result.current.role).toBe('cashier'))
})

test('signed-out state ignores pending requests and leaves the persisted order queue intact', async () => {
  await AsyncStorage.setItem('patanos_offline_orders', '[{"id":"synthetic-pending-sale"}]')
  const pending = deferred()
  profileResponse(pending.promise)
  const { result } = renderAuth()
  await waitFor(() => expect(supabase.from).toHaveBeenCalled())
  act(() => { authCallback('SIGNED_OUT', null) })
  await act(async () => { pending.resolve({ data: owner, error: null }) })
  expect(result.current.session).toBeNull()
  expect(result.current.role).toBeNull()
  expect(await AsyncStorage.getItem('patanos_offline_orders')).toContain('synthetic-pending-sale')
})

test('sign-out failure is returned instead of reporting success', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  supabase.auth.signOut.mockResolvedValue({ error: { message: 'Network unavailable' } })
  let response
  await act(async () => { response = await result.current.signOut() })
  expect(response.error).toBeTruthy()
  expect(result.current.role).toBe('admin')
})

test('session restoration failure stays outside protected screens until a successful retry', async () => {
  supabase.auth.getSession.mockRejectedValueOnce(new Error('Network unavailable'))
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.session).toBeNull()
  expect(result.current.role).toBeNull()
  expect(result.current.authError).toBeTruthy()
  await act(() => result.current.refreshProfile())
  expect(result.current.role).toBe('admin')
  expect(result.current.authError).toBeNull()
})

test('sign-in resolves the profile when no Auth callback has arrived', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.loading).toBe(false))
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: cashierSession }, error: null })
  profileResponse(Promise.resolve({ data: cashier, error: null }))
  await act(() => result.current.signIn('cashier@patanos.test', 'synthetic-password'))
  expect(result.current.role).toBe('cashier')
})

test('unmount unsubscribes and cannot apply a delayed profile result', async () => {
  const profile = deferred()
  profileResponse(profile.promise)
  const { unmount } = renderAuth()
  await waitFor(() => expect(supabase.from).toHaveBeenCalled())
  unmount()
  await act(async () => { profile.resolve({ data: owner }) })
  expect(unsubscribe).toHaveBeenCalled()
})

async function unlockOwner(result) {
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: ownerSession }, error: null })
  await act(() => result.current.signIn('owner@patanos.test', 'synthetic-password'))
  expect(result.current.canOperate('owner')).toBe(true)
}
test('restored login starts locked; cached permission refresh does not unlock it', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  expect(result.current.lockState.locked).toBe(true)
  expect(result.current.canOperate('owner')).toBe(false)
  await act(() => result.current.refreshProfile())
  expect(result.current.lockState.locked).toBe(true)
})
test('online same-account password and matching profile are required to unlock', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  await unlockOwner(result)
  expect(result.current.lockState.locked).toBe(false)
  profileResponse(Promise.resolve({ data: { ...owner, is_enabled: false }, error: null }))
  await act(() => result.current.refreshProfile())
  expect(result.current.lockState.locked).toBe(true)
  expect(result.current.canOperate('owner')).toBe(false)
})
test('a different email cannot replace a signed-in identity before sign-out', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  let response
  await act(async () => { response = await result.current.signIn('cashier@patanos.test', 'synthetic-password') })
  expect(response.error).toMatch(/Sign out first/)
  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
})
test('bad password and failed profile verification cannot unlock', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } })
  await act(() => result.current.signIn('owner@patanos.test', 'wrong'))
  expect(result.current.lockState.locked).toBe(true)
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: ownerSession }, error: null })
  profileResponse(Promise.resolve({ data: null, error: { message: 'Denied' } }))
  await act(() => result.current.signIn('owner@patanos.test', 'synthetic-password'))
  expect(result.current.lockState.locked).toBe(true)
})
test('background locks immediately and foreground return requires another password check', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  await unlockOwner(result)
  act(() => appStateCallback('background'))
  expect(result.current.canOperate('owner')).toBe(false)
  act(() => appStateCallback('active'))
  expect(result.current.lockState.locked).toBe(true)
  expect(result.current.role).toBe('admin')
})
test('late sign-in response after backgrounding does not unlock on return', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  const credentials = deferred()
  supabase.auth.signInWithPassword.mockReturnValue(credentials.promise)
  let pending
  await act(async () => { pending = result.current.signIn('owner@patanos.test', 'synthetic-password') })
  act(() => { appStateCallback('background'); appStateCallback('active') })
  let response
  await act(async () => { credentials.resolve({ data: { session: ownerSession }, error: null }); response = await pending })
  expect(response.error).toMatch(/Unlock was not confirmed/)
  expect(result.current.lockState.locked).toBe(true)
})
test('locked handlers cannot start a new order operation', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  const operation = jest.fn()
  let response
  await act(async () => { response = await result.current.runStaffOperation('owner', operation) })
  expect(response.error).toMatch(/Unlock/)
  expect(operation).not.toHaveBeenCalled()
})
test('sign-out locks first, waits for in-flight work, then uses local scope without deleting queues', async () => {
  await AsyncStorage.setItem('patanos_offline_orders', '[{"id":"pending","staffUserId":"owner"}]')
  await AsyncStorage.setItem('patanos_dead_orders', '[{"id":"held-failure"}]')
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  await unlockOwner(result)
  const sale = deferred()
  let operation, logout
  await act(async () => { operation = result.current.runStaffOperation('owner', () => sale.promise) })
  await act(async () => { logout = result.current.signOut() })
  expect(result.current.lockState.locked).toBe(true)
  expect(supabase.auth.signOut).not.toHaveBeenCalled()
  await act(async () => { sale.resolve({ data: { id: 'acknowledged' } }); await operation; await logout })
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(result.current.session).toBeNull()
  expect(await AsyncStorage.getItem('patanos_offline_orders')).toContain('pending')
  expect(await AsyncStorage.getItem('patanos_dead_orders')).toContain('held-failure')
})
test('failed sign-out keeps the current identity locked', async () => {
  const { result } = renderAuth()
  await waitFor(() => expect(result.current.role).toBe('admin'))
  await unlockOwner(result)
  supabase.auth.signOut.mockResolvedValue({ error: { message: 'Network unavailable' } })
  await act(() => result.current.signOut())
  expect(result.current.session).toEqual(ownerSession)
  expect(result.current.lockState.locked).toBe(true)
  expect(result.current.canOperate('owner')).toBe(false)
})
