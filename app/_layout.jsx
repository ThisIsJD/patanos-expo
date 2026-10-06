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

import { AuthProvider } from '@/src/contexts/AuthContext'
import SessionNavigator from '@/src/components/auth/SessionNavigator'
import { RecoveryProvider } from '@/src/contexts/RecoveryContext'
import { initializeMonitoring, wrapWithMonitoring } from '@/src/lib/monitoring'

initializeMonitoring()
SplashScreen.preventAutoHideAsync()

function RootLayout() {
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
    <RecoveryProvider><AuthProvider>
      <SessionNavigator />
      <StatusBar style="light" />
    </AuthProvider></RecoveryProvider>
  )
}

export default wrapWithMonitoring(RootLayout)
