import React, { useState } from 'react'
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { useOrders } from '@/src/hooks/useOrders'
import OrderCard from '@/src/components/pos/OrderCard'
import PaymentSheet from '@/src/components/pos/PaymentSheet'
import Toast from '@/src/components/common/Toast'

export default function OpenOrdersScreen() {
  const { openOrders, completedOrders, queuedOrders, loading, completeOrder, cancelOrder, refresh, isOnline, pendingCount, syncNow } = useOrders()

  const [payingOrder, setPayingOrder] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' })

  const handleCollectPayment = async (payment) => {
    const { error } = await completeOrder(payment)
    if (!error) {
      setPayingOrder(null)
      setToast({ visible: true, message: `Order #${payingOrder.order_number} completed!`, type: 'success' })
    }
  }

  const handleCancel = (order) => {
    Alert.alert(
      'Cancel Order',
      `Cancel order #${order.order_number}? This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            const { error } = await cancelOrder(order.id, 'Cancelled by staff')
            if (!error) {
              setToast({ visible: true, message: `Order #${order.order_number} cancelled`, type: 'info' })
            }
          },
        },
      ],
    )
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const sections = [
    ...(queuedOrders.length > 0
      ? [{ title: 'Queued (Offline)', data: queuedOrders, type: 'queued' }]
      : []),
    { title: 'Open Orders', data: openOrders, type: 'open' },
    ...(showCompleted
      ? [{ title: 'Completed Today', data: completedOrders, type: 'completed' }]
      : []),
  ]

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        {section.type === 'queued' && (
          <Ionicons name="cloud-offline-outline" size={18} color={COLORS.textMuted} />
        )}
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={[styles.countBadge, section.type === 'queued' && styles.queuedBadge]}>
          <Text style={[styles.countText, section.type === 'queued' && styles.queuedBadgeText]}>{section.data.length}</Text>
        </View>
      </View>
    </View>
  )

  const renderItem = ({ item, section }) => (
    <OrderCard
      order={item}
      completed={section.type === 'completed'}
      queued={section.type === 'queued'}
      onCollectPayment={section.type === 'queued' ? undefined : () => setPayingOrder(item)}
      onCancel={section.type === 'queued' ? undefined : () => handleCancel(item)}
    />
  )

  const renderEmpty = (section) => {
    if (section.type === 'open') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.success} />
          <Text style={styles.emptyTitle}>All clear!</Text>
          <Text style={styles.emptySubtitle}>No unpaid orders right now</Text>
        </View>
      )
    }
    return null
  }

  return (
    <View style={styles.container}>
      {/* Offline / pending banner */}
      {(!isOnline || pendingCount > 0) && (
        <TouchableOpacity
          style={[styles.offlineBanner, isOnline && styles.syncBanner]}
          onPress={isOnline ? syncNow : undefined}
          activeOpacity={isOnline ? 0.7 : 1}>
          <Ionicons
            name={isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline'}
            size={16}
            color={COLORS.bgPrimary}
          />
          <Text style={styles.offlineText}>
            {!isOnline
              ? `Offline${pendingCount > 0 ? ` — ${pendingCount} queued` : ''}`
              : `${pendingCount} order${pendingCount > 1 ? 's' : ''} pending — tap to sync`}
          </Text>
        </TouchableOpacity>
      )}

      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? renderEmpty(section) : null
        }
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.accentGold}
            colors={[COLORS.accentGold]}
          />
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.toggleCompleted}
            onPress={() => setShowCompleted(!showCompleted)}>
            <Ionicons
              name={showCompleted ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={COLORS.textMuted}
            />
            <Text style={styles.toggleText}>
              {showCompleted
                ? 'Hide completed orders'
                : `Show completed (${completedOrders.length})`}
            </Text>
          </TouchableOpacity>
        }
      />

      <PaymentSheet
        visible={!!payingOrder}
        order={payingOrder}
        onConfirm={handleCollectPayment}
        onClose={() => setPayingOrder(null)}
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
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
  countBadge: {
    backgroundColor: COLORS.accentGoldSoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
  },
  queuedBadge: {
    backgroundColor: 'rgba(211,47,47,0.15)',
  },
  queuedBadgeText: {
    color: '#D32F2F',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  toggleCompleted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  toggleText: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
})
