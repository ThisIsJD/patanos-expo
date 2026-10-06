import { afterEach, expect, jest, test } from '@jest/globals'
import { createSessionLock } from '@/src/lib/sessionLock'

afterEach(() => { jest.useRealTimers() })
function unlocked() {
  const controller = createSessionLock()
  controller.bindUser('cashier')
  expect(controller.finishUnlock(controller.beginUnlock(), 'cashier')).toBe(true)
  return controller
}
test('restored identity is locked until an explicit matching unlock', () => {
  const controller = createSessionLock()
  controller.bindUser('cashier')
  expect(controller.canOperate('cashier')).toBe(false)
  const ticket = controller.beginUnlock()
  expect(controller.finishUnlock(ticket, 'other')).toBe(false)
  expect(controller.finishUnlock(ticket, 'cashier')).toBe(true)
  expect(controller.canOperate('cashier')).toBe(true)
  expect(controller.canOperate('other')).toBe(false)
})
test('foreground return never unlocks automatically', () => {
  const controller = unlocked()
  controller.setForeground(false)
  expect(controller.getSnapshot().locked).toBe(true)
  controller.setForeground(true)
  expect(controller.canOperate('cashier')).toBe(false)
})
test('late credential acknowledgement cannot unlock after background or manual lock', () => {
  const controller = unlocked()
  const ticket = controller.beginUnlock()
  controller.setForeground(false)
  controller.setForeground(true)
  expect(controller.finishUnlock(ticket, 'cashier')).toBe(false)
  const next = controller.beginUnlock()
  controller.lock()
  expect(controller.finishUnlock(next, 'cashier')).toBe(false)
})
test('account changes invalidate earlier sync guards, including switch away and back', () => {
  const controller = unlocked()
  const guard = controller.operationGuard('cashier')
  controller.bindUser('owner')
  controller.bindUser('cashier')
  controller.finishUnlock(controller.beginUnlock(), 'cashier')
  expect(controller.canOperate('cashier')).toBe(true)
  expect(guard()).toBe(false)
})
test('locking pauses new work but permits the already-started operation to settle', async () => {
  const controller = unlocked()
  const finish = controller.beginOperation('cashier')
  controller.lock('signout')
  expect(controller.beginOperation('cashier')).toBeNull()
  let drained = false
  const waiting = controller.waitForOperations().then(() => { drained = true })
  await Promise.resolve()
  expect(drained).toBe(false)
  finish(); finish()
  await waiting
  expect(drained).toBe(true)
  expect(controller.getSnapshot().operations).toBe(0)
})
test('transaction-drain timeout leaves the register locked and does not finish the sale', async () => {
  jest.useFakeTimers()
  const controller = unlocked()
  const finish = controller.beginOperation('cashier')
  controller.lock('signout')
  const check = expect(controller.waitForOperations(100)).rejects.toThrow(/current order action/)
  await jest.advanceTimersByTimeAsync(100)
  await check
  expect(controller.getSnapshot().operations).toBe(1)
  expect(controller.getSnapshot().locked).toBe(true)
  finish()
})
test('the lock controller contains no password/token storage', () => {
  const controller = unlocked()
  expect(Object.keys(controller.getSnapshot()).sort()).toEqual(['foreground','locked','operations','reason','userId'])
})
