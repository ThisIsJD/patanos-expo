import { describe, expect, test } from '@jest/globals'
import { validateOrder } from '@/src/utils/validateOrder'
import { order } from '../fixtures/menu'

describe('current order validation contract', () => {
  test.each(['dine-in', 'takeout', 'delivery'])('accepts %s', orderType => {
    expect(validateOrder({ ...order, orderType })).toEqual({ valid: true })
  })
  test('does not add modifier extras to unit_price twice', () => {
    expect(validateOrder(order)).toEqual({ valid: true })
  })
  test.each([0, -1, 101, '1'])('rejects quantity %s', quantity => {
    expect(validateOrder({ ...order, items: [{ ...order.items[0], quantity }] }).valid).toBe(false)
  })
  test.each([-1, 50001, '145', Infinity])('rejects price %s', unit_price => {
    expect(validateOrder({ ...order, items: [{ ...order.items[0], unit_price }] }).valid).toBe(false)
  })
  test('rejects empty orders, invalid types, and subtotal mismatches', () => {
    expect(validateOrder({ ...order, items: [] }).valid).toBe(false)
    expect(validateOrder({ ...order, orderType: 'invalid' }).valid).toBe(false)
    expect(validateOrder({ ...order, subtotal: 0 }).valid).toBe(false)
  })
  test('retains the existing one-peso tolerance until P2', () => {
    expect(validateOrder({ ...order, subtotal: 146 }).valid).toBe(true)
    expect(validateOrder({ ...order, subtotal: 146.01 }).valid).toBe(false)
  })
})
