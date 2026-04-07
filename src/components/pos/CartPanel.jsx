import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated as RNAnimated,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { formatPrice } from '@/src/utils/formatPrice'
import { useCart } from '@/src/contexts/CartContext'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

/**
 * Cart panel for the POS order screen.
 * Expandable cart items with edit support, animated add feedback.
 */
export default function CartPanel({ onPlaceOrder, onEditItem, placing = false, borderless = false }) {
  const {
    items,
    orderType,
    subtotal,
    itemCount,
    updateQuantity,
    updateNote,
    removeItem,
    setOrderType,
    clearCart,
  } = useCart()

  const [expandedId, setExpandedId] = useState(null)
  const [lastAddedId, setLastAddedId] = useState(null)
  const prevCountRef = useRef(items.length)
  const flashAnims = useRef({})

  // Detect newly added items and trigger flash animation
  useEffect(() => {
    if (items.length > prevCountRef.current) {
      const newest = items[items.length - 1]
      if (newest) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setLastAddedId(newest.cartId)

        // Create or reuse Animated.Value for flash
        if (!flashAnims.current[newest.cartId]) {
          flashAnims.current[newest.cartId] = new RNAnimated.Value(1)
        } else {
          flashAnims.current[newest.cartId].setValue(1)
        }
        RNAnimated.timing(flashAnims.current[newest.cartId], {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }).start(() => setLastAddedId(null))
      }
    }
    prevCountRef.current = items.length
  }, [items.length])

  // Clean up stale flash anims
  useEffect(() => {
    const activeIds = new Set(items.map(i => i.cartId))
    for (const key of Object.keys(flashAnims.current)) {
      if (!activeIds.has(key)) delete flashAnims.current[key]
    }
  }, [items])

  const toggleExpand = (cartId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpandedId(prev => (prev === cartId ? null : cartId))
  }

  const handleRemove = (cartId) => {
    const item = items.find(i => i.cartId === cartId)
    Alert.alert(
      'Remove item',
      `Remove ${item?.item_name || 'this item'} from cart?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            if (expandedId === cartId) setExpandedId(null)
            removeItem(cartId)
          },
        },
      ],
    )
  }

  const handleClear = () => {
    Alert.alert(
      'Clear cart',
      `Remove all ${itemCount} items from the cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setExpandedId(null)
            clearCart()
          },
        },
      ],
    )
  }

  const renderCartItem = ({ item }) => {
    const isExpanded = expandedId === item.cartId
    const flashAnim = flashAnims.current[item.cartId]
    const isFlashing = lastAddedId === item.cartId && flashAnim

    const row = (
      <View style={[styles.cartItem, isExpanded && styles.cartItemExpanded]}>
        {/* Compact row: qty · name · price · chevron — all in one line */}
        <TouchableOpacity
          style={styles.cartItemHeader}
          activeOpacity={0.7}
          onPress={() => toggleExpand(item.cartId)}>
          <Text style={styles.cartItemQtyBadge}>{item.quantity}×</Text>
          <View style={styles.cartItemInfo}>
            <Text style={styles.cartItemName} numberOfLines={1}>
              {item.item_name}
              {item.size_label ? ` (${item.size_label})` : ''}
            </Text>
            {item.modifiers?.length > 0 && (
              <Text style={styles.cartItemMods} numberOfLines={1}>
                {item.modifiers.map(m => m.modifier_name).join(', ')}
              </Text>
            )}
          </View>
          <Text style={styles.cartItemPrice}>
            {formatPrice(item.unit_price * item.quantity)}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={COLORS.textMuted}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>

        {/* Expanded details — qty controls, modifiers, notes, edit, remove */}
        {isExpanded && (
          <View style={styles.expandedSection}>
            {/* Quantity + remove row */}
            <View style={styles.expandedQtyRow}>
              <View style={styles.qtyControls}>
                <TouchableOpacity
                  onPress={() => updateQuantity(item.cartId, item.quantity - 1)}
                  style={styles.qtyBtn}>
                  <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  onPress={() => updateQuantity(item.cartId, item.quantity + 1)}
                  style={styles.qtyBtn}>
                  <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.expandedActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => onEditItem?.(item)}>
                  <Ionicons name="create-outline" size={15} color={COLORS.accentGold} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item.cartId)}
                  hitSlop={8}>
                  <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modifier breakdown */}
            {item.modifiers?.length > 0 && (
              <View style={styles.modBreakdown}>
                <Text style={styles.modBreakdownLabel}>Modifiers</Text>
                {item.modifiers.map(m => (
                  <View key={m.id} style={styles.modRow}>
                    <Text style={styles.modName}>{m.modifier_name}</Text>
                    {m.extra_price > 0 && (
                      <Text style={styles.modPrice}>+{formatPrice(m.extra_price)}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Notes */}
            <View style={styles.notesSection}>
              <TextInput
                style={styles.notesInput}
                placeholder="Add a note..."
                placeholderTextColor={COLORS.textMuted}
                value={item.notes || ''}
                onChangeText={(text) => updateNote(item.cartId, text)}
                maxLength={100}
              />
            </View>
          </View>
        )}
      </View>
    )

    // Wrap with animated highlight for newly added items
    if (isFlashing) {
      const bgColor = flashAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', COLORS.accentGoldSoft],
      })
      return (
        <RNAnimated.View style={{ backgroundColor: bgColor }}>
          {row}
        </RNAnimated.View>
      )
    }
    return row
  }

  return (
    <View style={[styles.container, borderless && styles.containerBorderless]}>
      {/* Cart items */}
      {items.length === 0 ? (
        <View style={styles.emptyCart}>
          <Ionicons name="cart-outline" size={36} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Tap items to add</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.cartId}
          renderItem={renderCartItem}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Footer — order type + total + place order + clear */}
      {items.length > 0 && (
        <View style={styles.footer}>
          {/* Order type selector */}
          <View style={styles.orderTypeRow}>
            {[
              { key: 'dine-in', label: 'Dine-in', icon: 'restaurant-outline' },
              { key: 'takeout', label: 'Takeout', icon: 'bag-handle-outline' },
              { key: 'delivery', label: 'Delivery', icon: 'bicycle-outline' },
            ].map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.orderTypeBtn, orderType === t.key && styles.orderTypeBtnActive]}
                onPress={() => setOrderType(t.key)}>
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={orderType === t.key ? COLORS.textOnGold : COLORS.textSecondary}
                />
                <Text style={[styles.orderTypeText, orderType === t.key && styles.orderTypeTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalPrice}>{formatPrice(subtotal)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.placeBtn, (placing || !orderType) && styles.placeBtnDisabled]}
            onPress={onPlaceOrder}
            disabled={placing || !orderType}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.textOnGold} />
            <Text style={styles.placeBtnText}>
              {placing ? 'Placing...' : !orderType ? 'Select Order Type' : 'Place Order'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            hitSlop={8}>
            <Text style={styles.clearText}>Clear all items</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgSecondary,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    flex: 1,
  },
  containerBorderless: {
    borderLeftWidth: 0,
  },
  list: {
    flex: 1,
  },
  cartItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  cartItemExpanded: {
    backgroundColor: COLORS.bgCard,
  },
  cartItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemQtyBadge: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    minWidth: 24,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  cartItemName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
  },
  cartItemMods: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 11,
    marginTop: 1,
  },
  cartItemPrice: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  // Expanded section
  expandedSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  expandedQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  expandedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.sm,
  },
  qtyBtn: {
    padding: 6,
  },
  qtyText: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    minWidth: 24,
    textAlign: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeBtnText: {
    color: COLORS.error,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  modBreakdown: {
    marginBottom: SPACING.sm,
  },
  modBreakdownLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  modName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  modPrice: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  notesSection: {
    marginBottom: SPACING.xs,
  },
  notesInput: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 13,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    height: 36,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  orderTypeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  orderTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderTypeBtnActive: {
    backgroundColor: COLORS.accentGold,
    borderColor: COLORS.accentGold,
  },
  orderTypeText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 12,
  },
  orderTypeTextActive: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
  },
  totalPrice: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 20,
  },
  placeBtn: {
    backgroundColor: COLORS.accentGold,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  placeBtnDisabled: {
    opacity: 0.6,
  },
  placeBtnText: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: SPACING.xs,
  },
  clearText: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
})
