import React from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { COLORS } from '@/src/constants/theme'

export default function LoadingSpinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={COLORS.accentGold} size="large" />
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
  },
})
