import { Tabs, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TouchableOpacity, Alert } from 'react-native'
import { COLORS } from '@/src/constants/theme'
import { CartProvider } from '@/src/contexts/CartContext'
import { useAuth } from '@/src/contexts/AuthContext'

function HeaderLeftButton() {
  const { role, signOut } = useAuth()
  const router = useRouter()

  if (role === 'cashier') {
    return (
      <TouchableOpacity
        onPress={() =>
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: signOut },
          ])
        }
        style={{ marginLeft: 12 }}>
        <Ionicons name="log-out-outline" size={24} color={COLORS.accentGold} />
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={() => router.replace('/(admin)/menu')}
      style={{ marginLeft: 12 }}>
      <Ionicons name="arrow-back" size={24} color={COLORS.accentGold} />
    </TouchableOpacity>
  )
}

export default function POSLayout() {
  return (
    <CartProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bgSecondary },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: { fontFamily: 'DMSans-Bold' },
          headerLeft: () => <HeaderLeftButton />,
          tabBarStyle: {
            backgroundColor: COLORS.bgSecondary,
            borderTopColor: COLORS.border,
          },
          tabBarActiveTintColor: COLORS.accentGold,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: { fontFamily: 'DMSans', fontSize: 12 },
        }}>
        <Tabs.Screen
          name="order"
          options={{
            title: 'New Order',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="open-orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="receipt" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </CartProvider>
  )
}
