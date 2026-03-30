import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.dark.bgSecondary },
        headerTintColor: Colors.dark.textPrimary,
        headerTitleStyle: { fontFamily: 'DMSans', fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: Colors.dark.bgSecondary,
          borderTopColor: Colors.dark.borderSubtle,
        },
        tabBarActiveTintColor: Colors.dark.accentGold,
        tabBarInactiveTintColor: Colors.dark.textMuted,
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
  );
}
