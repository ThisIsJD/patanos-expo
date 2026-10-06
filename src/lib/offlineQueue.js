import AsyncStorage from '@react-native-async-storage/async-storage'

const QUEUE_KEY = 'patanos_offline_orders'
const DEAD_LETTER_KEY = 'patanos_dead_orders'
const MAX_RETRIES = 5
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
export async function syncQueue(placeOrderFn, { canContinue = () => true, canSubmit = () => true } = {}) {
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

    for (const [index, order] of queue.entries()) {
      // A lock/account change is not a failed sale: retain untouched records and retry counts.
      if (!canContinue()) { remaining.push(...queue.slice(index)); break }
      if (!canSubmit(order)) { remaining.push(order); continue }
      const { data, error } = await placeOrderFn(order)
      if (error) {
        const retries = (order._retryCount || 0) + 1
        if (retries >= MAX_RETRIES) {
          // Move to dead letter queue — stop retrying permanently bad orders
          const deadQueue = JSON.parse(await AsyncStorage.getItem(DEAD_LETTER_KEY) || '[]')
          deadQueue.push({ ...order, _retryCount: retries, _failedAt: new Date().toISOString(), _lastError: error })
          await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(deadQueue))
        } else {
          remaining.push({ ...order, _retryCount: retries })
        }
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

/**
 * Retrieve orders that failed too many times and were removed from the sync queue.
 */
export async function getDeadLetters() {
  const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function clearDeadLetters() {
  await AsyncStorage.removeItem(DEAD_LETTER_KEY)
}
