import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'

export default function GalleryCard({ photo, onEdit, onDelete }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onEdit(photo)} activeOpacity={0.8}>
      <Image source={{ uri: photo.image_url }} style={styles.image} />
      <View style={styles.cardOverlay}>
        <Text style={styles.caption} numberOfLines={2}>{photo.caption}</Text>
        <TouchableOpacity
          onPress={() => onDelete(photo)}
          style={styles.deleteButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
    marginBottom: SPACING.sm,
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
    padding: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caption: {
    flex: 1,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 12,
  },
  deleteButton: {
    paddingLeft: SPACING.sm,
  },
})
