import { beforeEach, describe, expect, test } from '@jest/globals'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { enqueue, getQueue, syncQueue } from '@/src/lib/offlineQueue'
import { validateOrder } from '@/src/utils/validateOrder'
import { order } from '../fixtures/menu'

beforeEach(async () => { await AsyncStorage.clear() })

// Expected failures are executable desired invariants, not implemented fixes.
// Jest fails if a failing test starts passing: remove the marker after its P2/P3 fix.
describe('known defects awaiting P2/P3', () => {
  test.failing.each([
    ['NaN quantity', { ...order, items: [{ ...order.items[0], quantity: NaN }] }],
    ['fractional quantity', { ...order, items: [{ ...order.items[0], quantity: 1.5 }], subtotal: 217.5 }],
    ['NaN price', { ...order, items: [{ ...order.items[0], unit_price: NaN }] }],
    ['NaN subtotal', { ...order, subtotal: NaN }],
    ['missing item identity', { ...order, items: [{ ...order.items[0], menu_item_id: undefined }] }],
  ])('[P2-02] rejects %s', (label, payload) => {
    expect(validateOrder(payload).valid).toBe(false)
  })

  test.failing('[P3-02] preserves an order enqueued during sync', async () => {
    await enqueue(order)
    let release, started
    const gate = new Promise(resolve => { release = resolve })
    const began = new Promise(resolve => { started = resolve })
    const processing = syncQueue(async () => {
      started()
      await gate
      return { data: { id: 'remote' }, error: null }
    })
    await began
    await enqueue({ ...order, notes: 'Second sale' })
    release()
    await processing
    expect(await getQueue()).toEqual([expect.objectContaining({ notes: 'Second sale' })])
  })

  test.failing('[P2-04/P3-02] lost acknowledgment does not create a second sale', async () => {
    await enqueue(order)
    let commits = 0
    const simulatedServer = async () => {
      commits++
      return commits === 1
        ? { data: null, error: 'Response lost after commit' }
        : { data: { id: 'second-commit' }, error: null }
    }
    await syncQueue(simulatedServer)
    await syncQueue(simulatedServer)
    expect(commits).toBe(1)
  })
})
