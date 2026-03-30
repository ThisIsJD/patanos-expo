import React, { createContext, useContext, useState } from 'react'

const CartContext = createContext({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  clearCart: () => {},
  total: 0,
})

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  const addItem = (menuItem, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === menuItem.id)
      if (existing) {
        return prev.map(i =>
          i.id === menuItem.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      }
      return [...prev, { ...menuItem, quantity }]
    })
  }

  const removeItem = (itemId) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  const clearCart = () => setItems([])

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
