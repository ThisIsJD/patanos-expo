import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/src/lib/supabase'

export function useModifiers() {
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [grpRes, catRes, itemRes] = await Promise.all([
      supabase
        .from('modifier_groups')
        .select('*, modifiers(*)')
        .order('sort_order', { ascending: true }),
      supabase
        .from('categories')
        .select('id, name, slug, icon')
        .eq('status', 'published')
        .order('sort_order', { ascending: true }),
      supabase
        .from('menu_items')
        .select('id, name, category_id')
        .eq('status', 'published')
        .order('name', { ascending: true }),
    ])

    if (grpRes.data) {
      // Sort modifiers within each group
      const sorted = grpRes.data.map(g => ({
        ...g,
        modifiers: (g.modifiers || []).sort((a, b) => a.sort_order - b.sort_order),
      }))
      setGroups(sorted)
    }
    if (catRes.data) setCategories(catRes.data)
    if (itemRes.data) {
      // Deduplicate menu items by name (sizes share a name)
      const unique = []
      const seen = new Set()
      for (const item of itemRes.data) {
        if (!seen.has(item.name)) {
          seen.add(item.name)
          unique.push(item)
        }
      }
      setMenuItems(unique)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('modifier-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modifier_groups' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modifiers' }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  /** Get display label for a group's target (category name or menu item name) */
  const getGroupTarget = useCallback((group) => {
    if (group.category_id) {
      const cat = categories.find(c => c.id === group.category_id)
      return cat ? `${cat.icon || ''} ${cat.name} (category)`.trim() : 'Unknown category'
    }
    if (group.menu_item_id) {
      const item = menuItems.find(i => i.id === group.menu_item_id)
      return item ? `${item.name} (item)` : 'Unknown item'
    }
    return 'Global (all items)'
  }, [categories, menuItems])

  /** Save a modifier group (create or update) */
  const saveGroup = async ({ id, name, categoryId, menuItemId, minSelect, maxSelect }) => {
    const data = {
      name: name.trim(),
      category_id: categoryId || null,
      menu_item_id: menuItemId || null,
      min_select: minSelect,
      max_select: maxSelect || null,
    }

    if (id) {
      const { error } = await supabase.from('modifier_groups').update(data).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('modifier_groups').insert({ ...data, sort_order: groups.length })
      if (error) throw error
    }
  }

  /** Delete a modifier group (cascades to its modifiers) */
  const deleteGroup = async (id) => {
    const { error } = await supabase.from('modifier_groups').delete().eq('id', id)
    if (error) Alert.alert('Error', error.message)
  }

  /** Save a modifier option (create or update) */
  const saveModifier = async ({ id, groupId, name, extraPrice }) => {
    const data = {
      modifier_group_id: groupId,
      name: name.trim(),
      extra_price: Number(extraPrice) || 0,
    }

    if (id) {
      const { error } = await supabase.from('modifiers').update(data).eq('id', id)
      if (error) throw error
    } else {
      const group = groups.find(g => g.id === groupId)
      const sortOrder = group ? group.modifiers.length : 0
      const { error } = await supabase.from('modifiers').insert({ ...data, sort_order: sortOrder })
      if (error) throw error
    }
  }

  /** Toggle modifier availability */
  const toggleModifier = async (modifier) => {
    const newAvailable = !modifier.available
    // Optimistic update
    setGroups(prev => prev.map(g => ({
      ...g,
      modifiers: g.modifiers.map(m =>
        m.id === modifier.id ? { ...m, available: newAvailable } : m
      ),
    })))

    const { error } = await supabase
      .from('modifiers')
      .update({ available: newAvailable })
      .eq('id', modifier.id)

    if (error) {
      setGroups(prev => prev.map(g => ({
        ...g,
        modifiers: g.modifiers.map(m =>
          m.id === modifier.id ? { ...m, available: !newAvailable } : m
        ),
      })))
      Alert.alert('Error', error.message)
    }
  }

  /** Delete a single modifier option */
  const deleteModifier = async (id) => {
    const { error } = await supabase.from('modifiers').delete().eq('id', id)
    if (error) Alert.alert('Error', error.message)
  }

  return {
    groups,
    categories,
    menuItems,
    loading,
    getGroupTarget,
    saveGroup,
    deleteGroup,
    saveModifier,
    toggleModifier,
    deleteModifier,
    refresh: fetchData,
  }
}
