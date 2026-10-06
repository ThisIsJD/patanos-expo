export const drink = {
  id: 101, name: 'Test Iced Latte', category_id: 'test-drinks',
  price: '120.00', size_label: 'Regular', status: 'published', available: true,
}

export const largeDrink = { ...drink, id: 102, price: '150.00', size_label: 'Large' }
export const milk = { id: 201, name: 'Oat milk', extra_price: '25.00', available: true }
export const shot = { id: 202, name: 'Extra shot', extra_price: '20.00', available: true }

export const order = {
  orderType: 'takeout', subtotal: 145,
  items: [{ menu_item_id: 101, item_name: drink.name, quantity: 1, unit_price: 145,
    modifiers: [{ id: milk.id, modifier_name: milk.name, extra_price: 25 }], notes: 'Less ice' }],
}
