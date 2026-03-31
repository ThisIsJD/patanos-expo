import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { formatPrice } from '@/src/utils/formatPrice'

/**
 * Expandable order card for the Open Orders screen.
 *
 * @param {object} props
 * @param {object} props.order
 * @param {() => void} props.onCollectPayment
 * @param {() => void} props.onCancel
 * @param {boolean} [props.completed] - render in completed-order style
 */
export default function OrderCard({ order, onCollectPayment, onCancel, completed = false }) {
  const [expanded, setExpanded] = useState(false)

  const timeAgo = () => {
    const created = new Date(order.created_at)
    const diff = Math.floor((Date.now() - created.getTime()) / 60000)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    return `${Math.floor(diff / 60)}h ${diff % 60}m ago`
  }

  const orderItems = order.order_items || []

  return (
    <View style={[styles.card, completed && styles.cardCompleted]}>
      {/* Header row — tap to expand */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}>
        <View style={styles.orderBadge}>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={styles.timeText}>{timeAgo()}</Text>
          <Text style={styles.itemSummary} numberOfLines={1}>
            {orderItems.map(i => `${i.quantity}× ${i.item_name}`).join(', ')}
          </Text>
        </View>
        <Text style={styles.totalText}>{formatPrice(order.total_amount)}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={COLORS.textMuted}
          style={{ marginLeft: SPACING.xs }}
        />
      </TouchableOpacity>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.details}>
          {orderItems.map(item => (
            <View key={item.id} style={styles.detailRow}>
              <Text style={styles.detailQty}>{item.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>
                  {item.item_name}
                  {item.size_label ? ` (${item.size_label})` : ''}
                </Text>
                {(item.order_item_modifiers || []).length > 0 && (
                  <Text style={styles.detailMods}>
                    + {item.order_item_modifiers.map(m => m.modifier_name).join(', ')}
                  </Text>
                )}
              </View>
              <Text style={styles.detailPrice}>{formatPrice(item.subtotal)}</Text>
            </View>
          ))}

          {order.notes ? (
            <Text style={styles.orderNotes}>Note: {order.notes}</Text>
          ) : null}

          {/* Actions */}
          {!completed && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.payBtn} onPress={onCollectPayment}>
                <Ionicons name="cash-outline" size={18} color={COLORS.textOnGold} />
                <Text style={styles.payBtnText}>Collect Payment</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Completed info */}
          {completed && order.payment_method && (
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentLabel}>
                Paid via {order.payment_method === 'cash' ? 'Cash' : 'GCash'}
                {order.payment_ref ? ` (Ref: ${order.payment_ref})` : ''}
              </Text>
              {order.amount_tendered && (
                <Text style={styles.paymentLabel}>
                  Tendered: {formatPrice(order.amount_tendered)} | Change: {formatPrice(order.change_amount || 0)}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
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
  cardCompleted: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  orderBadge: {
    backgroundColor: COLORS.accentGoldSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  orderNumber: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  timeText: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 11,
  },
  itemSummary: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
    marginTop: 2,
  },
  totalText: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
    marginLeft: SPACING.sm,
  },
  details: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  detailQty: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    minWidth: 24,
  },
  detailName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  detailMods: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 11,
    marginTop: 2,
  },
  detailPrice: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  orderNotes: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelBtnText: {
    color: COLORS.error,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
  },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.accentGold,
    borderRadius: RADIUS.md,
  },
  payBtnText: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  paymentInfo: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  paymentLabel: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
    marginTop: 2,
  },
})
