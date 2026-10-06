import React from 'react'
import { describe, expect, jest, test } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import ModifierPicker from '@/src/components/pos/ModifierPicker'
import { drink, largeDrink, milk, shot } from '../fixtures/menu'

describe('modifier selection component', () => {
  test('replaces the earlier selection when max_select is one', () => {
    const onAdd = jest.fn()
    const screen = render(<ModifierPicker item={drink} visible onAdd={onAdd} onClose={jest.fn()}
      allItems={[drink, largeDrink]} allModifierGroups={[{
        id: 301, name: 'Extras', category_id: drink.category_id,
        min_select: 0, max_select: 1, modifiers: [milk, shot],
      }]} />)
    fireEvent.press(screen.getByText('Oat milk'))
    fireEvent.press(screen.getByText('Extra shot'))
    fireEvent.press(screen.getByText(/^Add /))
    expect(onAdd).toHaveBeenCalledWith(drink, [shot], 1)
  })
  test('selects the first available size instead of a sold-out size', () => {
    const onAdd = jest.fn()
    const screen = render(<ModifierPicker item={drink} visible onAdd={onAdd} onClose={jest.fn()}
      allItems={[{ ...drink, available: false }, largeDrink]} />)
    fireEvent.press(screen.getByText(/^Add /))
    expect(onAdd).toHaveBeenCalledWith(largeDrink, [], 1)
  })
})
