import { jest } from '@jest/globals'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('react-native-safe-area-context', () => ({
  ...require('react-native-safe-area-context/jest/mock').default,
  SafeAreaView: require('react-native').View,
}))

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }))
