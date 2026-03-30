import React, { useState } from 'react'
import { StyleSheet, View, FlatList, TouchableOpacity, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING } from '@/src/constants/theme'
import { useGallery } from '@/src/hooks/useGallery'
import GalleryCard from '@/src/components/gallery/GalleryCard'
import GalleryFormModal from '@/src/components/gallery/GalleryFormModal'
import LoadingSpinner from '@/src/components/common/LoadingSpinner'
import EmptyState from '@/src/components/common/EmptyState'

const EMPTY_FORM = {
  caption: '',
  link_url: '',
  sort_order: '1',
  localImageUri: null,
  image_url: null,
}

export default function GalleryScreen() {
  const { photos, loading, deletePhoto, savePhoto } = useGallery()

  const [modalVisible, setModalVisible] = useState(false)
  const [editingPhoto, setEditingPhoto] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setForm(f => ({ ...f, localImageUri: result.assets[0].uri }))
    }
  }

  const openAddModal = () => {
    setEditingPhoto(null)
    setForm({ ...EMPTY_FORM, sort_order: String(photos.length + 1) })
    setModalVisible(true)
  }

  const openEditModal = (photo) => {
    setEditingPhoto(photo)
    setForm({
      caption: photo.caption ?? '',
      link_url: photo.link_url ?? '',
      sort_order: String(photo.sort_order),
      localImageUri: null,
      image_url: photo.image_url,
    })
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!editingPhoto && !form.localImageUri) {
      return Alert.alert('Error', 'Please select an image')
    }
    if (!form.caption.trim()) {
      return Alert.alert('Error', 'Caption is required')
    }

    setSaving(true)
    try {
      await savePhoto({ form, editingPhoto, localImageUri: form.localImageUri })
      setModalVisible(false)
    } catch (err) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (photo) => {
    Alert.alert(
      'Delete Photo',
      `Delete "${photo.caption || 'this photo'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePhoto(photo.id),
        },
      ],
    )
  }

  if (loading) return <LoadingSpinner />

  return (
    <View style={styles.container}>
      <FlatList
        data={photos}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <GalleryCard photo={item} onEdit={openEditModal} onDelete={handleDelete} />
        )}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="images-outline"
            message="No photos yet"
            actionLabel="Add First Photo"
            onAction={openAddModal}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color={COLORS.textOnGold} />
      </TouchableOpacity>

      {/* Form Modal */}
      <GalleryFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        form={form}
        setForm={setForm}
        editingPhoto={editingPhoto}
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
  list: {
    padding: SPACING.sm,
    paddingBottom: 100,
  },
  row: {
    gap: SPACING.sm,
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
