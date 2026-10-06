import React, { useEffect } from 'react'
import { Button, Text } from 'react-native'
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'
import { act, fireEvent, render, renderRouter, waitFor } from 'expo-router/testing-library'
import { router, Slot } from 'expo-router'
import SessionNavigator from '@/src/components/auth/SessionNavigator'
import { CartProvider, useCart } from '@/src/contexts/CartContext'
// Explicit extension avoids Babel resolving the adjacent app.json instead of the route.
import Index from '../../app/index.jsx'

let mockAuthState
let mockRecoveryState
const mockListeners = new Set()
jest.mock('@/src/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }))
jest.mock('@/src/contexts/RecoveryContext', () => ({ useRecovery: () => {
  const { useSyncExternalStore } = require('react')
  return useSyncExternalStore(listener => { mockListeners.add(listener); return () => mockListeners.delete(listener) },
    () => mockRecoveryState, () => mockRecoveryState)
} }))
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => {
  const { useSyncExternalStore } = require('react')
  return useSyncExternalStore(listener => {
    mockListeners.add(listener)
    return () => mockListeners.delete(listener)
  }, () => mockAuthState, () => mockAuthState)
} }))

const posMount = jest.fn()
const adminMount = jest.fn()
function GroupLayout() { return <Slot /> }
function POSGroupLayout() { return <CartProvider><Slot /></CartProvider> }
function Login() { return <Text>Login destination</Text> }
function Reset() { return <Text>Recovery destination</Text> }
function POS() {
  const { itemCount, addItem } = useCart()
  useEffect(() => { posMount() }, [])
  return <><Text>POS destination</Text><Text>Draft items: {itemCount}</Text>
    <Button title="Add draft item" onPress={() => addItem({ id: 'synthetic-drink', name: 'Test drink', price: 39 })} /></>
}
function OwnerTools() {
  useEffect(() => { adminMount() }, [])
  return <Text>Owner tools destination</Text>
}
function renderNavigation(initialUrl = '/') {
  return renderRouter({ _layout: SessionNavigator, index: Index, 'reset-password': Reset,
    '(auth)/_layout': GroupLayout, '(auth)/login': Login,
    '(pos)/_layout': POSGroupLayout, '(pos)/order': POS,
    '(admin)/_layout': GroupLayout, '(admin)/settings': OwnerTools }, { initialUrl })
}
function setAuth(next) {
  act(() => { mockAuthState = { ...mockAuthState, ...next }; for (const listener of mockListeners) listener() })
}
beforeEach(() => {
  mockRecoveryState = { blocked: false, status: 'idle' }
  mockAuthState = { session: { user: { id: 'staff' } }, role: 'admin', loading: false,
    authError: null, refreshProfile: jest.fn().mockResolvedValue({ error: null }), signOut: jest.fn().mockResolvedValue({ error: null }) }
})
afterEach(() => { jest.useRealTimers() })

test('installed router and safe-area components exist in the test harness', () => {
  const sdk = require('expo-router')
  expect(sdk.Redirect).toBeDefined()
  expect(sdk.Stack.Protected).toBeDefined()
  expect(typeof Index).toBe('function')
  expect(require('@/src/components/auth/AccessState').default).toBeDefined()
  expect(require('react-native-safe-area-context').SafeAreaView).toBeDefined()
})

test('access state renders directly', () => {
  mockAuthState.loading = true
  const screen = render(<Index />)
  expect(screen.getByText('Checking staff access…')).toBeTruthy()
})

test('locking hides the register but preserves its mounted cart through unlock', async () => {
  const screen = renderNavigation()
  await waitFor(() => expect(screen.getByText('POS destination')).toBeTruthy())
  fireEvent.press(screen.getByText('Add draft item'))
  expect(screen.getByText('Draft items: 1')).toBeTruthy()
  const mountsBefore = posMount.mock.calls.length
  setAuth({ lockState: { locked: true, foreground: true } })
  expect(screen.getByText('Register locked')).toBeTruthy()
  expect(screen.queryByText('Draft items: 1')).toBeNull()
  expect(screen.getByText('Draft items: 1', { includeHiddenElements: true })).toBeTruthy()
  setAuth({ lockState: { locked: false, foreground: true } })
  expect(screen.queryByText('Register locked')).toBeNull()
  expect(screen.getByText('Draft items: 1')).toBeTruthy()
  expect(posMount.mock.calls.length).toBe(mountsBefore)
})

