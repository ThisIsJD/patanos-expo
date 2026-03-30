import React from 'react'
import {
  View, Text, Image, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'

export default function MenuFormModal({
  visible,
  onClose,
  onSave,
  form,
  setForm,
  categories,
  editingProduct,
  editingVariant,
  onEditVariant,
  onPickImage,
  saving,
}) {
  const title = editingVariant ? 'Edit Product' : editingProduct ? 'Add Size' : 'New Product'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
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
                <Text style={styles.imagePickerText}>Tap to add image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          <Text style={styles.fieldLabel}>Product Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={v => setForm(f => ({ ...f, name: v }))}
            placeholder="e.g. Halo Halo"
            placeholderTextColor={COLORS.textMuted}
            editable={!editingProduct || !!editingVariant}
          />

          {/* Category Picker */}
          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryPicker}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catOption,
                  form.category_id === cat.id && styles.catOptionActive,
                ]}
                onPress={() => setForm(f => ({ ...f, category_id: cat.id }))}>
                <Text style={[
                  styles.catOptionText,
                  form.category_id === cat.id && styles.catOptionTextActive,
                ]}>
                  {cat.icon} {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Price & Size */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Price (₱)</Text>
              <TextInput
                style={styles.input}
                value={form.price}
                onChangeText={v => setForm(f => ({ ...f, price: v }))}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Size Label</Text>
              <TextInput
                style={styles.input}
                value={form.size_label}
                onChangeText={v => setForm(f => ({ ...f, size_label: v }))}
                placeholder="e.g. Small"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Description */}
          <Text style={styles.fieldLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={form.description}
            onChangeText={v => setForm(f => ({ ...f, description: v }))}
            placeholder="Short description..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={3}
          />

          {/* Variant list when editing */}
          {editingProduct && editingProduct.variants.length > 1 && (
            <View style={styles.variantSection}>
              <Text style={styles.fieldLabel}>All Sizes</Text>
              {editingProduct.variants.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.variantRow,
                    editingVariant?.id === v.id && styles.variantRowActive,
                  ]}
                  onPress={() => onEditVariant(editingProduct, v)}>
                  <Text style={styles.variantSize}>{v.size_label || 'Regular'}</Text>
                  <Text style={styles.variantPrice}>₱{Number(v.price).toFixed(2)}</Text>
                  <Ionicons
                    name={editingVariant?.id === v.id ? 'checkmark-circle' : 'chevron-forward'}
                    size={18}
                    color={editingVariant?.id === v.id ? COLORS.accentGold : COLORS.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
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
    height: 200,
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
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  halfField: {
    flex: 1,
  },
  categoryPicker: {
    maxHeight: 44,
  },
  catOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  catOptionActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  catOptionText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  catOptionTextActive: {
    color: COLORS.accentGold,
    fontWeight: '700',
  },
  variantSection: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  variantRowActive: {
    borderColor: COLORS.accentGold,
    backgroundColor: COLORS.accentGoldSoft,
  },
  variantSize: {
    flex: 1,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  variantPrice: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    marginRight: SPACING.sm,
  },
})
