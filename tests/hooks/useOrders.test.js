import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useOrders } from '@/src/hooks/useOrders'
import { supabase } from '@/src/lib/supabase'
import { useAuth } from '@/src/contexts/AuthContext'
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus'
import { enqueue, getQueue, syncQueue } from '@/src/lib/offlineQueue'
import { order } from '../fixtures/menu'

jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }))
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/src/hooks/useNetworkStatus', () => ({ useNetworkStatus: jest.fn() }))
jest.mock('@/src/lib/offlineQueue', () => ({ enqueue: jest.fn(), getQueue: jest.fn().mockResolvedValue([]), syncQueue: jest.fn() }))

beforeEach(() => {
  useAuth.mockReturnValue({ session: { user: { id: 'staff' } }, canOperate: () => true,
    operationGuard: () => () => true, runStaffOperation: async (_, operation) => operation() })
  useNetworkStatus.mockReturnValue({ isOnline: true, onStatusChange: jest.fn(() => jest.fn()) })
  const query = { select: jest.fn(), eq: jest.fn(), gte: jest.fn(), order: jest.fn(), limit: jest.fn(), then: resolve => Promise.resolve({ data: [] }).then(resolve) }
  for (const method of ['select', 'eq', 'gte', 'order', 'limit']) query[method].mockReturnValue(query)
  supabase.from.mockReturnValue(query)
  const channel = { on: jest.fn(), subscribe: jest.fn() }
  channel.on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  supabase.channel.mockReturnValue(channel)
  supabase.rpc.mockResolvedValue({ data: { id: 7, status: 'completed' }, error: null })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

test('payment uses a checked RPC without trusting client change or completion time', async () => {
  const { result } = renderHook(useOrders)
  await act(() => result.current.completeOrder({ orderId: 7, paymentMethod: 'cash', amountTendered: 200, changeAmount: 999 }))
  expect(supabase.rpc).toHaveBeenCalledWith('complete_order', { p_order_id: 7, p_payment_method: 'cash', p_amount_tendered: 200, p_payment_ref: null })
})

test('cancellation sends only identity and reason to the checked RPC', async () => {
  const { result } = renderHook(useOrders)
  await act(() => result.current.cancelOrder(7, 'Customer changed order'))
  expect(supabase.rpc).toHaveBeenCalledWith('cancel_order', { p_order_id: 7, p_reason: 'Customer changed order', p_release_stock: false })
})

test('only explicit unprepared cancellation requests stock release', async () => {
  const { result } = renderHook(useOrders)
  await act(() => result.current.cancelOrder(7, 'Not prepared', true))
  expect(supabase.rpc).toHaveBeenCalledWith('cancel_order', { p_order_id: 7, p_reason: 'Not prepared', p_release_stock: true })
})

test.each(['completeOrder', 'cancelOrder'])('%s reports denied/conflicting transitions instead of success', async operation => {
  supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Order is not open' } })
  const { result } = renderHook(useOrders)
  let response
  await act(async () => { response = await result.current[operation](operation === 'cancelOrder' ? 7 : { orderId: 7, paymentMethod: 'cash', amountTendered: 200 }) })
  expect(response.error).toBe('Order is not open')
  expect(Alert.alert).toHaveBeenCalled()
})

test.each(['completeOrder', 'cancelOrder'])('%s handles transport exceptions without a false success', async operation => {
  supabase.rpc.mockRejectedValue(new Error('Network unavailable'))
  const { result } = renderHook(useOrders)
  let response
  await act(async () => { response = await result.current[operation](operation === 'cancelOrder' ? 7 : { orderId: 7, paymentMethod: 'cash', amountTendered: 200 }) })
  expect(response.error).toMatch(/Unable/)
})

test.each(['completeOrder', 'cancelOrder'])('%s rejects an empty server acknowledgment', async operation => {
  supabase.rpc.mockResolvedValue({ data: null, error: null })
  const { result } = renderHook(useOrders)
  let response
  await act(async () => { response = await result.current[operation](operation === 'cancelOrder' ? 7 : { orderId: 7, paymentMethod: 'cash', amountTendered: 200 }) })
  expect(response.error).toMatch(/Unable/)
})

test('offline placement preserves financial fields and tags the original staff identity', async () => {
  useNetworkStatus.mockReturnValue({ isOnline: false, onStatusChange: jest.fn(() => jest.fn()) })
  enqueue.mockResolvedValue(1)
  const { result } = renderHook(useOrders)
  let response
  await act(async () => { response = await result.current.placeOrder(order) })
  expect(enqueue).toHaveBeenCalledWith({ items: order.items, orderType: order.orderType, subtotal: order.subtotal, notes: order.notes, staffUserId: 'staff' })
  expect(supabase.rpc).not.toHaveBeenCalled()
  expect(response.data.offline).toBe(true)
})

test('online placement uses the same item/modifier prices as the unchanged offline payload', async () => {
  const { result } = renderHook(useOrders)
  await act(() => result.current.placeOrder(order))
  expect(supabase.rpc).toHaveBeenCalledWith('place_order', expect.objectContaining({
    p_order_type: order.orderType, p_subtotal: order.subtotal, p_total_amount: order.subtotal,
    p_items: [expect.objectContaining({ menu_item_id: order.items[0].menu_item_id, unit_price: order.items[0].unit_price,
      quantity: order.items[0].quantity, modifiers: order.items[0].modifiers })],
  }))
  expect(enqueue).not.toHaveBeenCalled()
})

test.each(['completeOrder', 'cancelOrder', 'placeOrder'])('locked %s cannot mutate the server or queue', async operation => {
  useAuth.mockReturnValue({ session: { user: { id: 'staff' } }, canOperate: () => false,
    operationGuard: () => () => false, runStaffOperation: async () => ({ error: 'Unlock first' }) })
  const { result } = renderHook(useOrders)
  let response
  await act(async () => {
    response = await (operation === 'completeOrder' ? result.current.completeOrder({ orderId: 7 })
      : operation === 'cancelOrder' ? result.current.cancelOrder(7) : result.current.placeOrder(order))
  })
  expect(response.error).toMatch(/Unlock/)
  expect(supabase.rpc).not.toHaveBeenCalled()
  expect(enqueue).not.toHaveBeenCalled()
})
test('locked sync cannot consume retries or start a queue pass', async () => {
  useAuth.mockReturnValue({ session: { user: { id: 'staff' } }, canOperate: () => false, operationGuard: () => () => false })
  const { result } = renderHook(useOrders)
  await act(() => result.current.syncNow())
  expect(syncQueue).not.toHaveBeenCalled()
})
test('queue sync checks the original actor, and a paused pass can be retried after unlocking', async () => {
  const canContinue = jest.fn().mockReturnValue(false)
  useAuth.mockReturnValue({ session: { user: { id: 'staff' } }, canOperate: () => true,
    operationGuard: () => canContinue, runStaffOperation: async (_, operation) => operation() })
  getQueue.mockResolvedValue([{ ...order, staffUserId: 'staff' }])
  syncQueue.mockResolvedValue({ synced: 0, failed: 0 })
  const { result } = renderHook(useOrders)
  await act(() => result.current.syncNow())
  expect(syncQueue).not.toHaveBeenCalled()
  canContinue.mockReturnValue(true)
  await act(() => result.current.syncNow())
  expect(syncQueue).toHaveBeenCalledTimes(1)
  const options = syncQueue.mock.calls[0][1]
  expect(options.canSubmit({ staffUserId: 'staff' })).toBe(true)
  expect(options.canSubmit({ staffUserId: 'other' })).toBe(false)
  expect(options.canSubmit({})).toBe(false)
})
test('queued display hides other staff and legacy payloads while reporting held count', async () => {
  getQueue.mockResolvedValue([{ ...order, id: 'own', staffUserId: 'staff' },
    { ...order, id: 'other', staffUserId: 'owner' }, { ...order, id: 'legacy' }])
  const { result } = renderHook(useOrders)
  await act(() => result.current.refresh())
  expect(result.current.queuedOrders.map(record => record.id)).toEqual(['own'])
  expect(result.current.pendingCount).toBe(3)
  expect(result.current.heldCount).toBe(2)
})
