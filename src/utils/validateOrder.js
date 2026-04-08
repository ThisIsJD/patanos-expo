const VALID_ORDER_TYPES = ['dine-in', 'takeout', 'delivery']
const MAX_ITEM_PRICE = 50000 // ₱50,000 — sanity cap
const MAX_QUANTITY = 100

/**
 * Validates order data before insert (client-side).
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateOrder({ items, orderType, subtotal }) {
  if (!VALID_ORDER_TYPES.includes(orderType)) {
    return { valid: false, error: `Invalid order type: ${orderType}` }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Order must have at least one item' }
  }

  for (const item of items) {
    if (!item.item_name || typeof item.item_name !== 'string') {
      return { valid: false, error: 'Each item must have a name' }
    }
    if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      return { valid: false, error: `Invalid quantity for ${item.item_name}: ${item.quantity}` }
    }
    if (typeof item.unit_price !== 'number' || item.unit_price < 0 || item.unit_price > MAX_ITEM_PRICE) {
      return { valid: false, error: `Invalid price for ${item.item_name}: ${item.unit_price}` }
    }
  }

  if (typeof subtotal !== 'number' || subtotal < 0) {
    return { valid: false, error: 'Invalid subtotal' }
  }

  // Verify subtotal matches item totals (allow ₱1 rounding tolerance)
  const computed = items.reduce((sum, i) => {
    const itemBase = i.unit_price * i.quantity
    const modExtra = (i.modifiers || []).reduce((s, m) => s + (parseFloat(m.extra_price) || 0), 0) * i.quantity
    return sum + itemBase + modExtra
  }, 0)

  if (Math.abs(computed - subtotal) > 1) {
    return { valid: false, error: `Subtotal mismatch: expected ₱${computed.toFixed(2)}, got ₱${subtotal.toFixed(2)}` }
  }

  return { valid: true }
}
