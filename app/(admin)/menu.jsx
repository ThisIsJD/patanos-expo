import React, { useState } from 'react'
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  Alert, ScrollView,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { useMenu } from '@/src/hooks/useMenu'
import MenuItemCard from '@/src/components/menu/MenuItemCard'
import MenuFormModal from '@/src/components/menu/MenuFormModal'
import LoadingSpinner from '@/src/components/common/LoadingSpinner'
import EmptyState from '@/src/components/common/EmptyState'

const EMPTY_FORM = {
  name: '',
  price: '',
  size_label: '',
  category_id: '',
  description: '',
  image_url: null,
  localImageUri: null,
}

export default function MenuScreen() {
  const {
    categories, loading,
    selectedCategory, setSelectedCategory,
    grouped,
    toggleAvailability, deleteMenuItem, saveMenuItem,
  } = useMenu()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editingVariant, setEditingVariant] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setForm(f => ({ ...f, localImageUri: result.assets[0].uri }))
    }
  }

  const openAddModal = () => {
    setEditingProduct(null)
    setEditingVariant(null)
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' })
    setModalVisible(true)
  }

  const openEditModal = (product, variant) => {
    setEditingProduct(product)
    setEditingVariant(variant)
    setForm({
      name: variant.name,
      price: String(Number(variant.price)),
      size_label: variant.size_label ?? '',
      category_id: variant.category_id,
      description: variant.description ?? '',
      image_url: variant.image_url,
      localImageUri: null,
    })
    setModalVisible(true)
  }

  const openAddSizeModal = (product) => {
    setEditingProduct(product)
    setEditingVariant(null)
    setForm({
      name: product.name,
      price: '',
      size_label: '',
      category_id: product.category_id,
      description: product.description ?? '',
      image_url: product.image_url,
      localImageUri: null,
    })
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Product name is required')
    if (!form.price.trim() || isNaN(Number(form.price))) return Alert.alert('Error', 'Valid price is required')
    if (!form.category_id) return Alert.alert('Error', 'Category is required')

    setSaving(true)
    try {
      await saveMenuItem({
        form,
        editingVariant,
        editingProduct,
        localImageUri: form.localImageUri,
      })
      setModalVisible(false)
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (variant) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete ${variant.name}${variant.size_label ? ` (${variant.size_label})` : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMenuItem(variant.id),
        },
      ],
    )
  }

  if (loading) return <LoadingSpinner />

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryBarContent}>
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}>
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat.id)}>
            <Text style={[
              styles.categoryChipText,
              selectedCategory === cat.id && styles.categoryChipTextActive,
            ]}>
              {cat.icon} {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Product list */}
      <FlatList
        data={grouped}
        keyExtractor={item => `${item.name}__${item.category_id}`}
        renderItem={({ item }) => (
          <MenuItemCard
            product={item}
            onEdit={openEditModal}
            onAddSize={openAddSizeModal}
            onDelete={handleDelete}
            onToggle={toggleAvailability}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="restaurant-outline"
            message="No products found"
            actionLabel="Add First Product"
            onAction={openAddModal}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color={COLORS.textOnGold} />
      </TouchableOpacity>

      {/* Form Modal */}
      <MenuFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        form={form}
        setForm={setForm}
        categories={categories}
        editingProduct={editingProduct}
        editingVariant={editingVariant}
        onEditVariant={openEditModal}
        onPickImage={pickImage}
        saving={saving}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  categoryBar: {
    maxHeight: 52,
    backgroundColor: COLORS.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryBarContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: COLORS.accentGold,
    fontWeight: '700',
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.accentGold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
})
