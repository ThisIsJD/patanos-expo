import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import SizeRow from './SizeRow'

export default function MenuItemCard({ product, onEdit, onAddSize, onDelete, onToggle }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={22} color={COLORS.textMuted} />
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{product.name}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{product.category_name}</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => onEdit(product, product.variants[0])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={18} color={COLORS.accentGold} />
          </TouchableOpacity>
          {product.variants.length < 5 && (
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={() => onAddSize(product)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => onDelete(product.variants[0])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sizeList}>
        {product.variants.map(v => (
          <SizeRow key={v.id} variant={v} onToggle={onToggle} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgElevated,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentGoldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  categoryBadgeText: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans',
    fontSize: 11,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    padding: 6,
  },
  sizeList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
})
