import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { formatPrice } from '@/src/utils/formatPrice'
import { supabase } from '@/src/lib/supabase'

/**
 * Bottom sheet that appears when tapping a menu item in the POS grid.
 * Shows size variants (if any) and applicable modifier groups.
 *
 * @param {object} props
 * @param {object|null} props.item - the tapped menu_item
 * @param {boolean} props.visible
 * @param {(item: object, modifiers: Array) => void} props.onAdd
 * @param {() => void} props.onClose
 * @param {Array} props.allItems - all menu_items (to find size variants)
 */
export default function ModifierPicker({ item, visible, onAdd, onClose, allItems }) {
  const [modifierGroups, setModifierGroups] = useState([])
  const [selectedModifiers, setSelectedModifiers] = useState([])
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [quantity, setQuantity] = useState(1)

  // Find size variants (same name + category_id)
  const variants = useMemo(() => {
    if (!item) return []
    return allItems.filter(
      i => i.name === item.name && i.category_id === item.category_id && i.status === 'published',
    )
  }, [item, allItems])

  // Fetch modifier groups applicable to this item
  useEffect(() => {
    if (!item || !visible) return
    setSelectedModifiers([])
    setQuantity(1)
    setSelectedVariant(variants.length > 1 ? item : item)

    const fetchModifiers = async () => {
      // Match: global groups (no category or item filter), category-level, or item-level
      const { data } = await supabase
        .from('modifier_groups')
        .select('*, modifiers(*)')
        .or(
          `category_id.eq.${item.category_id},menu_item_id.eq.${item.id},and(category_id.is.null,menu_item_id.is.null)`,
        )
        .order('sort_order', { ascending: true })

      if (data) {
        const sorted = data.map(g => ({
          ...g,
          modifiers: (g.modifiers || []).sort((a, b) => a.sort_order - b.sort_order),
        }))
        setModifierGroups(sorted)
      }
    }
    fetchModifiers()
  }, [item, visible])

  const toggleModifier = (group, modifier) => {
    setSelectedModifiers(prev => {
      const isSelected = prev.some(m => m.id === modifier.id)
      if (isSelected) {
        return prev.filter(m => m.id !== modifier.id)
      }
      // Enforce max_select per group
      const groupSelected = prev.filter(m =>
        group.modifiers.some(gm => gm.id === m.id),
      )
      if (group.max_select && groupSelected.length >= group.max_select) {
        // Replace the first selection in this group
        const firstId = groupSelected[0].id
        return [...prev.filter(m => m.id !== firstId), modifier]
      }
      return [...prev, modifier]
    })
  }

  const handleAdd = () => {
    const target = selectedVariant || item
    onAdd(target, selectedModifiers, quantity)
    onClose()
  }

  const modifierTotal = selectedModifiers.reduce(
    (s, m) => s + (parseFloat(m.extra_price) || 0),
    0,
  )
  const lineTotal = selectedVariant
    ? (parseFloat(selectedVariant.price) + modifierTotal) * quantity
    : 0

  if (!item) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.thumb} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Size variants */}
            {variants.length > 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Size</Text>
                <View style={styles.chipRow}>
                  {variants.map(v => {
                    const isActive = selectedVariant?.id === v.id
                    return (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => setSelectedVariant(v)}>
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                          {v.size_label || 'Regular'}
                        </Text>
                        <Text style={[styles.chipPrice, isActive && styles.chipTextActive]}>
                          {formatPrice(v.price)}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Modifier groups */}
            {modifierGroups.map(group => (
              <View key={group.id} style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {group.name}
                  {group.max_select === 1
                    ? ' (pick 1)'
                    : group.max_select
                      ? ` (up to ${group.max_select})`
                      : ''}
                </Text>
                {group.min_select > 0 && (
                  <Text style={styles.required}>Required</Text>
                )}
                <View style={styles.chipRow}>
                  {group.modifiers.map(mod => {
                    const isSelected = selectedModifiers.some(m => m.id === mod.id)
                    return (
                      <TouchableOpacity
                        key={mod.id}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => toggleModifier(group, mod)}>
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {mod.name}
                        </Text>
                        {parseFloat(mod.extra_price) > 0 && (
                          <Text style={[styles.chipPrice, isSelected && styles.chipTextActive]}>
                            +{formatPrice(mod.extra_price)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Footer — quantity + add */}
          <View style={styles.footer}>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(q => Math.max(1, q - 1))}>
                <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(q => q + 1)}>
                <Ionicons name="add" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
              <Text style={styles.addBtnText}>
                Add {formatPrice(lineTotal)}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
    marginRight: SPACING.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
  },
  itemName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
  itemDesc: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: SPACING.md,
  },
  section: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans',
    fontSize: 11,
    marginBottom: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
  },
  chipTextActive: {
    color: COLORS.accentGold,
  },
  chipPrice: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.md,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyBtn: {
    padding: SPACING.sm,
  },
  qtyText: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
    minWidth: 32,
    textAlign: 'center',
  },
  addBtn: {
    flex: 1,
    backgroundColor: COLORS.accentGold,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: {
    color: COLORS.textOnGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
})
