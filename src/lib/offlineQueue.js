import AsyncStorage from '@react-native-async-storage/async-storage'

const QUEUE_KEY = 'patanos_offline_orders'
let syncLock = false

/**
 * Offline order queue — stores orders in AsyncStorage when network is down,
 * and syncs them to Supabase when connectivity returns.
 */

export async function getQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function enqueue(order) {
  const queue = await getQueue()
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  queue.push({ ...order, id, queuedAt: new Date().toISOString() })
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  return queue.length
}

export async function dequeue(index) {
  const queue = await getQueue()
  queue.splice(index, 1)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY)
}

/**
 * Process all queued orders by calling the provided placeOrder function.
 * Uses a lock to prevent concurrent syncs across multiple hook instances.
 * Returns { synced: number, failed: number }.
 */
export async function syncQueue(placeOrderFn) {
  if (syncLock) return { synced: 0, failed: 0 }
  syncLock = true

  try {
    const queue = await getQueue()
    if (queue.length === 0) {
      syncLock = false
      return { synced: 0, failed: 0 }
    }

    let synced = 0
    let failed = 0
    const remaining = []

    for (const order of queue) {
      const { data, error } = await placeOrderFn(order)
      if (error) {
        remaining.push(order)
        failed++
      } else {
        synced++
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
    syncLock = false
    return { synced, failed }
  } catch (e) {
    syncLock = false
    throw e
  }
}
