import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { enqueue, getQueue, getDeadLetters, syncQueue } from '@/src/lib/offlineQueue'
import { order } from '../fixtures/menu'

beforeEach(async () => { await AsyncStorage.clear() })

describe('existing persisted queue behavior', () => {
  test('persists payload, snapshots and notes before enqueue resolves', async () => {
    expect(await enqueue(order)).toBe(1)
    expect(await getQueue()).toEqual([expect.objectContaining(order)])
  })
  test('syncs and removes a successful order', async () => {
    await enqueue(order)
    const place = jest.fn().mockResolvedValue({ data: { id: 'remote' }, error: null })
    expect(await syncQueue(place)).toEqual({ synced: 1, failed: 0 })
    expect(place).toHaveBeenCalledTimes(1)
    expect(await getQueue()).toEqual([])
  })
  test('increments retries and moves the fifth failure to dead letters', async () => {
    await enqueue(order)
    const place = jest.fn().mockResolvedValue({ data: null, error: 'Unavailable' })
    for (let retry = 1; retry <= 4; retry++) {
      expect(await syncQueue(place)).toEqual({ synced: 0, failed: 1 })
      expect((await getQueue())[0]._retryCount).toBe(retry)
    }
    await syncQueue(place)
    expect(await getQueue()).toEqual([])
    expect(await getDeadLetters()).toEqual([expect.objectContaining({
      ...order, _retryCount: 5, _lastError: 'Unavailable',
    })])
  })
  test('retains queued data and releases the lock if the RPC throws', async () => {
    await enqueue(order)
    await expect(syncQueue(async () => { throw new Error('Network failure') })).rejects.toThrow('Network failure')
    expect(await getQueue()).toHaveLength(1)
    expect(await syncQueue(async () => ({ data: {}, error: null }))).toEqual({ synced: 1, failed: 0 })
  })
})

describe('session lock and actor-preserving queue pause', () => {
  test('locked sync retains payloads/retries and does not call the sender', async () => {
    await enqueue({ ...order, staffUserId: 'cashier', _retryCount: 4 })
    const before = await getQueue()
    const send = jest.fn()
    expect(await syncQueue(send, { canContinue: () => false })).toEqual({ synced: 0, failed: 0 })
    expect(send).not.toHaveBeenCalled()
    expect(await getQueue()).toEqual(before)
    expect(await getDeadLetters()).toEqual([])
  })
  test('pause after acknowledged submission retains following records without retries', async () => {
    await enqueue({ ...order, staffUserId: 'cashier' })
    await enqueue({ ...order, staffUserId: 'cashier', _retryCount: 4 })
    const before = await getQueue()
    let allowed = true
    const send = jest.fn(async () => { allowed = false; return { data: { id: 'remote' }, error: null } })
    expect(await syncQueue(send, { canContinue: () => allowed })).toEqual({ synced: 1, failed: 0 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(await getQueue()).toEqual([before[1]])
    expect(await getDeadLetters()).toEqual([])
  })
  test('other-account and unowned legacy orders are held, not submitted or dead-lettered', async () => {
    await enqueue({ ...order, staffUserId: 'owner', _retryCount: 4 })
    await enqueue({ ...order, staffUserId: 'cashier' })
    await enqueue({ ...order, _retryCount: 4 })
    const before = await getQueue()
    const send = jest.fn().mockResolvedValue({ data: { id: 'remote' }, error: null })
    expect(await syncQueue(send, { canSubmit: record => record.staffUserId === 'cashier' })).toEqual({ synced: 1, failed: 0 })
    expect(send).toHaveBeenCalledWith(before[1])
    expect(await getQueue()).toEqual([before[0], before[2]])
    expect(await getDeadLetters()).toEqual([])
  })
})
