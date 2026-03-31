import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import 'react-native-reanimated'
import {
  PermanentMarker_400Regular,
} from '@expo-google-fonts/permanent-marker'
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'

import { AuthProvider, useAuth } from '@/src/contexts/AuthContext'
import { COLORS } from '@/src/constants/theme'

SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { session, role, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    const inAuth = segments[0] === '(auth)'
    const inAdmin = segments[0] === '(admin)'
    const inPOS = segments[0] === '(pos)'

    if (!session && !inAuth) {
      router.replace('/(auth)/login')
    } else if (session && inAuth) {
      // Route based on role after login
      if (role === 'cashier') {
        router.replace('/(pos)/order')
      } else {
        router.replace('/(admin)/menu')
      }
    } else if (session && role === 'cashier' && inAdmin) {
      // Cashiers cannot access admin screens
      router.replace('/(pos)/order')
    }
  }, [session, role, loading, segments])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bgPrimary },
      }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(pos)" />
    </Stack>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PermanentMarker: PermanentMarker_400Regular,
    DMSans: DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  )
}
