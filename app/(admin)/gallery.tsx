import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { GalleryPhoto } from '@/types/database';

interface PhotoForm {
  caption: string;
  link_url: string;
  sort_order: string;
  localImageUri: string | null;
  image_url: string | null;
}

const EMPTY_FORM: PhotoForm = {
  caption: '',
  link_url: '',
  sort_order: '1',
  localImageUri: null,
  image_url: null,
};

export default function GalleryScreen() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);
  const [form, setForm] = useState<PhotoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase
      .from('gallery_photos')
      .select('*')
      .order('sort_order', { ascending: true });

    if (data) setPhotos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPhotos();

    const channel = supabase
      .channel('gallery-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_photos' }, () => {
        fetchPhotos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPhotos]);

  const deletePhoto = (photo: GalleryPhoto) => {
    Alert.alert(
      'Delete Photo',
      `Delete "${photo.caption || 'this photo'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('gallery_photos')
              .delete()
              .eq('id', photo.id);
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
      aspect: [4, 3],
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
      .from('gallery-images')
      .upload(fileName, formData, { contentType: mimeType });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('gallery-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  // --- Open modals ---
  const openAddModal = () => {
    setEditingPhoto(null);
    setForm({
      ...EMPTY_FORM,
      sort_order: String(photos.length + 1),
    });
    setModalVisible(true);
  };

  const openEditModal = (photo: GalleryPhoto) => {
    setEditingPhoto(photo);
    setForm({
      caption: photo.caption ?? '',
      link_url: photo.link_url ?? '',
      sort_order: String(photo.sort_order),
      localImageUri: null,
      image_url: photo.image_url,
    });
    setModalVisible(true);
  };

  // --- Save handler ---
  const handleSave = async () => {
    if (!editingPhoto && !form.localImageUri) {
      return Alert.alert('Error', 'Please select an image');
    }
    if (!form.caption.trim()) {
      return Alert.alert('Error', 'Caption is required');
    }

    setSaving(true);
    try {
      let imageUrl = form.image_url;

      if (form.localImageUri) {
        imageUrl = await uploadImage(form.localImageUri);
      }

      if (editingPhoto) {
        const { error } = await supabase
          .from('gallery_photos')
          .update({
            image_url: imageUrl!,
            caption: form.caption.trim(),
            link_url: form.link_url.trim() || null,
            sort_order: parseInt(form.sort_order) || 0,
          })
          .eq('id', editingPhoto.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('gallery_photos')
          .insert({
            image_url: imageUrl!,
            caption: form.caption.trim(),
            link_url: form.link_url.trim() || null,
            sort_order: parseInt(form.sort_order) || photos.length + 1,
            status: 'published',
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

  const renderPhoto = ({ item }: { item: GalleryPhoto }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openEditModal(item)}
      activeOpacity={0.8}>
      <Image source={{ uri: item.image_url }} style={styles.image} />
      <View style={styles.cardOverlay}>
        <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
        <TouchableOpacity
          onPress={() => deletePhoto(item)}
          style={styles.deleteButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color={Colors.dark.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
      <FlatList
        data={photos}
        keyExtractor={item => String(item.id)}
        renderItem={renderPhoto}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyText}>No photos yet</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={openAddModal}>
              <Text style={styles.emptyButtonText}>Add First Photo</Text>
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
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingPhoto ? 'Edit Photo' : 'New Photo'}
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
              placeholderTextColor={Colors.dark.textMuted}
            />

            {/* Link URL */}
            <Text style={styles.fieldLabel}>Link URL (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.link_url}
              onChangeText={v => setForm(f => ({ ...f, link_url: v }))}
              placeholder="https://..."
              placeholderTextColor={Colors.dark.textMuted}
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
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="number-pad"
            />
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
  list: {
    padding: Spacing.sm,
    paddingBottom: 100,
  },
  row: {
    gap: Spacing.sm,
  },
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.dark.bgSurface,
    marginBottom: Spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caption: {
    flex: 1,
    color: Colors.dark.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 12,
  },
  deleteButton: {
    paddingLeft: Spacing.sm,
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
    aspectRatio: 4 / 3,
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
  // Form
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
});
