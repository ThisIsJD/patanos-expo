import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  useWindowDimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { useMenu } from '@/src/hooks/useMenu'
import { useOrders } from '@/src/hooks/useOrders'
import { useCart } from '@/src/contexts/CartContext'
import MenuGrid from '@/src/components/pos/MenuGrid'
import CartPanel from '@/src/components/pos/CartPanel'
import ModifierPicker from '@/src/components/pos/ModifierPicker'
import Toast from '@/src/components/common/Toast'

export default function OrderScreen() {
  const { width } = useWindowDimensions()
  const isTablet = width >= 768

  const { items: menuItems, categories, selectedCategory, setSelectedCategory } = useMenu()
  const { placeOrder, isOnline, pendingCount } = useOrders()
  const cart = useCart()

  const [pickerItem, setPickerItem] = useState(null)
  const [editingCartId, setEditingCartId] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [phoneCartOpen, setPhoneCartOpen] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' })
  const slideAnim = useRef(new Animated.Value(0)).current

  // Animate the phone cart sheet in/out
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: phoneCartOpen ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [phoneCartOpen])

  // Close the phone cart sheet when cart becomes empty
  useEffect(() => {
    if (cart.itemCount === 0 && phoneCartOpen) {
      setPhoneCartOpen(false)
    }
  }, [cart.itemCount])

  const handleItemPress = (item) => {
    setEditingCartId(null)
    setPickerItem(item)
  }

  const handleAddFromPicker = (selectedItem, modifiers, quantity) => {
    if (editingCartId) {
      cart.updateItem(editingCartId, selectedItem, modifiers, quantity)
      setEditingCartId(null)
    } else {
      cart.addItem(selectedItem, modifiers, quantity)
    }
    setPickerItem(null)
  }

  const handleEditItem = (cartItem) => {
    // Find the original menu item so ModifierPicker can work with it
    const menuItem = menuItems.find(mi => mi.id === cartItem.menu_item_id)
    if (menuItem) {
      setEditingCartId(cartItem.cartId)
      setPickerItem(menuItem)
    }
  }

  const handlePlaceOrder = async () => {
    if (cart.items.length === 0) return
    setPlacing(true)
    const { data, error } = await placeOrder({
      items: cart.items,
      orderType: cart.orderType,
      subtotal: cart.subtotal,
    })
    setPlacing(false)

    if (error) {
      Alert.alert('Error', error)
    } else {
      cart.clearCart()
      setToast({
        visible: true,
        message: data.offline
          ? `Order queued (#${data.order_number}) — will sync when online`
          : `Order #${data.order_number} placed!`,
        type: data.offline ? 'warning' : 'success',
      })
    }
  }

  return (
    <View style={styles.container}>
      {/* Offline banner */}
      {(!isOnline || pendingCount > 0) && (
        <View style={[styles.offlineBanner, isOnline && styles.syncBanner]}>
          <Ionicons
            name={isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline'}
            size={16}
            color={COLORS.bgPrimary}
          />
          <Text style={styles.offlineText}>
            {!isOnline
              ? 'Offline — orders will be queued'
              : `${pendingCount} order${pendingCount > 1 ? 's' : ''} syncing...`}
          </Text>
        </View>
      )}

      {/* Category tabs */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity
            style={[styles.categoryTab, !selectedCategory && styles.categoryTabActive]}
            onPress={() => setSelectedCategory(null)}>
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryTab, selectedCategory === cat.id && styles.categoryTabActive]}
              onPress={() => setSelectedCategory(cat.id)}>
              <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main content — tablet: side-by-side, phone: stacked with cart panel at bottom */}
      <View style={styles.main}>
        <View style={[styles.menuSection, isTablet && { flex: 2 }]}>
          <MenuGrid
            items={menuItems}
            categories={categories}
            selectedCategory={selectedCategory}
            onItemPress={handleItemPress}
          />
        </View>

        {isTablet ? (
          <View style={styles.cartSection}>
            <CartPanel onPlaceOrder={handlePlaceOrder} onEditItem={handleEditItem} placing={placing} />
          </View>
        ) : (
          // Phone: compact bottom bar that expands into full cart sheet
          cart.itemCount > 0 && (
            <TouchableOpacity
              style={styles.phoneCartBar}
              activeOpacity={0.85}
              onPress={() => setPhoneCartOpen(true)}>
              <View style={styles.phoneCartLeft}>
                <View style={styles.phoneCartBadge}>
                  <Text style={styles.phoneCartBadgeText}>{cart.itemCount}</Text>
                </View>
                <Text style={styles.phoneCartLabel}>View Cart</Text>
              </View>
              <Text style={styles.phoneCartTotal}>
                {`₱${cart.subtotal.toFixed(2)}`}
              </Text>
              <Ionicons name="chevron-up" size={20} color={COLORS.textOnGold} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Phone cart bottom sheet */}
      {!isTablet && (
        <Modal
          visible={phoneCartOpen}
          transparent
          animationType="none"
          onRequestClose={() => setPhoneCartOpen(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity
              style={styles.sheetBackdrop}
              activeOpacity={1}
              onPress={() => setPhoneCartOpen(false)}
            />
            <Animated.View
              style={[
                styles.sheetContainer,
                {
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  }],
                },
              ]}>
              {/* Sheet handle + header */}
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle}>Your Order ({cart.itemCount})</Text>
                  <TouchableOpacity onPress={() => setPhoneCartOpen(false)} hitSlop={12}>
                    <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
              <CartPanel
                borderless
                onPlaceOrder={() => {
                  setPhoneCartOpen(false)
                  handlePlaceOrder()
                }}
                onEditItem={(cartItem) => {
                  setPhoneCartOpen(false)
                  handleEditItem(cartItem)
                }}
                placing={placing}
              />
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Modifier picker modal */}
      <ModifierPicker
        item={pickerItem}
        visible={!!pickerItem}
        onAdd={handleAddFromPicker}
        onClose={() => { setPickerItem(null); setEditingCartId(null) }}
        allItems={menuItems}
      />

      <Toast
        message={toast.message}
        visible={toast.visible}
        type={toast.type}
        onHide={() => setToast(t => ({ ...t, visible: false }))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#D32F2F',
  },
  syncBanner: {
    backgroundColor: COLORS.accentGold,
  },
  offlineText: {
    color: COLORS.bgPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
  },
  categoryBar: {
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryScroll: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryTabActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  categoryText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
  },
  categoryTextActive: {
    color: COLORS.accentGold,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
  },
  menuSection: {
    flex: 1,
    overflow: 'hidden',
  },
  cartSection: {
    width: 300,
    minWidth: 280,
  },
  // Phone bottom cart bar
  phoneCartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.accentGold,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
  },
  phoneCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  phoneCartBadge: {
    backgroundColor: COLORS.textOnGold,
    borderRadius: RADIUS.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneCartBadgeText: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
  },
  phoneCartLabel: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  phoneCartTotal: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
  // Phone cart bottom sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    backgroundColor: COLORS.bgSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '60%',
    minHeight: 320,
    overflow: 'hidden',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
})
