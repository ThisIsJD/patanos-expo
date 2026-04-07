import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { useInventory } from '@/src/hooks/useInventory'

function StockBadge({ item }) {
  if (!item.track_inventory) {
    return (
      <View style={[styles.badge, styles.badgeOff]}>
        <Text style={styles.badgeTextOff}>Not tracked</Text>
      </View>
    )
  }
  if (item.stock_count === 0) {
    return (
      <View style={[styles.badge, styles.badgeError]}>
        <Text style={styles.badgeText}>Out of stock</Text>
      </View>
    )
  }
  if (item.stock_count <= item.low_stock_threshold) {
    return (
      <View style={[styles.badge, styles.badgeWarning]}>
        <Text style={styles.badgeTextDark}>Low stock</Text>
      </View>
    )
  }
  return (
    <View style={[styles.badge, styles.badgeSuccess]}>
      <Text style={styles.badgeText}>In stock</Text>
    </View>
  )
}

export default function InventoryScreen() {
  const {
    inventory,
    loading,
    lowStockItems,
    outOfStockItems,
    updateStock,
    updateThreshold,
    toggleTracking,
    refresh,
  } = useInventory()

  const [filter, setFilter] = useState('all') // 'all' | 'tracked' | 'low' | 'out'
  const [editItem, setEditItem] = useState(null)
  const [stockInput, setStockInput] = useState('')
  const [thresholdInput, setThresholdInput] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const filtered = useMemo(() => {
    switch (filter) {
      case 'tracked':
        return inventory.filter(i => i.track_inventory)
      case 'low':
        return lowStockItems
      case 'out':
        return outOfStockItems
      default:
        return inventory
    }
  }, [inventory, filter, lowStockItems, outOfStockItems])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const openEditor = (item) => {
    setEditItem(item)
    setStockInput(String(item.stock_count))
    setThresholdInput(String(item.low_stock_threshold))
  }

  const handleSaveStock = async () => {
    const count = parseInt(stockInput, 10)
    const threshold = parseInt(thresholdInput, 10)
    if (isNaN(count) || count < 0) {
      Alert.alert('Invalid', 'Stock count must be 0 or more')
      return
    }
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Invalid', 'Threshold must be 0 or more')
      return
    }

    const stockErr = await updateStock(editItem.id, count)
    const threshErr = await updateThreshold(editItem.id, threshold)
    if (!stockErr.error && !threshErr.error) {
      setEditItem(null)
    }
  }

  const handleToggleTracking = (item) => {
    const next = !item.track_inventory
    Alert.alert(
      next ? 'Enable Tracking' : 'Disable Tracking',
      next
        ? `Start tracking stock for ${item.menu_items?.name}?`
        : `Stop tracking stock for ${item.menu_items?.name}? Stock count won't change on orders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: next ? 'Enable' : 'Disable', onPress: () => toggleTracking(item.id, next) },
      ],
    )
  }

  const itemName = (item) => {
    const name = item.menu_items?.name || 'Unknown'
    const size = item.menu_items?.size_label
    return size ? `${name} (${size})` : name
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => openEditor(item)} activeOpacity={0.7}>
      <View style={styles.cardLeft}>
        <Text style={styles.itemName} numberOfLines={1}>{itemName(item)}</Text>
        <Text style={styles.categoryName}>
          {item.menu_items?.categories?.name || 'Uncategorized'}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <StockBadge item={item} />
        {item.track_inventory && (
          <Text style={styles.stockCount}>{item.stock_count}</Text>
        )}
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  )

  const filters = [
    { key: 'all', label: 'All', count: inventory.length },
    { key: 'tracked', label: 'Tracked', count: inventory.filter(i => i.track_inventory).length },
    { key: 'low', label: 'Low', count: lowStockItems.length },
    { key: 'out', label: 'Out', count: outOfStockItems.length },
  ]

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <View style={styles.alertBar}>
          {outOfStockItems.length > 0 && (
            <View style={styles.alertItem}>
              <Ionicons name="alert-circle" size={16} color={COLORS.error} />
              <Text style={styles.alertText}>
                {outOfStockItems.length} out of stock
              </Text>
            </View>
          )}
          {lowStockItems.length > 0 && (
            <View style={styles.alertItem}>
              <Ionicons name="warning" size={16} color={COLORS.accentGold} />
              <Text style={styles.alertText}>
                {lowStockItems.length} low stock
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label} ({f.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Inventory list */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.accentGold}
            colors={[COLORS.accentGold]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No inventory items' : `No ${filter} items`}
            </Text>
          </View>
        }
      />

      {/* Edit modal */}
      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={() => setEditItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem ? itemName(editItem) : ''}</Text>
              <TouchableOpacity onPress={() => setEditItem(null)} hitSlop={12}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {editItem && (
              <View style={styles.modalBody}>
                {/* Tracking toggle */}
                <View style={styles.toggleRow}>
                  <Text style={styles.label}>Track inventory</Text>
                  <Switch
                    value={editItem.track_inventory}
                    onValueChange={() => handleToggleTracking(editItem)}
                    trackColor={{ false: COLORS.border, true: COLORS.accentGoldSoft }}
                    thumbColor={editItem.track_inventory ? COLORS.accentGold : COLORS.textMuted}
                  />
                </View>

                {editItem.track_inventory && (
                  <>
                    {/* Stock count */}
                    <View style={styles.fieldRow}>
                      <Text style={styles.label}>Stock count</Text>
                      <View style={styles.inputRow}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => {
                            const n = Math.max(0, parseInt(stockInput || '0', 10) - 1)
                            setStockInput(String(n))
                          }}>
                          <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.input}
                          value={stockInput}
                          onChangeText={setStockInput}
                          keyboardType="number-pad"
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => {
                            const n = parseInt(stockInput || '0', 10) + 1
                            setStockInput(String(n))
                          }}>
                          <Ionicons name="add" size={18} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Quick restock buttons */}
                    <View style={styles.quickRow}>
                      {[10, 25, 50, 100].map(n => (
                        <TouchableOpacity
                          key={n}
                          style={styles.quickBtn}
                          onPress={() => {
                            const current = parseInt(stockInput || '0', 10)
                            setStockInput(String(current + n))
                          }}>
                          <Text style={styles.quickBtnText}>+{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Threshold */}
                    <View style={styles.fieldRow}>
                      <Text style={styles.label}>Low stock alert at</Text>
                      <TextInput
                        style={[styles.input, { width: 80 }]}
                        value={thresholdInput}
                        onChangeText={setThresholdInput}
                        keyboardType="number-pad"
                        selectTextOnFocus
                      />
                    </View>

                    {/* Last restocked */}
                    {editItem.last_restocked_at && (
                      <Text style={styles.lastRestocked}>
                        Last restocked: {new Date(editItem.last_restocked_at).toLocaleDateString()}
                      </Text>
                    )}
                  </>
                )}

                {/* Save */}
                {editItem.track_inventory && (
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveStock}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  alertBar: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 12,
  },
  filterTextActive: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardLeft: {
    flex: 1,
  },
  itemName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  categoryName: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  stockCount: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    minWidth: 32,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  badgeWarning: {
    backgroundColor: COLORS.accentGoldSoft,
  },
  badgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  badgeOff: {
    backgroundColor: COLORS.bgElevated,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'DMSans-Bold',
    color: COLORS.textSecondary,
  },
  badgeTextDark: {
    fontSize: 11,
    fontFamily: 'DMSans-Bold',
    color: COLORS.accentGold,
  },
  badgeTextOff: {
    fontSize: 11,
    fontFamily: 'DMSans',
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.bgSecondary,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
    flex: 1,
    marginRight: SPACING.sm,
  },
  modalBody: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    textAlign: 'center',
    minWidth: 60,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  qtyBtn: {
    padding: SPACING.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  quickBtnText: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
  },
  lastRestocked: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 11,
  },
  saveBtn: {
    backgroundColor: COLORS.accentGold,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveBtnText: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
})
