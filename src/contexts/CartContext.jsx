import React, { createContext, useContext, useReducer, useMemo } from 'react'

const CartContext = createContext(null)

// Each cart item has a unique cartId = `${menuItem.id}_${Date.now()}`
// so the same menu item with different modifiers gets separate rows.

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { item } = action
      // Check if an identical item exists (same menu_item_id + same modifiers)
      const modKey = (item.modifiers || []).map(m => m.id).sort().join(',')
      const existing = state.items.find(i => {
        const iModKey = (i.modifiers || []).map(m => m.id).sort().join(',')
        return i.menu_item_id === item.menu_item_id && iModKey === modKey
      })
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.cartId === existing.cartId
              ? { ...i, quantity: i.quantity + (item.quantity || 1) }
              : i
          ),
        }
      }
      return {
        ...state,
        items: [...state.items, { ...item, cartId: `${item.menu_item_id}_${Date.now()}` }],
      }
    }

    case 'UPDATE_QUANTITY': {
      const { cartId, quantity } = action
      if (quantity <= 0) {
        return { ...state, items: state.items.filter(i => i.cartId !== cartId) }
      }
      return {
        ...state,
        items: state.items.map(i =>
          i.cartId === cartId ? { ...i, quantity } : i
        ),
      }
    }

    case 'UPDATE_NOTE': {
      const { cartId, notes } = action
      return {
        ...state,
        items: state.items.map(i =>
          i.cartId === cartId ? { ...i, notes } : i
        ),
      }
    }

    case 'UPDATE_ITEM': {
      const { cartId, item } = action
      return {
        ...state,
        items: state.items.map(i =>
          i.cartId === cartId ? { ...item, cartId, notes: item.notes ?? i.notes ?? '' } : i,
        ),
      }
    }

    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.cartId !== action.cartId) }

    case 'SET_ORDER_TYPE':
      return { ...state, orderType: action.orderType }

    case 'CLEAR':
      return { ...state, items: [], orderType: 'dine-in' }

    default:
      return state
  }
}

const initialState = { items: [], orderType: 'dine-in' }

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  const addItem = (menuItem, modifiers = [], quantity = 1) => {
    const modifierTotal = modifiers.reduce((s, m) => s + (parseFloat(m.extra_price) || 0), 0)
    dispatch({
      type: 'ADD_ITEM',
      item: {
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        size_label: menuItem.size_label || null,
        unit_price: parseFloat(menuItem.price) + modifierTotal,
        base_price: parseFloat(menuItem.price),
        image_url: menuItem.image_url,
        modifiers: modifiers.map(m => ({
          id: m.id,
          modifier_name: m.name,
          extra_price: parseFloat(m.extra_price) || 0,
        })),
        quantity,
        notes: '',
      },
    })
  }

  const updateQuantity = (cartId, quantity) =>
    dispatch({ type: 'UPDATE_QUANTITY', cartId, quantity })

  const updateNote = (cartId, notes) =>
    dispatch({ type: 'UPDATE_NOTE', cartId, notes })

  const updateItem = (cartId, menuItem, modifiers = [], quantity = 1) => {
    const modifierTotal = modifiers.reduce((s, m) => s + (parseFloat(m.extra_price) || 0), 0)
    dispatch({
      type: 'UPDATE_ITEM',
      cartId,
      item: {
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        size_label: menuItem.size_label || null,
        unit_price: parseFloat(menuItem.price) + modifierTotal,
        base_price: parseFloat(menuItem.price),
        image_url: menuItem.image_url,
        modifiers: modifiers.map(m => ({
          id: m.id,
          modifier_name: m.name,
          extra_price: parseFloat(m.extra_price) || 0,
        })),
        quantity,
      },
    })
  }

  const removeItem = (cartId) =>
    dispatch({ type: 'REMOVE_ITEM', cartId })

  const setOrderType = (orderType) =>
    dispatch({ type: 'SET_ORDER_TYPE', orderType })

  const clearCart = () => dispatch({ type: 'CLEAR' })

  const subtotal = useMemo(
    () => state.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
    [state.items],
  )

  const itemCount = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items],
  )

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        orderType: state.orderType,
        subtotal,
        itemCount,
        addItem,
        updateQuantity,
        updateNote,
        updateItem,
        removeItem,
        setOrderType,
        clearCart,
      }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
