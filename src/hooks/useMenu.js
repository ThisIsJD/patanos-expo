import { useState, useCallback, useEffect, useMemo } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/src/lib/supabase'
import { groupMenu } from '@/src/utils/groupMenu'
import { uploadImage } from '@/src/utils/imageUpload'

export function useMenu() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [loading, setLoading] = useState(true)

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
    ])

    if (menuRes.data) setItems(menuRes.data)
    if (catRes.data) setCategories(catRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  const grouped = useMemo(() => {
    const filtered = selectedCategory
      ? items.filter(i => i.category_id === selectedCategory)
      : items
    return groupMenu(filtered, categories)
  }, [items, categories, selectedCategory])

  const toggleAvailability = async (variant) => {
    const newAvailable = !variant.available
    setItems(prev => prev.map(i => i.id === variant.id ? { ...i, available: newAvailable } : i))

    const { error } = await supabase
      .from('menu_items')
      .update({ available: newAvailable })
      .eq('id', variant.id)

    if (error) {
      setItems(prev => prev.map(i => i.id === variant.id ? { ...i, available: !newAvailable } : i))
      Alert.alert('Error', error.message)
    }
  }

  const deleteMenuItem = async (id) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) Alert.alert('Error', error.message)
  }

  const saveMenuItem = async ({ form, editingVariant, editingProduct, localImageUri }) => {
    let imageUrl = form.image_url

    if (localImageUri) {
      imageUrl = await uploadImage(localImageUri, 'menu-images')
    }

    if (editingVariant) {
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
        .eq('id', editingVariant.id)

      if (error) throw error

      // If name changed, update all siblings
      if (editingProduct && form.name.trim() !== editingProduct.name) {
        const siblingIds = editingProduct.variants
          .filter(v => v.id !== editingVariant.id)
          .map(v => v.id)
        if (siblingIds.length > 0) {
          await supabase.from('menu_items').update({ name: form.name.trim() }).in('id', siblingIds)
        }
      }

      // If image changed, update all siblings
      if (editingProduct && imageUrl !== editingProduct.image_url) {
        const siblingIds = editingProduct.variants
          .filter(v => v.id !== editingVariant.id)
          .map(v => v.id)
        if (siblingIds.length > 0) {
          await supabase.from('menu_items').update({ image_url: imageUrl }).in('id', siblingIds)
        }
      }
    } else {
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
        })

      if (error) throw error
    }
  }

  return {
    items,
    categories,
    loading,
    selectedCategory,
    setSelectedCategory,
    grouped,
    toggleAvailability,
    deleteMenuItem,
    saveMenuItem,
  }
}
