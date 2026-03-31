import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Image, TouchableOpacity } from 'react-native'
import { COLORS } from '@/src/constants/theme'

function HeaderLogo() {
  return (
    <Image
      source={require('@/assets/brand/patanos-logo.png')}
      style={{ width: 32, height: 32 }}
      resizeMode="contain"
    />
  )
}

function POSButton() {
  const router = useRouter()
  return (
    <TouchableOpacity
      onPress={() => router.push('/(pos)/order')}
      style={{ paddingRight: 16 }}
      hitSlop={8}>
      <Ionicons name="cart" size={24} color={COLORS.accentGold} />
    </TouchableOpacity>
  )
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.bgSecondary },
        headerTintColor: COLORS.textPrimary,
        headerTitleStyle: { fontFamily: 'DMSans', fontWeight: '700' },
        headerLeft: () => <HeaderLogo />,
        headerLeftContainerStyle: { paddingLeft: 16 },
        headerRight: () => <POSButton />,
        tabBarStyle: {
          backgroundColor: COLORS.bgSecondary,
          borderTopColor: COLORS.border,
        },
        tabBarActiveTintColor: COLORS.accentGold,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontFamily: 'DMSans', fontSize: 12 },
      }}>
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="modifiers"
        options={{
          title: 'Modifiers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="options-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
