import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  Switch,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { MenuItem, Category } from '@/types/database';

interface GroupedProduct {
  name: string;
  category_id: string;
  category_name: string;
  image_url: string | null;
  description: string | null;
  variants: MenuItem[];
}

interface ProductForm {
  name: string;
  price: string;
  size_label: string;
  category_id: string;
  description: string;
  image_url: string | null;
  localImageUri: string | null;
}

const EMPTY_FORM: ProductForm = {
  name: '',
  price: '',
  size_label: '',
  category_id: '',
  description: '',
  image_url: null,
  localImageUri: null,
};

export default function MenuScreen() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<GroupedProduct | null>(null);
  const [editingVariant, setEditingVariant] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [menuRes, catRes] = await Promise.all([
      supabase
        .from('menu_items')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('categories')
        .select('*')
        .eq('status', 'published')
        .order('sort_order', { ascending: true }),
    ]);

    if (menuRes.data) setItems(menuRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Group items by name + category (multiple size variants = one product)
  const grouped = useMemo(() => {
    const filtered = selectedCategory
      ? items.filter(i => i.category_id === selectedCategory)
      : items;

    const map = new Map<string, GroupedProduct>();
    for (const item of filtered) {
      const key = `${item.name}__${item.category_id}`;
      if (!map.has(key)) {
        const cat = categories.find(c => c.id === item.category_id);
        map.set(key, {
          name: item.name,
          category_id: item.category_id,
          category_name: cat?.name ?? '',
          image_url: item.image_url,
          description: item.description,
          variants: [],
        });
      }
      map.get(key)!.variants.push(item);
    }
    return Array.from(map.values());
  }, [items, categories, selectedCategory]);

  const toggleAvailability = async (variant: MenuItem) => {
    const newAvailable = !variant.available;
    // Optimistic update
    setItems(prev => prev.map(i => i.id === variant.id ? { ...i, available: newAvailable } : i));

    const { error } = await supabase
      .from('menu_items')
      .update({ available: newAvailable })
      .eq('id', variant.id);

    if (error) {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === variant.id ? { ...i, available: !newAvailable } : i));
      Alert.alert('Error', error.message);
    }
  };

  const deleteItem = (variant: MenuItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete ${variant.name}${variant.size_label ? ` (${variant.size_label})` : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('menu_items')
              .delete()
              .eq('id', variant.id);
            if (error) Alert.alert('Error', error.message);
          },
        },
      ],
    );
  };

  // --- Image picker & upload ---
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setForm(f => ({ ...f, localImageUri: result.assets[0].uri }));
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName,
      type: mimeType,
    } as any);

    const { error } = await supabase.storage
      .from('menu-images')
      .upload(fileName, formData, { contentType: mimeType });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('menu-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  // --- Open modal for new product ---
  const openAddModal = () => {
    setEditingProduct(null);
    setEditingVariant(null);
    setForm({ ...EMPTY_FORM, category_id: categories[0]?.id ?? '' });
    setModalVisible(true);
  };

  // --- Open modal for editing a specific variant ---
  const openEditModal = (product: GroupedProduct, variant: MenuItem) => {
    setEditingProduct(product);
    setEditingVariant(variant);
    setForm({
      name: variant.name,
      price: String(Number(variant.price)),
      size_label: variant.size_label ?? '',
      category_id: variant.category_id,
      description: variant.description ?? '',
      image_url: variant.image_url,
      localImageUri: null,
    });
    setModalVisible(true);
  };

  // --- Open modal to add a new size to existing product ---
  const openAddSizeModal = (product: GroupedProduct) => {
    setEditingProduct(product);
    setEditingVariant(null);
    setForm({
      name: product.name,
      price: '',
      size_label: '',
      category_id: product.category_id,
      description: product.description ?? '',
      image_url: product.image_url,
      localImageUri: null,
    });
    setModalVisible(true);
  };

  // --- Save handler ---
  const handleSave = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Product name is required');
    if (!form.price.trim() || isNaN(Number(form.price))) return Alert.alert('Error', 'Valid price is required');
    if (!form.category_id) return Alert.alert('Error', 'Category is required');

    setSaving(true);
    try {
      let imageUrl = form.image_url;

      if (form.localImageUri) {
        imageUrl = await uploadImage(form.localImageUri);
      }

      if (editingVariant) {
        // Update existing variant
        const { error } = await supabase
          .from('menu_items')
          .update({
            name: form.name.trim(),
            price: Number(form.price),
            size_label: form.size_label.trim() || null,
            category_id: form.category_id,
            description: form.description.trim() || null,
            image_url: imageUrl,
          })
          .eq('id', editingVariant.id);

        if (error) throw error;

        // If name changed, update all variants of the same product too
        if (editingProduct && form.name.trim() !== editingProduct.name) {
          const siblingIds = editingProduct.variants
            .filter(v => v.id !== editingVariant.id)
            .map(v => v.id);
          if (siblingIds.length > 0) {
            await supabase
              .from('menu_items')
              .update({ name: form.name.trim() })
              .in('id', siblingIds);
          }
        }

        // If image changed, update all variants of the same product
        if (editingProduct && imageUrl !== editingProduct.image_url) {
          const siblingIds = editingProduct.variants
            .filter(v => v.id !== editingVariant.id)
            .map(v => v.id);
          if (siblingIds.length > 0) {
            await supabase
              .from('menu_items')
              .update({ image_url: imageUrl })
              .in('id', siblingIds);
          }
        }
      } else {
        // Create new menu item
        const { error } = await supabase
          .from('menu_items')
          .insert({
            name: form.name.trim(),
            price: Number(form.price),
            size_label: form.size_label.trim() || null,
            category_id: form.category_id,
            description: form.description.trim() || null,
            image_url: imageUrl,
            status: 'published',
            available: true,
            is_featured: false,
            sort_order: items.length,
          });

        if (error) throw error;
      }

      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Render size row ---
  const renderSizeRow = (variant: MenuItem) => (
    <View key={variant.id} style={[styles.sizeRow, !variant.available && styles.sizeRowUnavailable]}>
      <Text style={styles.sizeLabel}>{variant.size_label || 'Regular'}</Text>
      <Text style={styles.sizePrice}>₱{Number(variant.price).toFixed(2)}</Text>
      <Switch
        value={variant.available}
        onValueChange={() => toggleAvailability(variant)}
        trackColor={{ false: '#333', true: Colors.dark.accentGoldSoft }}
        thumbColor={variant.available ? Colors.dark.accentGold : '#888'}
        style={styles.sizeSwitch}
      />
    </View>
  );

  // --- Render product card ---
  const renderProduct = ({ item }: { item: GroupedProduct }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {/* Thumbnail */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={22} color={Colors.dark.textMuted} />
          </View>
        )}

        {/* Center: name + category badge */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{item.category_name}</Text>
          </View>
        </View>

        {/* Right: edit + add-size + delete */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => openEditModal(item, item.variants[0])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={18} color={Colors.dark.accentGold} />
          </TouchableOpacity>
          {item.variants.length < 5 && (
            <TouchableOpacity
              style={styles.actionIcon}
              onPress={() => openAddSizeModal(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="add-circle-outline" size={18} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionIcon}
            onPress={() => deleteItem(item.variants[0])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color={Colors.dark.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Size rows */}
      <View style={styles.sizeList}>
        {item.variants.map(v => renderSizeRow(v))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.dark.accentGold} size="large" />
      </View>
    );
  }

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
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyText}>No products found</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openAddModal}>
              <Text style={styles.emptyButtonText}>Add First Product</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color={Colors.dark.textOnGold} />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingVariant ? 'Edit Product' : editingProduct ? 'Add Size' : 'New Product'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.dark.accentGold} size="small" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* Image Picker */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.7}>
              {(form.localImageUri || form.image_url) ? (
                <Image
                  source={{ uri: form.localImageUri || form.image_url! }}
                  style={styles.imagePreview}
                />
              ) : (
                <View style={styles.imagePickerEmpty}>
                  <Ionicons name="camera-outline" size={32} color={Colors.dark.textMuted} />
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
              placeholderTextColor={Colors.dark.textMuted}
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
                  placeholderTextColor={Colors.dark.textMuted}
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
                  placeholderTextColor={Colors.dark.textMuted}
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
              placeholderTextColor={Colors.dark.textMuted}
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
                    onPress={() => openEditModal(editingProduct, v)}>
                    <Text style={styles.variantSize}>{v.size_label || 'Regular'}</Text>
                    <Text style={styles.variantPrice}>₱{Number(v.price).toFixed(2)}</Text>
                    <Ionicons
                      name={editingVariant?.id === v.id ? 'checkmark-circle' : 'chevron-forward'}
                      size={18}
                      color={editingVariant?.id === v.id ? Colors.dark.accentGold : Colors.dark.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.bgPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.bgPrimary,
  },
  // Category bar
  categoryBar: {
    maxHeight: 52,
    backgroundColor: Colors.dark.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.borderSubtle,
  },
  categoryBarContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.dark.bgSurface,
    borderWidth: 1,
    borderColor: Colors.dark.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: Colors.dark.accentGoldSoft,
    borderColor: Colors.dark.accentGold,
  },
  categoryChipText: {
    color: Colors.dark.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: Colors.dark.accentGold,
    fontWeight: '700',
  },
  // Product list
  list: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.dark.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.borderSubtle,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.bgElevated,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    color: Colors.dark.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.accentGoldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  categoryBadgeText: {
    color: Colors.dark.accentGold,
    fontFamily: 'DMSans',
    fontSize: 11,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    padding: 6,
  },
  // Size rows
  sizeList: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.borderSubtle,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.borderSubtle,
  },
  sizeRowUnavailable: {
    opacity: 0.4,
  },
  sizeLabel: {
    flex: 1,
    color: Colors.dark.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  sizePrice: {
    color: Colors.dark.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
    marginRight: Spacing.sm,
  },
  sizeSwitch: {
    transform: [{ scale: 0.75 }],
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.dark.textMuted,
    fontFamily: 'DMSans',
    fontSize: 16,
  },
  emptyButton: {
    backgroundColor: Colors.dark.accentGold,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  emptyButtonText: {
    color: Colors.dark.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.dark.accentGold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.dark.bgPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.borderSubtle,
    backgroundColor: Colors.dark.bgSecondary,
  },
  modalCancel: {
    color: Colors.dark.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 16,
  },
  modalTitle: {
    color: Colors.dark.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
  modalSave: {
    color: Colors.dark.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
    paddingBottom: 40,
  },
  // Image picker
  imagePicker: {
    width: '100%',
    height: 200,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.dark.bgSurface,
    borderWidth: 1,
    borderColor: Colors.dark.borderSubtle,
    marginBottom: Spacing.sm,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePickerEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  imagePickerText: {
    color: Colors.dark.textMuted,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  // Form fields
  fieldLabel: {
    color: Colors.dark.textSecondary,
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.dark.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.dark.textPrimary,
    fontFamily: 'DMSans',
    borderWidth: 1,
    borderColor: Colors.dark.borderSubtle,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  halfField: {
    flex: 1,
  },
  categoryPicker: {
    maxHeight: 44,
  },
  catOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.dark.bgSurface,
    borderWidth: 1,
    borderColor: Colors.dark.borderSubtle,
    marginRight: Spacing.sm,
  },
  catOptionActive: {
    backgroundColor: Colors.dark.accentGoldSoft,
    borderColor: Colors.dark.accentGold,
  },
  catOptionText: {
    color: Colors.dark.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  catOptionTextActive: {
    color: Colors.dark.accentGold,
    fontWeight: '700',
  },
  // Variant list in edit mode
  variantSection: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.bgSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.borderSubtle,
  },
  variantRowActive: {
    borderColor: Colors.dark.accentGold,
    backgroundColor: Colors.dark.accentGoldSoft,
  },
  variantSize: {
    flex: 1,
    color: Colors.dark.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  variantPrice: {
    color: Colors.dark.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    marginRight: Spacing.sm,
  },
});
