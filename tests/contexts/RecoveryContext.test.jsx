import { beforeEach, expect, jest, test } from '@jest/globals'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { Linking } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { RecoveryProvider, useRecovery } from '@/src/contexts/RecoveryContext'
import { supabase } from '@/src/lib/supabase'

jest.mock('expo-constants', () => ({ executionEnvironment: 'bare', expoConfig: {
  scheme: 'patanosexpo-development', extra: { appEnvironment: 'development' } } }))
jest.mock('@/src/lib/nativeCrypto', () => ({ hasSecurePKCE: () => true }))
jest.mock('@/src/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: jest.fn(), getUser: jest.fn(),
  exchangeCodeForSession: jest.fn(), signOut: jest.fn() } } }))
let linkListener, authListener
const remove = jest.fn(), unsubscribe = jest.fn()
const link = 'patanosexpo-development://reset-password?code=synthetic-code-1234'
beforeEach(async () => {
  await AsyncStorage.clear()
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null)
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_event, listener) => { linkListener = listener; return { remove } })
  supabase.auth.onAuthStateChange.mockImplementation(listener => { authListener = listener; return { data: { subscription: { unsubscribe } } } })
  supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: { redirectType: 'PASSWORD_RECOVERY', user: { id: 'staff' }, session: { user: { id: 'staff' } } } })
})
test('initial-link resolution blocks routes until ordinary startup is confirmed', async () => {
  const { result, unmount } = renderHook(useRecovery, { wrapper: RecoveryProvider })
  expect(result.current.blocked).toBe(true)
  await waitFor(() => expect(result.current.status).toBe('idle'))
  expect(result.current.blocked).toBe(false)
  unmount()
  expect(remove).toHaveBeenCalled()
  expect(unsubscribe).toHaveBeenCalled()
})
test('cold recovery links create a verified gate instead of ordinary signed-in access', async () => {
  Linking.getInitialURL.mockResolvedValue(link)
  const { result } = renderHook(useRecovery, { wrapper: RecoveryProvider })
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(result.current.blocked).toBe(true)
  act(() => authListener('SIGNED_OUT', null))
  expect(result.current.status).toBe('error')
  expect(result.current.blocked).toBe(true)
})
test('warm links win over a delayed initial-URL lookup', async () => {
  let resolve
  Linking.getInitialURL.mockReturnValue(new Promise(done => { resolve = done }))
  const { result } = renderHook(useRecovery, { wrapper: RecoveryProvider })
  act(() => linkListener({ url: link }))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  await act(async () => { resolve(null) })
  expect(result.current.status).toBe('ready')
  expect(result.current.blocked).toBe(true)
})

test('StrictMode effect replay does not consume a cold recovery code twice', async () => {
  Linking.getInitialURL.mockResolvedValue(link)
  function StrictProvider({ children }) { return <React.StrictMode><RecoveryProvider>{children}</RecoveryProvider></React.StrictMode> }
  const { result } = renderHook(useRecovery, { wrapper: StrictProvider })
  await waitFor(() => expect(result.current.status).toBe('ready'))
  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
})
