import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useStaffAdministration } from '@/src/hooks/useStaffAdministration'
import { useAuth } from '@/src/contexts/AuthContext'
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus'
import { supabase } from '@/src/lib/supabase'

jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/src/hooks/useNetworkStatus', () => ({ useNetworkStatus: jest.fn() }))

const rows = [{ id: 'owner', email: 'admin@patanos.test', role: 'admin', is_enabled: true },
  { id: 'cashier', email: 'cashier@patanos.test', role: 'cashier', is_enabled: false }]
const change = { userId: 'cashier', enabled: true, staffRole: 'cashier', reason: 'Reviewed staff account' }
let lookup
beforeEach(() => {
  useAuth.mockReturnValue({ session: { user: { id: 'owner' } }, role: 'admin', canOperate: () => true,
    runStaffOperation: async (_, operation) => operation() })
  useNetworkStatus.mockReturnValue({ isOnline: true })
  lookup = jest.fn().mockResolvedValue({ data: rows, error: null })
  supabase.from.mockImplementation(() => ({ select: () => ({ order: lookup }) }))
  supabase.rpc.mockResolvedValue({ data: { user_id: 'cashier', role: 'cashier', is_enabled: true }, error: null })
})
async function ready() {
  const hook = renderHook(useStaffAdministration)
  await waitFor(() => expect(hook.result.current.staff).toHaveLength(2))
  return hook
}
test('owner loads only required staff fields', async () => {
  const select = jest.fn(() => ({ order: lookup }))
  supabase.from.mockReturnValue({ select })
  await ready()
  expect(supabase.from).toHaveBeenCalledWith('profiles')
  expect(select).toHaveBeenCalledWith('id,email,full_name,role,is_enabled')
})
test.each(['cashier', null])('role %s cannot load or change staff accounts', async role => {
  useAuth.mockReturnValue({ session: { user: { id: 'cashier' } }, role })
  const { result } = renderHook(useStaffAdministration)
  let response
  await act(async () => { response = await result.current.save(change) })
  expect(response.error).toMatch(/Owner access/)
  expect(supabase.from).not.toHaveBeenCalled()
  expect(supabase.rpc).not.toHaveBeenCalled()
})
test('offline staff changes are never queued or sent', async () => {
  useNetworkStatus.mockReturnValue({ isOnline: false })
  const { result } = renderHook(useStaffAdministration)
  let response
  await act(async () => { response = await result.current.save(change) })
  expect(response.error).toMatch(/online/)
  expect(supabase.rpc).not.toHaveBeenCalled()
  expect(supabase.from).not.toHaveBeenCalled()
})
test('approval uses one atomic checked RPC then refreshes', async () => {
  const { result } = await ready()
  let response
  await act(async () => { response = await result.current.save({ ...change, reason: '  Reviewed staff account  ' }) })
  expect(response).toEqual({ saved: true })
  expect(supabase.rpc).toHaveBeenCalledWith('approve_staff', {
    p_user_id: 'cashier', p_role: 'cashier', p_reason: 'Reviewed staff account',
  })
  expect(lookup).toHaveBeenCalledTimes(2)
})
test('disable sends no role or privileged credential', async () => {
  supabase.rpc.mockResolvedValue({ data: { user_id: 'cashier', role: 'cashier', is_enabled: false }, error: null })
  const { result } = await ready()
  await act(() => result.current.save({ ...change, enabled: false }))
  expect(supabase.rpc).toHaveBeenCalledWith('set_staff_enabled', { p_user_id: 'cashier', p_enabled: false, p_reason: change.reason })
})
test.each([{ reason: '' }, { reason: 'x'.repeat(241) }, { staffRole: 'superuser' }, { enabled: null }, { userId: 'owner' }, { userId: 'missing' }])(
  'invalid/self/unknown change is rejected: %j', async invalid => {
    const { result } = await ready()
    let response
    await act(async () => { response = await result.current.save({ ...change, ...invalid }) })
    expect(response.error).toBeTruthy()
    expect(supabase.rpc).not.toHaveBeenCalled()
  },
)
test.each([{ error: { message: 'Denied' } }, { data: null }, { data: { user_id: 'someone-else', is_enabled: true } }])(
  'denied or malformed acknowledgement does not report success: %j', async ack => {
    supabase.rpc.mockResolvedValue(ack)
    const { result } = await ready()
    let response
    await act(async () => { response = await result.current.save(change) })
    expect(response.error).toMatch(/Refresh/)
    expect(response.saved).toBeUndefined()
    expect(result.current.staff).toEqual([])
  },
)
test('lost acknowledgement clears stale staff data and requires refresh before retry', async () => {
  supabase.rpc.mockRejectedValue(new Error('Lost response'))
  const { result } = await ready()
  await act(() => result.current.save(change))
  await act(() => result.current.save(change))
  expect(supabase.rpc).toHaveBeenCalledTimes(1)
  expect(result.current.error).toMatch(/Could not confirm/)
  await act(() => result.current.refresh())
  expect(result.current.staff).toHaveLength(2)
})
test('double taps cannot send two approval requests', async () => {
  let resolve
  supabase.rpc.mockImplementation(() => new Promise(done => { resolve = done }))
  const { result } = await ready()
  let pending
  await act(async () => {
    pending = result.current.save(change)
    expect((await result.current.save(change)).error).toMatch(/wait/)
  })
  expect(supabase.rpc).toHaveBeenCalledTimes(1)
  await act(async () => { resolve({ data: { user_id: 'cashier', role: 'cashier', is_enabled: true } }); await pending })
})
test('owner switch masks staff list and ignores old lookup results', async () => {
  let resolve
  lookup.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const { result, rerender } = renderHook(useStaffAdministration)
  useAuth.mockReturnValue({ session: { user: { id: 'other-owner' } }, role: 'admin' })
  lookup.mockResolvedValue({ data: [], error: null })
  rerender()
  await act(async () => { resolve({ data: rows, error: null }) })
  expect(result.current.staff).toEqual([])
  expect(result.current.ownerId).toBe('other-owner')
})
test('demotion removes staff list and prevents further mutations', async () => {
  const { result, rerender } = await ready()
  useAuth.mockReturnValue({ session: { user: { id: 'owner' } }, role: 'cashier' })
  rerender()
  expect(result.current.staff).toEqual([])
  await act(() => result.current.save(change))
  expect(supabase.rpc).not.toHaveBeenCalled()
})
test('failed list refresh clears previous staff information', async () => {
  const { result } = await ready()
  lookup.mockRejectedValue(new Error('Offline'))
  await act(() => result.current.refresh())
  expect(result.current.staff).toEqual([])
  expect(result.current.error).toMatch(/Unable to verify/)
})
test('late approval acknowledgement after owner switch cannot refresh or expose former staff', async () => {
  let resolve
  supabase.rpc.mockImplementation(() => new Promise(done => { resolve = done }))
  const { result, rerender } = await ready()
  let pending
  await act(async () => { pending = result.current.save(change) })
  useAuth.mockReturnValue({ session: { user: { id: 'other-owner' } }, role: 'admin' })
  lookup.mockResolvedValue({ data: [], error: null })
  rerender()
  let response
  await act(async () => {
    resolve({ data: { user_id: 'cashier', role: 'cashier', is_enabled: true } })
    response = await pending
  })
  expect(response.error).toMatch(/Account changed/)
  expect(result.current.staff).toEqual([])
  expect(lookup).toHaveBeenCalledTimes(2)
})
test('acknowledged approval and failed follow-up list are distinguished', async () => {
  const { result } = await ready()
  lookup.mockRejectedValue(new Error('Refresh failed'))
  let response
  await act(async () => { response = await result.current.save(change) })
  expect(response).toEqual({ saved: true })
  expect(result.current.staff).toEqual([])
  expect(result.current.error).toMatch(/Unable to verify/)
})
test('a locked owner cannot execute a stale staff-management confirmation', async () => {
  useAuth.mockReturnValue({ session: { user: { id: 'owner' } }, role: 'admin', canOperate: () => false })
  const { result } = await ready()
  let response
  await act(async () => { response = await result.current.save(change) })
  expect(response.error).toMatch(/Unlock/)
  expect(supabase.rpc).not.toHaveBeenCalled()
})
