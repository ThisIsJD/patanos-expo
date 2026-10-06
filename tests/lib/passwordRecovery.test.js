import { beforeEach, expect, jest, test } from '@jest/globals'
import { createPasswordRecovery } from '@/src/lib/passwordRecovery'
import { parseRecoveryLink, recoveryRedirect, validateRecoveryPassword } from '@/src/utils/recoveryLinks'
import { redirectSystemPath } from '../../app/+native-intent'

const redirect = recoveryRedirect('development')
const link = `${redirect}?code=synthetic-code-1234`
let auth, storage, records, controller, clock
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const create = options => createPasswordRecovery({ auth, storage, redirect, now: () => clock, ...options })
beforeEach(() => {
  clock = 10000000
  records = new Map()
  storage = { getItem: jest.fn(async key => records.get(key) || null),
    setItem: jest.fn(async (key, value) => { records.set(key, value) }),
    removeItem: jest.fn(async key => { records.delete(key) }) }
  auth = { exchangeCodeForSession: jest.fn(async () => ({ data: { redirectType: 'PASSWORD_RECOVERY',
    session: { user: { id: 'staff' } }, user: { id: 'staff' } }, error: null })),
    getUser: jest.fn(async () => ({ data: { user: { id: 'staff' } }, error: null })),
    updateUser: jest.fn(async () => ({ data: { user: { id: 'staff' } }, error: null })),
    resetPasswordForEmail: jest.fn(async () => ({ error: null })), signOut: jest.fn(async () => ({ error: null })) }
  controller = create()
})

test.each(['development', 'staging', 'production'])('%s only accepts its exact recovery scheme', environment => {
  const expected = recoveryRedirect(environment)
  expect(parseRecoveryLink(`${expected}?code=synthetic-code-1234`, expected)).toEqual({ code: 'synthetic-code-1234' })
})
test.each([
  'patanosexpo-staging://reset-password?code=synthetic-code-1234',
  'https://reset-password?code=synthetic-code-1234',
  `${redirect}?code=synthetic-code-1234&code=another-code`,
  `${redirect}?code=synthetic-code-1234&next=/order`,
  `${redirect}#access_token=synthetic-token`, redirect, `${redirect}?code=short`,
])('rejects malformed, wrong-build and bearer-token link: %s', path => {
  expect(parseRecoveryLink(path, redirect).error).toBeTruthy()
  expect(redirectSystemPath({ path })).toBe('/reset-password')
})
test('ordinary links are untouched and recovery codes never enter route history', () => {
  expect(parseRecoveryLink('patanosexpo-development://order', redirect)).toBeNull()
  expect(redirectSystemPath({ path: 'patanosexpo-development://order' })).toBe('patanosexpo-development://order')
  expect(redirectSystemPath({ path: link })).toBe('/reset-password')
})
test('no link or persisted gate allows ordinary login', async () => {
  await controller.initialize(null)
  expect(controller.getSnapshot().status).toBe('idle')
  expect(auth.getUser).not.toHaveBeenCalled()
})
test('persists a blocking gate before code exchange and verifies the SDK recovery result', async () => {
  const pending = deferred()
  auth.exchangeCodeForSession.mockImplementation(async () => {
    expect(JSON.parse(records.get(controller.markerKey))).toEqual({ pending: true })
    expect(controller.getSnapshot().status).toBe('processing')
    return pending.promise
  })
  const work = controller.initialize(link)
  await Promise.resolve()
  expect(controller.getSnapshot().status).toBe('processing')
  pending.resolve({ data: { redirectType: 'PASSWORD_RECOVERY', user: { id: 'staff' }, session: { user: { id: 'staff' } } } })
  await work
  expect(controller.getSnapshot()).toMatchObject({ status: 'ready', userId: 'staff' })
  expect(JSON.parse(records.get(controller.markerKey))).toEqual({ userId: 'staff' })
})
test.each([
  { error: { message: 'Expired backend detail' } },
  { data: { redirectType: 'SIGNED_IN', user: { id: 'staff' }, session: { user: { id: 'staff' } } } },
  { data: { redirectType: 'PASSWORD_RECOVERY', user: { id: 'other' }, session: { user: { id: 'staff' } } } },
  { data: null },
])('invalid exchange result stays locked without updating a password', async response => {
  auth.exchangeCodeForSession.mockResolvedValue(response)
  await controller.initialize(link)
  expect(controller.getSnapshot().status).toBe('error')
  expect(controller.getSnapshot().error).not.toContain('backend detail')
  expect(records.has(controller.markerKey)).toBe(true)
  expect((await controller.updatePassword('synthetic-new-password', 'synthetic-new-password')).error).toBeTruthy()
  expect(auth.updateUser).not.toHaveBeenCalled()
})
test('storage failure before exchange cannot create a recovery session', async () => {
  storage.setItem.mockRejectedValue(new Error('Disk unavailable'))
  await controller.initialize(link)
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  expect(controller.getSnapshot().status).toBe('error')
})
test('duplicate cold/warm links exchange only once', async () => {
  const work = controller.initialize(link)
  await controller.handleURL(link)
  await work
  await controller.handleURL(link)
  expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
})

