import React, { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal,
  ScrollView, Switch, Alert, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { useModifiers } from '@/src/hooks/useModifiers'

// ───────────────────────────────────────
// Empty group form
// ───────────────────────────────────────
const EMPTY_GROUP = {
  name: '',
  linkType: 'category', // 'category' | 'item'
  categoryId: '',
  menuItemId: '',
  minSelect: 0,
  maxSelect: '',
}

const EMPTY_MODIFIER = {
  name: '',
  extraPrice: '',
}

export default function ModifiersScreen() {
  const {
    groups, categories, menuItems, loading,
    getGroupTarget, saveGroup, deleteGroup,
    saveModifier, toggleModifier, deleteModifier,
  } = useModifiers()

  // Modal states
  const [groupModalVisible, setGroupModalVisible] = useState(false)
  const [modifierModalVisible, setModifierModalVisible] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [editingModifier, setEditingModifier] = useState(null)
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP)
  const [modForm, setModForm] = useState(EMPTY_MODIFIER)
  const [saving, setSaving] = useState(false)

  // ─── Group CRUD ───────────────────────
  const openNewGroup = () => {
    setEditingGroup(null)
    setGroupForm({ ...EMPTY_GROUP, categoryId: categories[0]?.id ?? '' })
    setGroupModalVisible(true)
  }

  const openEditGroup = (group) => {
    setEditingGroup(group)
    setGroupForm({
      name: group.name,
      linkType: group.menu_item_id ? 'item' : 'category',
      categoryId: group.category_id || '',
      menuItemId: group.menu_item_id || '',
      minSelect: group.min_select,
      maxSelect: group.max_select != null ? String(group.max_select) : '',
    })
    setGroupModalVisible(true)
  }

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return Alert.alert('Error', 'Group name is required')
    const linkType = groupForm.linkType
    if (linkType === 'category' && !groupForm.categoryId) return Alert.alert('Error', 'Pick a category')
    if (linkType === 'item' && !groupForm.menuItemId) return Alert.alert('Error', 'Pick a menu item')

    setSaving(true)
    try {
      await saveGroup({
        id: editingGroup?.id,
        name: groupForm.name,
        categoryId: linkType === 'category' ? groupForm.categoryId : null,
        menuItemId: linkType === 'item' ? groupForm.menuItemId : null,
        minSelect: Number(groupForm.minSelect) || 0,
        maxSelect: groupForm.maxSelect ? Number(groupForm.maxSelect) : null,
      })
      setGroupModalVisible(false)
    } catch (e) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteGroup = (group) => {
    Alert.alert(
      'Delete Group',
      `Delete "${group.name}" and all its options?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteGroup(group.id) },
      ]
    )
  }

  // ─── Modifier CRUD ────────────────────
  const openNewModifier = (groupId) => {
    setActiveGroupId(groupId)
    setEditingModifier(null)
    setModForm({ ...EMPTY_MODIFIER })
    setModifierModalVisible(true)
  }

  const openEditModifier = (groupId, mod) => {
    setActiveGroupId(groupId)
    setEditingModifier(mod)
    setModForm({
      name: mod.name,
      extraPrice: String(mod.extra_price),
    })
    setModifierModalVisible(true)
  }

  const handleSaveModifier = async () => {
    if (!modForm.name.trim()) return Alert.alert('Error', 'Name is required')

    setSaving(true)
    try {
      await saveModifier({
        id: editingModifier?.id,
        groupId: activeGroupId,
        name: modForm.name,
        extraPrice: modForm.extraPrice,
      })
      setModifierModalVisible(false)
    } catch (e) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteModifier = (mod) => {
    Alert.alert(
      'Delete Option',
      `Delete "${mod.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteModifier(mod.id) },
      ]
    )
  }

  // ─── Render ───────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.accentGold} size="large" />
      </View>
    )
  }

  const renderGroup = ({ item: group }) => (
    <View style={styles.groupCard}>
      {/* Group header */}
      <View style={styles.groupHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupTarget}>{getGroupTarget(group)}</Text>
          <Text style={styles.groupRule}>
            {group.min_select === 0 ? 'Optional' : 'Required'}
            {' · '}
            {group.max_select === 1 ? 'Pick one' : 'Pick many'}
          </Text>
        </View>
        <View style={styles.groupActions}>
          <TouchableOpacity onPress={() => openEditGroup(group)} style={styles.iconBtn}>
            <Ionicons name="pencil" size={18} color={COLORS.accentGold} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDeleteGroup(group)} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modifier options */}
      {group.modifiers.map(mod => (
        <View key={mod.id} style={styles.modRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modName, !mod.available && styles.modUnavailable]}>
              {mod.name}
            </Text>
            {mod.extra_price > 0 && (
              <Text style={styles.modPrice}>+₱{Number(mod.extra_price).toFixed(2)}</Text>
            )}
          </View>
          <Switch
            value={mod.available}
            onValueChange={() => toggleModifier(mod)}
            trackColor={{ false: COLORS.bgElevated, true: COLORS.accentGoldSoft }}
            thumbColor={mod.available ? COLORS.accentGold : COLORS.textMuted}
          />
          <TouchableOpacity onPress={() => openEditModifier(group.id, mod)} style={styles.iconBtn}>
            <Ionicons name="pencil" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDeleteModifier(mod)} style={styles.iconBtn}>
            <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Add option button */}
      <TouchableOpacity style={styles.addModBtn} onPress={() => openNewModifier(group.id)}>
        <Ionicons name="add-circle-outline" size={18} color={COLORS.accentGold} />
        <Text style={styles.addModText}>Add option</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={g => String(g.id)}
        renderItem={renderGroup}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="options-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No modifier groups yet</Text>
            <Text style={styles.emptySubtext}>
              Add groups for add-ons, flavors, or preparation styles
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openNewGroup} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color={COLORS.textOnGold} />
      </TouchableOpacity>

      {/* ─── Group Modal ──────────────── */}
      <Modal visible={groupModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGroupModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setGroupModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingGroup ? 'Edit Group' : 'New Group'}
            </Text>
            <TouchableOpacity onPress={handleSaveGroup} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={COLORS.accentGold} size="small" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* Name */}
            <Text style={styles.fieldLabel}>Group Name</Text>
            <TextInput
              style={styles.input}
              value={groupForm.name}
              onChangeText={v => setGroupForm(f => ({ ...f, name: v }))}
              placeholder="e.g. Add-ons, Flavor, Style"
              placeholderTextColor={COLORS.textMuted}
            />

            {/* Link type toggle */}
            <Text style={styles.fieldLabel}>Applies To</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, groupForm.linkType === 'category' && styles.toggleBtnActive]}
                onPress={() => setGroupForm(f => ({ ...f, linkType: 'category', menuItemId: '' }))}>
                <Text style={[styles.toggleText, groupForm.linkType === 'category' && styles.toggleTextActive]}>
                  Category
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, groupForm.linkType === 'item' && styles.toggleBtnActive]}
                onPress={() => setGroupForm(f => ({ ...f, linkType: 'item', categoryId: '' }))}>
                <Text style={[styles.toggleText, groupForm.linkType === 'item' && styles.toggleTextActive]}>
                  Specific Item
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category picker */}
            {groupForm.linkType === 'category' && (
              <>
                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, groupForm.categoryId === cat.id && styles.chipActive]}
                      onPress={() => setGroupForm(f => ({ ...f, categoryId: cat.id }))}>
                      <Text style={[styles.chipText, groupForm.categoryId === cat.id && styles.chipTextActive]}>
                        {cat.icon} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Menu item picker */}
            {groupForm.linkType === 'item' && (
              <>
                <Text style={styles.fieldLabel}>Menu Item</Text>
                <ScrollView style={styles.itemPicker} nestedScrollEnabled>
                  {menuItems.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.itemRow, groupForm.menuItemId === item.id && styles.itemRowActive]}
                      onPress={() => setGroupForm(f => ({ ...f, menuItemId: item.id }))}>
                      <Text style={[styles.itemRowText, groupForm.menuItemId === item.id && styles.itemRowTextActive]}>
                        {item.name}
                      </Text>
                      {groupForm.menuItemId === item.id && (
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.accentGold} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Selection rules */}
            <Text style={styles.fieldLabel}>Selection Rule</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, groupForm.minSelect === 0 && styles.toggleBtnActive]}
                onPress={() => setGroupForm(f => ({ ...f, minSelect: 0 }))}>
                <Text style={[styles.toggleText, groupForm.minSelect === 0 && styles.toggleTextActive]}>
                  Optional
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, groupForm.minSelect === 1 && styles.toggleBtnActive]}
                onPress={() => setGroupForm(f => ({ ...f, minSelect: 1 }))}>
                <Text style={[styles.toggleText, groupForm.minSelect === 1 && styles.toggleTextActive]}>
                  Required
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>How Many Can Be Selected?</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, groupForm.maxSelect === '1' && styles.toggleBtnActive]}
                onPress={() => setGroupForm(f => ({ ...f, maxSelect: '1' }))}>
                <Text style={[styles.toggleText, groupForm.maxSelect === '1' && styles.toggleTextActive]}>
                  Pick one
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, groupForm.maxSelect === '' && styles.toggleBtnActive]}
                onPress={() => setGroupForm(f => ({ ...f, maxSelect: '' }))}>
                <Text style={[styles.toggleText, groupForm.maxSelect === '' && styles.toggleTextActive]}>
                  Pick many
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modifier Modal ───────────── */}
      <Modal visible={modifierModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModifierModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModifierModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingModifier ? 'Edit Option' : 'New Option'}
            </Text>
            <TouchableOpacity onPress={handleSaveModifier} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={COLORS.accentGold} size="small" />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            <Text style={styles.fieldLabel}>Option Name</Text>
            <TextInput
              style={styles.input}
              value={modForm.name}
              onChangeText={v => setModForm(f => ({ ...f, name: v }))}
              placeholder="e.g. Yakult, Cheese, Fried"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.fieldLabel}>Extra Price (₱)</Text>
            <TextInput
              style={styles.input}
              value={modForm.extraPrice}
              onChangeText={v => setModForm(f => ({ ...f, extraPrice: v }))}
              placeholder="0 for no extra charge"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ─── Styles ─────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
    gap: SPACING.md,
  },
  empty: {
    alignItems: 'center',
    marginTop: 80,
    gap: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 14,
    textAlign: 'center',
  },

  // Group card
  groupCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  groupName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 17,
  },
  groupTarget: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans',
    fontSize: 13,
    marginTop: 2,
  },
  groupRule: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
    marginTop: 2,
  },
  groupActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },

  // Modifier rows
  modRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  modName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 15,
  },
  modUnavailable: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  modPrice: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Medium',
    fontSize: 13,
  },

  addModBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  addModText: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
  },

  iconBtn: {
    padding: SPACING.xs,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.accentGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Modal shared
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

  // Form fields
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

  // Toggle buttons
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  toggleTextActive: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
  },

  // Chips (category picker)
  chipScroll: {
    maxHeight: 44,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  chipActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 14,
  },
  chipTextActive: {
    color: COLORS.accentGold,
    fontWeight: '700',
  },

  // Item picker
  itemPicker: {
    maxHeight: 200,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemRowActive: {
    backgroundColor: COLORS.accentGoldSoft,
  },
  itemRowText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontFamily: 'DMSans',
    fontSize: 15,
  },
  itemRowTextActive: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
  },
})
