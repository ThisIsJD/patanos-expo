import React from 'react'
import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import RecoveryForm from '@/src/components/auth/RecoveryForm'

let mockRecovery
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }))
jest.mock('@/src/contexts/RecoveryContext', () => ({ useRecovery: () => mockRecovery }))
beforeEach(() => {
  mockRecovery = { status: 'idle', blocked: false, error: null, requestReset: jest.fn(async () => ({ error: null, message: 'Check your newest email.' })),
    updatePassword: jest.fn(async () => ({ error: 'Network failed' })), endRecovery: jest.fn(async () => ({ error: null })) }
})
test('request form sends the typed email and displays non-enumerating acknowledgement', async () => {
  const screen = render(<RecoveryForm />)
  fireEvent.changeText(screen.getByLabelText('Staff email'), 'staff@patanos.test')
  fireEvent.press(screen.getByRole('button', { name: 'Request recovery email' }))
  await waitFor(() => expect(screen.getByText('Check your newest email.')).toBeTruthy())
  expect(mockRecovery.requestReset).toHaveBeenCalledWith('staff@patanos.test')
})
test('failed password submission preserves both secure fields for retry', async () => {
  mockRecovery = { ...mockRecovery, status: 'ready', blocked: true }
  const screen = render(<RecoveryForm reset />)
  fireEvent.changeText(screen.getByLabelText('New password'), 'synthetic-new-password')
  fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'synthetic-new-password')
  fireEvent.press(screen.getByRole('button', { name: 'Save new password' }))
  await waitFor(() => expect(screen.getByText('Network failed')).toBeTruthy())
  expect(screen.getByLabelText('New password').props.value).toBe('synthetic-new-password')
  expect(screen.getByLabelText('Confirm new password').props.secureTextEntry).toBe(true)
})
test('a saved password clears fields even when sign-out is not confirmed', async () => {
  mockRecovery = { ...mockRecovery, status: 'ready', blocked: true,
    updatePassword: jest.fn(async () => ({ saved: true, error: 'Sign-out failed' })) }
  const screen = render(<RecoveryForm reset />)
  fireEvent.changeText(screen.getByLabelText('New password'), 'synthetic-new-password')
  fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'synthetic-new-password')
  fireEvent.press(screen.getByRole('button', { name: 'Save new password' }))
  await waitFor(() => expect(screen.getByText('Sign-out failed')).toBeTruthy())
  expect(screen.getByLabelText('New password').props.value).toBe('')
})
test('unverified links do not expose password inputs or update actions', () => {
  mockRecovery = { ...mockRecovery, status: 'error', blocked: true, error: 'Request a new link.' }
  const screen = render(<RecoveryForm reset />)
  expect(screen.queryByLabelText('New password')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Save new password' })).toBeNull()
  expect(screen.getByText('Request a new link.')).toBeTruthy()
})
test('double taps cannot start two password mutations', async () => {
  let complete
  mockRecovery = { ...mockRecovery, status: 'ready', blocked: true,
    updatePassword: jest.fn(() => new Promise(resolve => { complete = resolve })) }
  const screen = render(<RecoveryForm reset />)
  const button = screen.getByRole('button', { name: 'Save new password' })
  fireEvent.press(button)
  fireEvent.press(button)
  expect(mockRecovery.updatePassword).toHaveBeenCalledTimes(1)
  await act(async () => { complete({ error: 'Synthetic failure' }) })
})
test('failed recovery exit never navigates to login as if sign-out succeeded', async () => {
  mockRecovery = { ...mockRecovery, status: 'error', blocked: true,
    endRecovery: jest.fn(async () => ({ error: 'Sign-out unconfirmed' })) }
  const screen = render(<RecoveryForm reset />)
  fireEvent.press(screen.getByRole('button', { name: 'Return to login' }))
  await waitFor(() => expect(screen.getByText('Sign-out unconfirmed')).toBeTruthy())
  expect(mockReplace).not.toHaveBeenCalled()
})

test('unqualified environment explains recovery is disabled without sending a broken email', () => {
  mockRecovery = { ...mockRecovery, requestAvailable: false, requestUnavailableReason: 'Recovery email is not enabled yet.' }
  const screen = render(<RecoveryForm />)
  expect(screen.getByText('Recovery email is not enabled yet.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Request recovery email' }).props.accessibilityState.disabled).toBe(true)
  expect(mockRecovery.requestReset).not.toHaveBeenCalled()
})
