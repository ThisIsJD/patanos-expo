import React from 'react'
import { View, Text, Switch, StyleSheet } from 'react-native'
import { COLORS, SPACING } from '@/src/constants/theme'

export default function SizeRow({ variant, onToggle }) {
  return (
    <View style={[styles.sizeRow, !variant.available && styles.sizeRowUnavailable]}>
      <Text style={styles.sizeLabel}>{variant.size_label || 'Regular'}</Text>
      <Text style={styles.sizePrice}>₱{Number(variant.price).toFixed(2)}</Text>
      <Switch
        value={variant.available}
        onValueChange={() => onToggle(variant)}
        trackColor={{ false: '#333', true: COLORS.accentGoldSoft }}
        thumbColor={variant.available ? COLORS.accentGold : '#888'}
        style={styles.sizeSwitch}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  sizeRowUnavailable: {
    opacity: 0.4,
  },
  sizeLabel: {
    flex: 1,
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  sizePrice: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    marginRight: SPACING.sm,
  },
  sizeSwitch: {
    transform: [{ scale: 0.75 }],
  },
})
