import { useState, useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/src/lib/supabase'

/**
 * Hook for managing inventory — fetches inventory rows joined with menu_items,
 * supports restock, threshold update, and tracking toggle.
 */
export function useInventory() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchInventory = useCallback(async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*, menu_items(id, name, size_label, category_id, image_url, status, categories(name))')
      .order('updated_at', { ascending: false })

    if (error) {
      console.warn('Failed to fetch inventory:', error.message)
    } else {
      setInventory(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInventory()

    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => fetchInventory(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchInventory])

  /**
   * Update stock count (restock or adjust).
   */
  const updateStock = async (inventoryId, newCount) => {
    const { error } = await supabase
      .from('inventory')
      .update({
        stock_count: newCount,
        last_restocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', inventoryId)

    if (error) {
      Alert.alert('Error', error.message)
      return { error: error.message }
    }
    return { error: null }
  }

  /**
   * Update the low stock threshold.
   */
  const updateThreshold = async (inventoryId, threshold) => {
    const { error } = await supabase
      .from('inventory')
      .update({ low_stock_threshold: threshold })
      .eq('id', inventoryId)

    if (error) {
      Alert.alert('Error', error.message)
      return { error: error.message }
    }
    return { error: null }
  }

  /**
   * Toggle inventory tracking on/off for an item.
   */
  const toggleTracking = async (inventoryId, enabled) => {
    const { error } = await supabase
      .from('inventory')
      .update({ track_inventory: enabled })
      .eq('id', inventoryId)

    if (error) {
      Alert.alert('Error', error.message)
      return { error: error.message }
    }
    return { error: null }
  }

  /**
   * Create an inventory entry for a menu item that doesn't have one.
   */
  const createInventoryEntry = async (menuItemId) => {
    const { error } = await supabase
      .from('inventory')
      .insert({ menu_item_id: menuItemId, stock_count: 0, track_inventory: false })

    if (error) {
      Alert.alert('Error', error.message)
      return { error: error.message }
    }
    return { error: null }
  }

  // Derived data
  const lowStockItems = inventory.filter(
    i => i.track_inventory && i.stock_count <= i.low_stock_threshold && i.stock_count > 0,
  )
  const outOfStockItems = inventory.filter(
    i => i.track_inventory && i.stock_count === 0,
  )
  const trackedItems = inventory.filter(i => i.track_inventory)

  return {
    inventory,
    loading,
    lowStockItems,
    outOfStockItems,
    trackedItems,
    updateStock,
    updateThreshold,
    toggleTracking,
    createInventoryEntry,
    refresh: fetchInventory,
  }
}
