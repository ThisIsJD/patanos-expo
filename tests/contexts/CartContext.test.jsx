import { describe, expect, test } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { CartProvider, useCart } from '@/src/contexts/CartContext'
import { drink, largeDrink, milk, shot } from '../fixtures/menu'

const renderCart = () => renderHook(() => useCart(), { wrapper: CartProvider })

describe('cart pricing and modifier identity', () => {
  test('includes modifiers once and multiplies by quantity', () => {
    const { result } = renderCart()
    act(() => result.current.addItem(drink, [milk, shot], 2))
    expect(result.current.items[0].unit_price).toBe(165)
    expect(result.current.subtotal).toBe(330)
  })
  test('merges identical modifier sets regardless of selection order', () => {
    const { result } = renderCart()
    act(() => {
      result.current.addItem(drink, [milk, shot])
      result.current.addItem(drink, [shot, milk])
    })
    expect(result.current.items).toHaveLength(1)
    expect(result.current.itemCount).toBe(2)
  })
  test('keeps different modifiers and variants on separate lines', () => {
    const { result } = renderCart()
    act(() => {
      result.current.addItem(drink, [milk])
      result.current.addItem(drink, [shot])
      result.current.addItem(largeDrink, [milk])
    })
    expect(result.current.items).toHaveLength(3)
  })
  test('preserves notes during item edits and resets order type on clear', () => {
    const { result } = renderCart()
    act(() => result.current.addItem(drink))
    const cartId = result.current.items[0].cartId
    act(() => result.current.updateNote(cartId, 'Less ice'))
    act(() => result.current.updateItem(cartId, largeDrink, [milk], 2))
    expect(result.current.items[0].notes).toBe('Less ice')
    expect(result.current.subtotal).toBe(350)
    act(() => { result.current.setOrderType('delivery'); result.current.clearCart() })
    expect(result.current.items).toEqual([])
    expect(result.current.orderType).toBe('dine-in')
  })
})
