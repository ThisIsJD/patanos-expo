import React from 'react'
import { expect, jest, test } from '@jest/globals'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import PaymentSheet from '@/src/components/pos/PaymentSheet'

const order = { id: 7, order_number: '007', total_amount: 180 }

test('failed cash payment keeps the entered tender and re-enables confirmation', async () => {
  const confirm = jest.fn().mockResolvedValue({ error: 'Order is not open' })
  const screen = render(<PaymentSheet visible order={order} onConfirm={confirm} onClose={jest.fn()} />)
  fireEvent.changeText(screen.getByPlaceholderText('0.00'), '200')
  fireEvent.press(screen.getByText('Confirm Payment'))
  await waitFor(() => expect(screen.getByText('Confirm Payment')).toBeTruthy())
  expect(screen.getByPlaceholderText('0.00').props.value).toBe('200')
})

test('failed GCash payment keeps the selected method and reference', async () => {
  const screen = render(<PaymentSheet visible order={order} onConfirm={jest.fn().mockResolvedValue({ error: 'Network unavailable' })} onClose={jest.fn()} />)
  fireEvent.press(screen.getByText('GCash'))
  fireEvent.changeText(screen.getByPlaceholderText('e.g. 1234567890'), 'Synthetic-reference')
  fireEvent.press(screen.getByText('Confirm Payment'))
  await waitFor(() => expect(screen.getByText('Confirm Payment')).toBeTruthy())
  expect(screen.getByPlaceholderText('e.g. 1234567890').props.value).toBe('Synthetic-reference')
})

test('successful payment clears fields for the next sale', async () => {
  const screen = render(<PaymentSheet visible order={order} onConfirm={jest.fn().mockResolvedValue({ error: null })} onClose={jest.fn()} />)
  fireEvent.changeText(screen.getByPlaceholderText('0.00'), '200')
  fireEvent.press(screen.getByText('Confirm Payment'))
  await waitFor(() => expect(screen.getByPlaceholderText('0.00').props.value).toBe(''))
})
