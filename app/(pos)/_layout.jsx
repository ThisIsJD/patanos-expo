import { Stack } from 'expo-router'
import { COLORS } from '@/src/constants/theme'

export default function POSLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bgPrimary },
      }}
    />
  )
}
