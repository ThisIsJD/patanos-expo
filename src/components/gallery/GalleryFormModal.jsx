import React from 'react'
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'

export default function GalleryFormModal({
  visible,
  onClose,
  onSave,
  form,
  setForm,
  editingPhoto,
  onPickImage,
  saving,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingPhoto ? 'Edit Photo' : 'New Photo'}
          </Text>
          <TouchableOpacity onPress={onSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={COLORS.accentGold} size="small" />
            ) : (
              <Text style={styles.modalSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
          {/* Image Picker */}
          <TouchableOpacity style={styles.imagePicker} onPress={onPickImage} activeOpacity={0.7}>
            {(form.localImageUri || form.image_url) ? (
              <Image
                source={{ uri: form.localImageUri || form.image_url }}
                style={styles.imagePreview}
              />
            ) : (
              <View style={styles.imagePickerEmpty}>
                <Ionicons name="camera-outline" size={32} color={COLORS.textMuted} />
                <Text style={styles.imagePickerText}>Tap to select image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Caption */}
          <Text style={styles.fieldLabel}>Caption</Text>
          <TextInput
            style={styles.input}
            value={form.caption}
            onChangeText={v => setForm(f => ({ ...f, caption: v }))}
            placeholder="Photo caption..."
            placeholderTextColor={COLORS.textMuted}
          />

          {/* Link URL */}
          <Text style={styles.fieldLabel}>Link URL (optional)</Text>
          <TextInput
            style={styles.input}
            value={form.link_url}
            onChangeText={v => setForm(f => ({ ...f, link_url: v }))}
            placeholder="https://..."
            placeholderTextColor={COLORS.textMuted}
            keyboardType="url"
            autoCapitalize="none"
          />

          {/* Sort Order */}
          <Text style={styles.fieldLabel}>Sort Order</Text>
          <TextInput
            style={[styles.input, { width: 100 }]}
            value={form.sort_order}
            onChangeText={v => setForm(f => ({ ...f, sort_order: v }))}
            placeholder="1"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgSecondary,
  },
  modalCancel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 16,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
  modalSave: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
    paddingBottom: 40,
  },
  imagePicker: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePickerEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  imagePickerText: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
})
