import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { Colors } from '@/constants/theme';

function HeaderLogo() {
  return (
    <Image
      source={require('@/assets/images/Patanos_logo.png')}
      style={{ width: 32, height: 32 }}
      resizeMode="contain"
    />
  );
}

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.dark.bgSecondary },
        headerTintColor: Colors.dark.textPrimary,
        headerTitleStyle: { fontFamily: 'DMSans', fontWeight: '700' },
        headerLeft: () => <HeaderLogo />,
        headerLeftContainerStyle: { paddingLeft: 16 },
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