test('recovery cannot exit while an exchange may still create a session', async () => {
  const pending = deferred()
  auth.exchangeCodeForSession.mockReturnValue(pending.promise)
  const work = controller.initialize(link)
  await Promise.resolve()
  expect((await controller.endRecovery()).error).toContain('wait')
  expect(auth.signOut).not.toHaveBeenCalled()
  pending.resolve({ error: { message: 'Synthetic expired link' } })
  await work
  await controller.endRecovery()
  expect(auth.signOut).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().status).toBe('idle')
})
test('a late initial-URL result cannot replace an already handled warm link', async () => {
  await controller.handleURL(link)
  await controller.initialize(null)
  expect(controller.getSnapshot().status).toBe('ready')
})
test('restart restores only the same live verified recovery account', async () => {
  await controller.initialize(link)
  const restarted = create()
  await restarted.initialize(null)
  expect(restarted.getSnapshot()).toMatchObject({ status: 'ready', userId: 'staff' })
  expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
})
test.each([JSON.stringify({ pending: true }), '{malformed', JSON.stringify({ userId: 'other' })])('incomplete/mismatched restart gate fails closed', async marker => {
  records.set(controller.markerKey, marker)
  await controller.initialize(null)
  expect(controller.getSnapshot().status).toBe('error')
})
test('an account change invalidates ready recovery', async () => {
  await controller.initialize(link)
  controller.observeSession({ user: { id: 'other' } })
  expect(controller.getSnapshot().status).toBe('error')
  expect((await controller.updatePassword('synthetic-new-password', 'synthetic-new-password')).error).toBeTruthy()
  expect(auth.updateUser).not.toHaveBeenCalled()
})
test('account changes during live identity recheck prevent password mutation', async () => {
  await controller.initialize(link)
  const pending = deferred()
  auth.getUser.mockReturnValue(pending.promise)
  const work = controller.updatePassword('synthetic-new-password', 'synthetic-new-password')
  controller.observeSession({ user: { id: 'other' } })
  pending.resolve({ data: { user: { id: 'staff' } } })
  expect((await work).error).toBeTruthy()
  expect(auth.updateUser).not.toHaveBeenCalled()
})
test('password validation runs before Auth API calls', async () => {
  await controller.initialize(link)
  expect((await controller.updatePassword('short', 'short')).error).toContain('12')
  expect(validateRecoveryPassword('synthetic-password', 'different')).toContain('match')
  expect(validateRecoveryPassword('a'.repeat(65), 'a'.repeat(65))).toContain('64')
  expect(auth.updateUser).not.toHaveBeenCalled()
})
test('successful update signs out only this installation and preserves pending records', async () => {
  records.set('patanos_offline_orders', '[{"id":"synthetic-pending-sale"}]')
  await controller.initialize(link)
  expect(await controller.updatePassword('synthetic-new-password', 'synthetic-new-password')).toEqual({ error: null, saved: true })
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(controller.getSnapshot()).toMatchObject({ status: 'idle', notice: 'Password updated. Sign in with your new password.' })
  expect(records.has(controller.markerKey)).toBe(false)
  expect(records.get('patanos_offline_orders')).toContain('synthetic-pending-sale')
})
test('update failure keeps a retryable verified state without false success', async () => {
  await controller.initialize(link)
  auth.updateUser.mockResolvedValue({ error: { message: 'Network unavailable' } })
  expect((await controller.updatePassword('synthetic-new-password', 'synthetic-new-password')).error).toBeTruthy()
  expect(controller.getSnapshot().status).toBe('ready')
  expect(auth.signOut).not.toHaveBeenCalled()
})
test('sign-out failure stays locked and can retry cleanup without repeating password update', async () => {
  await controller.initialize(link)
  auth.signOut.mockResolvedValueOnce({ error: { message: 'Network unavailable' } })
  expect(await controller.updatePassword('synthetic-new-password', 'synthetic-new-password')).toMatchObject({ saved: true, error: expect.any(String) })
  expect(controller.getSnapshot().status).toBe('saved')
  expect(records.has(controller.markerKey)).toBe(true)
  await controller.endRecovery(true)
  expect(controller.getSnapshot().status).toBe('idle')
  expect(auth.updateUser).toHaveBeenCalledTimes(1)
})
test('corrupt quota/storage failure refuses to send', async () => {
  await controller.initialize(null)
  records.set(controller.quotaKey, '{bad-json')
  expect((await controller.requestReset('staff@patanos.test')).error).toBeTruthy()
  expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
})
test('two-per-hour quota and a one-minute resend interval survive controller restart', async () => {
  await controller.initialize(null)
  expect((await controller.requestReset('staff@patanos.test')).error).toBeNull()
  expect((await controller.requestReset('staff@patanos.test')).error).toContain('limited')
  clock += 61000
  expect((await controller.requestReset('staff@patanos.test')).error).toBeNull()
  const restarted = create()
  await restarted.initialize(null)
  clock += 61000
  expect((await restarted.requestReset('staff@patanos.test')).error).toContain('limited')
  clock += 3600000
  expect((await restarted.requestReset('staff@patanos.test')).error).toBeNull()
  expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(3)
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('staff@patanos.test', { redirectTo: redirect })
  expect(records.get(controller.quotaKey)).not.toContain('staff@')
})
test('simultaneous email taps send once and ambiguous errors retain the quota reservation', async () => {
  await controller.initialize(null)
  const pending = deferred()
  auth.resetPasswordForEmail.mockReturnValue(pending.promise)
  const first = controller.requestReset('staff@patanos.test')
  expect((await controller.requestReset('staff@patanos.test')).error).toBeTruthy()
  pending.resolve({ error: { message: 'Unknown sensitive backend details' } })
  expect((await first).error).not.toContain('sensitive')
  expect(JSON.parse(records.get(controller.quotaKey))).toHaveLength(1)
  expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
})
test('unsupported native runtime and invalid email do not send or reserve quota', async () => {
  const unsupported = create({ supported: () => false })
  await unsupported.initialize(null)
  expect((await unsupported.requestReset('staff@patanos.test')).error).toContain('Android')
  await controller.initialize(null)
  expect((await controller.requestReset('not-email')).error).toContain('valid')
  expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  expect(records.has(controller.quotaKey)).toBe(false)
})

test('unqualified remote configuration cannot send a recovery email', async () => {
  const disabled = create({ enabled: () => false })
  await disabled.initialize(null)
  expect((await disabled.requestReset('staff@patanos.test')).error).toContain('not enabled')
  expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  expect(records.has(controller.quotaKey)).toBe(false)
})
test('rolled-back clocks cannot bypass an existing request reservation', async () => {
  await controller.initialize(null)
  await controller.requestReset('staff@patanos.test')
  clock -= 60000
  expect((await controller.requestReset('staff@patanos.test')).error).toBeTruthy()
  expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
})
test('disposed controllers cannot publish late exchange responses', async () => {
  const pending = deferred()
  auth.exchangeCodeForSession.mockReturnValue(pending.promise)
  const listener = jest.fn()
  controller.subscribe(listener)
  const work = controller.initialize(link)
  await Promise.resolve()
  controller.dispose()
  const calls = listener.mock.calls.length
  pending.resolve({ error: { message: 'Network unavailable' } })
  await work
  expect(listener).toHaveBeenCalledTimes(calls)
})