test.each(['admin', 'cashier'])('%s login lands on POS instead of owner content tools', async role => {
  mockAuthState.role = role
  const screen = renderNavigation('/(auth)/login')
  await waitFor(() => expect(screen.getByText('POS destination')).toBeTruthy())
  expect(adminMount).not.toHaveBeenCalled()
})

test('unresolved role never mounts owner tools or POS, even from an owner deep link', async () => {
  mockAuthState = { ...mockAuthState, role: null, loading: true }
  const screen = renderNavigation('/(admin)/settings')
  await waitFor(() => expect(screen.getByText('Checking staff access…')).toBeTruthy())
  expect(adminMount).not.toHaveBeenCalled()
  expect(posMount).not.toHaveBeenCalled()
  setAuth({ role: 'cashier', loading: false })
  await waitFor(() => expect(screen.getByText('POS destination')).toBeTruthy())
  expect(adminMount).not.toHaveBeenCalled()
})

test('cashier owner-tool deep links fall back to POS', async () => {
  mockAuthState.role = 'cashier'
  const screen = renderNavigation('/(admin)/settings')
  await waitFor(() => expect(screen.getByText('POS destination')).toBeTruthy())
  expect(adminMount).not.toHaveBeenCalled()
})

test('logged-out POS deep link goes to login without mounting POS', async () => {
  mockAuthState = { ...mockAuthState, session: null, role: null }
  const screen = renderNavigation('/(pos)/order')
  await waitFor(() => expect(screen.getByText('Login destination')).toBeTruthy())
  expect(posMount).not.toHaveBeenCalled()
})

test('failed profile lookup shows retry/sign-out without mounting protected content', async () => {
  mockAuthState = { ...mockAuthState, role: null, authError: 'Unable to verify staff access.' }
  const screen = renderNavigation('/(pos)/order')
  await waitFor(() => expect(screen.getByText('Staff access unavailable')).toBeTruthy())
  fireEvent.press(screen.getByRole('button', { name: 'Retry staff access' }))
  await waitFor(() => expect(mockAuthState.refreshProfile).toHaveBeenCalled())
  expect(posMount).not.toHaveBeenCalled()
})

test('same-user resolved token refresh keeps a mounted POS draft', async () => {
  const screen = renderNavigation()
  await waitFor(() => expect(screen.getByText('POS destination')).toBeTruthy())
  fireEvent.press(screen.getByText('Add draft item'))
  setAuth({ session: { user: { id: 'staff' } } })
  expect(screen.getByText('Draft items: 1')).toBeTruthy()
  expect(posMount).toHaveBeenCalledTimes(1)
})

test('demotion removes an already mounted owner screen from navigation', async () => {
  const screen = renderNavigation('/(admin)/settings')
  await waitFor(() => expect(screen.getByText('Owner tools destination')).toBeTruthy())
  setAuth({ role: 'cashier' })
  await waitFor(() => expect(screen.getByText('POS destination')).toBeTruthy())
  expect(screen.queryByText('Owner tools destination')).toBeNull()
})

test('opening secondary owner tools and navigating back keeps the existing POS draft', async () => {
  const screen = renderNavigation()
  await waitFor(() => expect(screen.getByText('POS destination')).toBeTruthy())
  fireEvent.press(screen.getByText('Add draft item'))
  act(() => router.push('/(admin)/settings'))
  await waitFor(() => expect(screen.getByText('Owner tools destination')).toBeTruthy())
  act(() => router.dismissTo('/(pos)/order'))
  await waitFor(() => expect(screen.getByText('Draft items: 1')).toBeTruthy())
  expect(posMount).toHaveBeenCalledTimes(1)
})

test.each(['checking', 'processing', 'ready', 'error', 'saved'])('recovery %s blocks signed-in POS and owner deep links', async status => {
  mockRecoveryState = { blocked: true, status }
  const screen = renderNavigation('/(admin)/settings')
  await waitFor(() => expect(screen.getByText(status === 'checking' ? 'Checking staff access…' : 'Recovery destination')).toBeTruthy())
  expect(posMount).not.toHaveBeenCalled()
  expect(adminMount).not.toHaveBeenCalled()
})

test('warm recovery removes an already visible owner screen before a recovery session resolves', async () => {
  const screen = renderNavigation('/(admin)/settings')
  await waitFor(() => expect(screen.getByText('Owner tools destination')).toBeTruthy())
  act(() => { mockRecoveryState = { blocked: true, status: 'processing' }; for (const listener of mockListeners) listener() })
  await waitFor(() => expect(screen.getByText('Recovery destination')).toBeTruthy())
  expect(screen.queryByText('Owner tools destination')).toBeNull()
  expect(posMount).not.toHaveBeenCalled()
})
