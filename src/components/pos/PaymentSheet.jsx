import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { formatPrice } from '@/src/utils/formatPrice'

const QUICK_CASH = [20, 50, 100, 200, 500, 1000]

/**
 * Payment collection modal.
 *
 * @param {object} props
 * @param {boolean} props.visible
 * @param {object} props.order
 * @param {(payment: object) => void} props.onConfirm
 * @param {() => void} props.onClose
 */
export default function PaymentSheet({ visible, order, onConfirm, onClose }) {
  const [method, setMethod] = useState('cash')
  const [amountText, setAmountText] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const total = parseFloat(order?.total_amount) || 0
  const tendered = parseFloat(amountText) || 0
  const change = method === 'cash' ? Math.max(0, tendered - total) : 0

  const canConfirm = method === 'cash'
    ? tendered >= total
    : true // GCash: ref is optional

  const handleConfirm = async () => {
    if (!canConfirm) return
    setSubmitting(true)
    await onConfirm({
      orderId: order.id,
      paymentMethod: method,
      amountTendered: method === 'cash' ? tendered : null,
      changeAmount: method === 'cash' ? change : null,
      paymentRef: method === 'gcash' ? paymentRef.trim() || null : null,
    })
    // Reset state
    setAmountText('')
    setPaymentRef('')
    setMethod('cash')
    setSubmitting(false)
  }

  if (!order) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Collect Payment</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Order summary */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order #{order.order_number}</Text>
            <Text style={styles.summaryTotal}>{formatPrice(total)}</Text>
          </View>

          {/* Payment method tabs */}
          <View style={styles.methodRow}>
            {['cash', 'gcash'].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.methodBtn, method === m && styles.methodBtnActive]}
                onPress={() => setMethod(m)}>
                <Ionicons
                  name={m === 'cash' ? 'cash-outline' : 'phone-portrait-outline'}
                  size={20}
                  color={method === m ? COLORS.textOnGold : COLORS.textSecondary}
                />
                <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                  {m === 'cash' ? 'Cash' : 'GCash'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cash input */}
          {method === 'cash' && (
            <View style={styles.cashSection}>
              <Text style={styles.inputLabel}>Amount Tendered</Text>
              <TextInput
                style={styles.cashInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
              {/* Quick cash buttons */}
              <View style={styles.quickRow}>
                {QUICK_CASH.map(amt => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.quickBtn}
                    onPress={() => setAmountText(String(amt))}>
                    <Text style={styles.quickBtnText}>₱{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Exact amount button */}
              <TouchableOpacity
                style={styles.exactBtn}
                onPress={() => setAmountText(String(total))}>
                <Text style={styles.exactBtnText}>Exact Amount ({formatPrice(total)})</Text>
              </TouchableOpacity>

              {/* Change display */}
              {tendered > 0 && (
                <View style={styles.changeRow}>
                  <Text style={styles.changeLabel}>Change</Text>
                  <Text style={[styles.changeAmount, tendered < total && styles.changeInsufficient]}>
                    {tendered >= total
                      ? formatPrice(change)
                      : `Short ${formatPrice(total - tendered)}`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* GCash input */}
          {method === 'gcash' && (
            <View style={styles.gcashSection}>
              <Text style={styles.inputLabel}>Reference Number (optional)</Text>
              <TextInput
                style={styles.refInput}
                value={paymentRef}
                onChangeText={setPaymentRef}
                placeholder="e.g. 1234567890"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
            </View>
          )}

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.confirmBtn, (!canConfirm || submitting) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm || submitting}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.textOnGold} />
            <Text style={styles.confirmBtnText}>
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
  },
  summaryTotal: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 24,
  },
  methodRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  methodBtnActive: {
    backgroundColor: COLORS.accentGold,
    borderColor: COLORS.accentGold,
  },
  methodText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  methodTextActive: {
    color: COLORS.textOnGold,
  },
  cashSection: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
    marginBottom: SPACING.xs,
  },
  cashInput: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 28,
    padding: SPACING.md,
    textAlign: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  quickBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickBtnText: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
  },
  exactBtn: {
    backgroundColor: COLORS.accentGoldSoft,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  exactBtnText: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
  },
  changeLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  changeAmount: {
    color: COLORS.success,
    fontFamily: 'DMSans-Bold',
    fontSize: 20,
  },
  changeInsufficient: {
    color: COLORS.error,
    fontSize: 16,
  },
  gcashSection: {
    marginBottom: SPACING.md,
  },
  refInput: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 16,
    padding: SPACING.md,
  },
  confirmBtn: {
    backgroundColor: COLORS.accentGold,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
})
