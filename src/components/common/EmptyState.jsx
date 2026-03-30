import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'

export default function EmptyState({ icon, message, actionLabel, onAction }) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={COLORS.textMuted} />
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 80,
    gap: SPACING.md,
  },
  message: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.accentGold,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  buttonText: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
})
