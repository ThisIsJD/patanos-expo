import React, { useMemo, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { formatPrice } from '@/src/utils/formatPrice'
import { groupMenu } from '@/src/utils/groupMenu'

/**
 * POS menu grid — displays published, available menu items grouped by product.
 * Duplicate sizes (e.g. Halo Halo 16oz / 22oz) are grouped into one card.
 */
export default function MenuGrid({ items, categories, selectedCategory, onItemPress }) {
  const { width: screenWidth } = useWindowDimensions()
  const [containerWidth, setContainerWidth] = useState(screenWidth)

  // Measure actual container width so cards fit properly (not full screen)
  const onLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) setContainerWidth(w)
  }, [])

  const numColumns = containerWidth >= 600 ? 4 : 3
  const gap = SPACING.sm
  const padding = SPACING.sm
  const cardWidth = (containerWidth - padding * 2 - gap * (numColumns - 1)) / numColumns

  // Filter, then group duplicates by name + category
  const grouped = useMemo(() => {
    let list = items.filter(i => i.status === 'published' && i.available !== false)
    if (selectedCategory) {
      list = list.filter(i => i.category_id === selectedCategory)
    }
    return groupMenu(list, categories)
  }, [items, categories, selectedCategory])

  const renderItem = ({ item: group }) => {
    const prices = group.variants.map(v => parseFloat(v.price))
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceLabel = minPrice === maxPrice
      ? formatPrice(minPrice)
      : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`

    return (
      <TouchableOpacity
        style={[styles.card, { width: cardWidth }]}
        activeOpacity={0.7}
        onPress={() => onItemPress(group.variants[0])}>
        {group.image_url ? (
          <Image source={{ uri: group.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="cafe-outline" size={28} color={COLORS.textMuted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
          {group.variants.length > 1 && (
            <Text style={styles.size}>{group.variants.length} sizes</Text>
          )}
          <Text style={styles.price}>{priceLabel}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <FlatList
        data={grouped}
        keyExtractor={item => `${item.name}__${item.category_id}`}
        renderItem={renderItem}
        numColumns={numColumns}
        key={`${numColumns}_${Math.floor(containerWidth)}`}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    padding: SPACING.sm,
    paddingBottom: 100,
  },
  row: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.bgElevated,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    padding: SPACING.sm,
  },
  name: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
  },
  size: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 11,
    marginTop: 2,
  },
  price: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    marginTop: 4,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 14,
    marginTop: SPACING.sm,
  },
})
