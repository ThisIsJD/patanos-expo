import { useState, useCallback, useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { supabase } from '@/src/lib/supabase'
import { useAuth } from '@/src/contexts/AuthContext'
import { useNetworkStatus } from '@/src/hooks/useNetworkStatus'
import { enqueue, getQueue, syncQueue } from '@/src/lib/offlineQueue'
import { validateOrder } from '@/src/utils/validateOrder'

export function useOrders() {
  const { session, canOperate, operationGuard, runStaffOperation } = useAuth()
  const { isOnline, onStatusChange } = useNetworkStatus()
  const [openOrders, setOpenOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [queuedOrders, setQueuedOrders] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [heldCount, setHeldCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const syncing = useRef(false)

  const todayStart = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }

  const fetchOrders = useCallback(async () => {
    const start = todayStart()

    const [openRes, completedRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*, order_item_modifiers(*))')
        .eq('status', 'open')
        .gte('created_at', start)
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*, order_items(*, order_item_modifiers(*))')
        .eq('status', 'completed')
        .gte('created_at', start)
        .order('completed_at', { ascending: false })
        .limit(50),
    ])

    if (openRes.data) setOpenOrders(openRes.data)
    if (completedRes.data) setCompletedOrders(completedRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  /**
   * Place a new order via Supabase RPC (atomic transaction).
   * All inserts (order + items + modifiers) happen in a single DB transaction.
   */
  const _placeOrderOnline = useCallback(async ({ items, orderType, subtotal, notes }) => {
    const userId = session?.user?.id
    if (!userId) return { data: null, error: 'Not authenticated' }

    const validation = validateOrder({ items, orderType, subtotal })
    if (!validation.valid) return { data: null, error: validation.error }

    // Build items payload for the RPC function
    const rpcItems = items.map(item => ({
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      size_label: item.size_label,
      quantity: item.quantity,
      unit_price: item.unit_price,
      notes: item.notes || null,
      modifiers: (item.modifiers || []).map(m => ({
        id: m.id,
        modifier_name: m.modifier_name,
        extra_price: m.extra_price,
      })),
    }))

    return runStaffOperation(userId, async () => {
      const { data, error } = await supabase.rpc('place_order', {
        p_order_type: orderType,
        p_subtotal: subtotal,
        p_total_amount: subtotal,
        p_notes: notes || null,
        p_items: rpcItems,
      })

      if (error) return { data: null, error: error.message }
      return { data, error: null }
    })
  }, [runStaffOperation, session?.user?.id])

  /**
   * Place order — queues locally if offline, otherwise sends to Supabase.
   */
  const placeOrder = async ({ items, orderType, subtotal, notes }) => {
    const userId = session?.user?.id
    if (!canOperate(userId)) return { data: null, error: 'Unlock this staff account before changing orders.' }
    // Validate before online insert OR offline queue
    const validation = validateOrder({ items, orderType, subtotal })
    if (!validation.valid) return { data: null, error: validation.error }

    if (isOnline) {
      return _placeOrderOnline({ items, orderType, subtotal, notes })
    }

    // Offline — queue locally
    return runStaffOperation(userId, async () => {
      const count = await enqueue({ items, orderType, subtotal, notes, staffUserId: userId })
      setPendingCount(count)
      await refreshQueuedOrders()
      return {
        data: { order_number: `Q${count}`, offline: true },
        error: null,
      }
    })
  }

  // Load queued orders from AsyncStorage
  const refreshQueuedOrders = useCallback(async () => {
    const queue = await getQueue()
    setPendingCount(queue.length)
    setHeldCount(queue.filter(record => record.staffUserId !== session?.user?.id).length)
    // Convert queue items to a shape similar to real orders for display
    // Unowned legacy/other-account records are held, not shown as the current cashier's sales.
    setQueuedOrders(queue.filter(record => record.staffUserId === session?.user?.id).map((q, idx) => ({
      id: q.id,
      order_number: `Q${idx + 1}`,
      offline: true,
      order_type: q.orderType,
      total_amount: q.subtotal,
      created_at: q.queuedAt,
      status: 'queued',
      order_items: q.items.map(item => ({
        id: item.cartId,
        item_name: item.item_name,
        size_label: item.size_label,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes,
        order_item_modifiers: (item.modifiers || []).map(m => ({
          id: m.id,
          modifier_name: m.modifier_name,
          extra_price: m.extra_price,
        })),
      })),
    })))
  }, [session?.user?.id])

  // Refresh pending count and queued orders on mount
  useEffect(() => {
    refreshQueuedOrders()
  }, [refreshQueuedOrders])

  // Auto-sync queued orders when coming back online
  const trySyncQueue = useCallback(async () => {
    const userId = session?.user?.id
    if (syncing.current || !canOperate(userId)) return
    const canContinue = operationGuard(userId)
    syncing.current = true
    try {
      const queue = await getQueue()
      if (!canContinue()) return
      if (queue.length === 0) {
        syncing.current = false
        await refreshQueuedOrders()
        return
      }
      const { synced, failed } = await syncQueue(_placeOrderOnline, {
        canContinue, canSubmit: queued => queued.staffUserId === userId,
      })
      if (synced > 0) {
        await fetchOrders()          // populate openOrders FIRST
        await refreshQueuedOrders()  // THEN clear queuedOrders display
        Alert.alert(
          'Orders Synced',
          `${synced} offline order${synced > 1 ? 's' : ''} synced successfully.${failed > 0 ? ` ${failed} failed and will retry.` : ''}`,
        )
      } else {
        await refreshQueuedOrders()
      }
    } catch {
      // Keep payloads out of logs; a lost acknowledgement still needs P2 replay protection.
      console.warn('Queue sync could not be confirmed.')
    } finally { syncing.current = false }
  }, [session?.user?.id, canOperate, operationGuard, _placeOrderOnline, fetchOrders, refreshQueuedOrders])

  // Only trigger sync from onStatusChange (single listener, no duplication)
  useEffect(() => {
    return onStatusChange((online) => {
      if (online) trySyncQueue()
    })
  }, [onStatusChange, trySyncQueue])

  /**
   * Complete an order (collect payment).
   */
  const completeOrder = async ({ orderId, paymentMethod, amountTendered, paymentRef }) => {
    return runStaffOperation(session?.user?.id, async () => {
    try {
      const { data, error } = await supabase.rpc('complete_order', {
        p_order_id: orderId,
        p_payment_method: paymentMethod,
        p_amount_tendered: amountTendered ?? null,
        p_payment_ref: paymentRef || null,
      })
      if (error) {
        Alert.alert('Error', error.message)
        return { error: error.message }
      }
      if (!data?.id) throw new Error('Missing payment confirmation')
      return { data, error: null }
    } catch {
      const error = 'Unable to confirm payment. Refresh this order before trying again.'
      Alert.alert('Payment not confirmed', error)
      return { error }
    }
    })
  }

  /**
   * Cancel an order.
   */
  const cancelOrder = async (orderId, reason = '', releaseStock = false) => {
    return runStaffOperation(session?.user?.id, async () => {
    try {
      const { data, error } = await supabase.rpc('cancel_order', {
        p_order_id: orderId, p_reason: reason, p_release_stock: releaseStock,
      })
      if (error) {
        Alert.alert('Error', error.message)
        return { error: error.message }
      }
      if (!data?.id) throw new Error('Missing cancellation confirmation')
      return { data, error: null }
    } catch {
      const error = 'Unable to confirm cancellation. Refresh this order before trying again.'
      Alert.alert('Cancellation not confirmed', error)
      return { error }
    }
    })
  }

  const refresh = useCallback(async () => {
    await Promise.all([fetchOrders(), refreshQueuedOrders()])
  }, [fetchOrders, refreshQueuedOrders])

  return {
    openOrders,
    completedOrders,
    queuedOrders,
    loading,
    isOnline,
    pendingCount,
    heldCount,
    placeOrder,
    completeOrder,
    cancelOrder,
    refresh,
    syncNow: trySyncQueue,
  }
}
