import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { supabase } from '@/src/lib/supabase'
import { hasSecurePKCE } from '@/src/lib/nativeCrypto'
import { createPasswordRecovery } from '@/src/lib/passwordRecovery'
import { recoveryRedirect } from '@/src/utils/recoveryLinks'

const RecoveryContext = createContext(null)

export function RecoveryProvider({ children }) {
  const [controller] = useState(() => {
    const environment = Constants.expoConfig?.extra?.appEnvironment || 'development'
    const redirect = recoveryRedirect(environment)
    const expectedScheme = redirect.split(':')[0]
    const enabled = () => process.env.EXPO_PUBLIC_PASSWORD_RECOVERY_ENABLED === 'true'
    const supported = () => Platform.OS === 'android' && Constants.executionEnvironment !== 'storeClient' &&
      Constants.expoConfig?.scheme === expectedScheme && hasSecurePKCE()
    return createPasswordRecovery({ auth: supabase.auth, storage: AsyncStorage, redirect,
      enabled, supported })
  })
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)

  useEffect(() => {
    let active = true
    const linkSubscription = Linking.addEventListener('url', ({ url }) => { void controller.handleURL(url) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => controller.observeSession(session))
    void Linking.getInitialURL().then(url => {
      if (active) void controller.initialize(url)
    }).catch(() => { if (active) void controller.initialize('/reset-password') })
    return () => {
      active = false
      linkSubscription.remove()
      subscription.unsubscribe()
      controller.dispose()
    }
  }, [controller])

  return <RecoveryContext.Provider value={{ ...state, blocked: state.status !== 'idle',
    requestAvailable: controller.isRequestAvailable(),
    requestUnavailableReason: process.env.EXPO_PUBLIC_PASSWORD_RECOVERY_ENABLED !== 'true'
      ? 'Recovery email is not enabled for this environment yet. Ask the owner for help.'
      : 'Use the matching installed Android app with native crypto support. Update the app or ask the owner for help.',
    requestReset: controller.requestReset, updatePassword: controller.updatePassword,
    endRecovery: () => controller.endRecovery(state.status === 'saved') }}>{children}</RecoveryContext.Provider>
}

export function useRecovery() {
  const context = useContext(RecoveryContext)
  if (!context) throw new Error('useRecovery must be used within RecoveryProvider')
  return context
}
