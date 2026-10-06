import React from 'react'
import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Alert } from 'react-native'
import OpenOrdersScreen from '@/app/(pos)/open-orders'
import { useOrders } from '@/src/hooks/useOrders'

jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }))
jest.mock('@/src/hooks/useOrders', () => ({ useOrders: jest.fn() }))
jest.mock('@/src/components/common/Toast', () => () => null)
jest.mock('@/src/components/pos/PaymentSheet', () => () => null)
jest.mock('@/src/components/pos/OrderCard', () => {
  const { Button } = require('react-native')
  return function MockOrderCard({ order, onCancel }) {
    return <Button title="Cancel test order" onPress={() => onCancel(order)} />
  }
})

beforeEach(() => {
  useOrders.mockReturnValue({ openOrders: [{ id: 7, order_number: '007' }], completedOrders: [], queuedOrders: [],
    loading: false, isOnline: true, pendingCount: 0, refresh: jest.fn(), completeOrder: jest.fn(),
    cancelOrder: jest.fn().mockResolvedValue({ error: null }), syncNow: jest.fn() })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

test.each([
  ['Prepared / unsure: keep consumed', false],
  ['Not prepared: return portions', true],
])('cancellation choice "%s" forwards the explicit stock disposition', async (label, releaseStock) => {
  const screen = render(<OpenOrdersScreen />)
  fireEvent.press(screen.getByText('Cancel test order'))
  const [, explanation, buttons] = Alert.alert.mock.calls.at(-1)
  expect(explanation).toMatch(/uncertain portions stay consumed/)
  expect(buttons).toHaveLength(3)
  await act(() => buttons.find(button => button.text === label).onPress())
  expect(useOrders().cancelOrder).toHaveBeenCalledWith(7, expect.any(String), releaseStock)
  expect(useOrders().refresh).toHaveBeenCalled()
})

test('Keep dismisses without cancellation or stock effects', () => {
  const screen = render(<OpenOrdersScreen />)
  fireEvent.press(screen.getByText('Cancel test order'))
  expect(Alert.alert.mock.calls.at(-1)[2][0]).toEqual({ text: 'Keep', style: 'cancel' })
  expect(useOrders().cancelOrder).not.toHaveBeenCalled()
})
test('held queue records are explained without rendering another account’s sales', () => {
  useOrders.mockReturnValue({ ...useOrders(), heldCount: 2, pendingCount: 2 })
  const screen = render(<OpenOrdersScreen />)
  expect(screen.getByText(/2 queued record\(s\) held/)).toBeTruthy()
  expect(screen.getByText(/These are not submitted as you/)).toBeTruthy()
})
