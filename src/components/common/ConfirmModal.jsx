import React from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'

export default function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  destructive = false,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, destructive && styles.destructiveButton]}
              onPress={onConfirm}>
              <Text style={[styles.confirmText, destructive && styles.destructiveText]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  dialog: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
  },
  title: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    marginBottom: SPACING.sm,
  },
  message: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
    marginBottom: SPACING.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.bgElevated,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.accentGold,
  },
  confirmText: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  destructiveButton: {
    backgroundColor: COLORS.error,
  },
  destructiveText: {
    color: COLORS.textPrimary,
  },
})
