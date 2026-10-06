import React from 'react'
import { Stack } from 'expo-router'
import { View } from 'react-native'
import { useAuth } from '@/src/contexts/AuthContext'
import { COLORS } from '@/src/constants/theme'
import { useRecovery } from '@/src/contexts/RecoveryContext'
import SessionLockOverlay from '@/src/components/auth/SessionLockOverlay'

export default function SessionNavigator() {
  const { session, role, loading, authError, lockState } = useAuth()
  const { blocked } = useRecovery()
  const staffReady = Boolean(!blocked && session && !loading && !authError && ['admin', 'cashier'].includes(role))
  const locked = Boolean(!blocked && session && lockState?.locked)
  return (
    <>
      <View style={{ flex: 1 }} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={locked}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bgPrimary } }}>
          {/* The public anchor owns loading/error states and POS-first redirection. */}
          <Stack.Screen name="index" />
          <Stack.Protected guard={blocked}>
            <Stack.Screen name="reset-password" />
          </Stack.Protected>
          <Stack.Protected guard={!blocked && !session && !loading && !authError}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={staffReady}>
            <Stack.Screen name="(pos)" />
          </Stack.Protected>
          <Stack.Protected guard={staffReady && role === 'admin'}>
            <Stack.Screen name="(admin)" />
          </Stack.Protected>
        </Stack>
      </View>
      <SessionLockOverlay />
    </>
  )
}
