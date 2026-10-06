import React from 'react'
import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { Alert } from 'react-native'
import SessionLockOverlay from '@/src/components/auth/SessionLockOverlay'
import { useAuth } from '@/src/contexts/AuthContext'
import { useRecovery } from '@/src/contexts/RecoveryContext'
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus'

jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/src/contexts/RecoveryContext', () => ({ useRecovery: jest.fn() }))
jest.mock('@/src/hooks/useNetworkStatus', () => ({ useNetworkStatus: jest.fn() }))
let auth
beforeEach(() => {
  auth = { session: { user: { id: 'owner', email: 'admin@patanos.test' } },
    lockState: { locked: true, foreground: true, operations: 0 },
    signIn: jest.fn().mockResolvedValue({ error: null }), signOut: jest.fn().mockResolvedValue({ error: null }) }
  useAuth.mockImplementation(() => auth)
  useRecovery.mockReturnValue({ blocked: false })
  useNetworkStatus.mockReturnValue({ isOnline: true })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
test('opaque lock cannot be dismissed by Android Back', () => {
  const screen = render(<SessionLockOverlay />)
  expect(screen.getByText('Register locked')).toBeTruthy()
  const modal = screen.UNSAFE_getByType(require('react-native').Modal)
  expect(modal.props.transparent).toBe(false)
  act(() => modal.props.onRequestClose())
  expect(auth.signIn).not.toHaveBeenCalled()
})
test.each([{ session: null }, { lockState: { locked: false, foreground: true } }])('no lock form for logged-out/unlocked state: %j', state => {
  Object.assign(auth, state)
  const screen = render(<SessionLockOverlay />)
  expect(screen.queryByText('Register locked')).toBeNull()
})
test('recovery remains accessible and does not expose ordinary POS via unlock', () => {
  useRecovery.mockReturnValue({ blocked: true })
  const screen = render(<SessionLockOverlay />)
  expect(screen.queryByText('Register locked')).toBeNull()
})
test('online unlock uses the existing account and clears the password field', async () => {
  const screen = render(<SessionLockOverlay />)
  fireEvent.changeText(screen.getByLabelText('Password to unlock register'), 'synthetic-password')
  await act(() => fireEvent.press(screen.getByLabelText('Unlock register')))
  expect(auth.signIn).toHaveBeenCalledWith('admin@patanos.test', 'synthetic-password')
  expect(screen.getByLabelText('Password to unlock register').props.value).toBe('')
})
test('failed unlock remains visible and shows an actionable error', async () => {
  auth.signIn.mockResolvedValue({ error: 'Invalid credentials' })
  const screen = render(<SessionLockOverlay />)
  fireEvent.changeText(screen.getByLabelText('Password to unlock register'), 'wrong')
  await act(() => fireEvent.press(screen.getByLabelText('Unlock register')))
  expect(screen.getByText('Invalid credentials')).toBeTruthy()
  expect(screen.getByText('Register locked')).toBeTruthy()
})
test('offline unlock is disabled and explained', () => {
  useNetworkStatus.mockReturnValue({ isOnline: false })
  const screen = render(<SessionLockOverlay />)
  fireEvent.press(screen.getByLabelText('Unlock register'))
  expect(auth.signIn).not.toHaveBeenCalled()
  expect(screen.getByText(/Offline: password unlock/)).toBeTruthy()
})
test('background clears typed password and blocks unlock', () => {
  const screen = render(<SessionLockOverlay />)
  fireEvent.changeText(screen.getByLabelText('Password to unlock register'), 'not-persisted')
  auth.lockState = { ...auth.lockState, foreground: false }
  screen.rerender(<SessionLockOverlay />)
  expect(screen.getByLabelText('Password to unlock register').props.value).toBe('')
  fireEvent.press(screen.getByLabelText('Unlock register'))
  expect(auth.signIn).not.toHaveBeenCalled()
})
test('switching requires confirmation and explains nondurable drafts', async () => {
  const screen = render(<SessionLockOverlay />)
  fireEvent.press(screen.getByLabelText('Sign out or switch account'))
  const [, message, buttons] = Alert.alert.mock.calls[0]
  expect(message).toMatch(/Pending and held orders stay/)
  expect(message).toMatch(/unsaved draft/)
  expect(auth.signOut).not.toHaveBeenCalled()
  await act(() => buttons[1].onPress())
  expect(auth.signOut).toHaveBeenCalledTimes(1)
})
test('double taps do not send multiple password requests', async () => {
  let resolve
  auth.signIn.mockImplementation(() => new Promise(done => { resolve = done }))
  const screen = render(<SessionLockOverlay />)
  fireEvent.changeText(screen.getByLabelText('Password to unlock register'), 'synthetic-password')
  fireEvent.press(screen.getByLabelText('Unlock register'))
  fireEvent.press(screen.getByLabelText('Unlock register'))
  expect(auth.signIn).toHaveBeenCalledTimes(1)
  await act(async () => resolve({ error: null }))
})
