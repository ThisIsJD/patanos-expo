import React from 'react'
import { describe, expect, jest, test, beforeEach } from '@jest/globals'
import { fireEvent, render } from '@testing-library/react-native'
import ReportsScreen from '@/app/(admin)/reports'
import { useSalesReports } from '@/src/hooks/useSalesReports'

jest.mock('@/src/hooks/useSalesReports', () => ({ useSalesReports: jest.fn() }))
const fetchSales = jest.fn()
beforeEach(() => {
  useSalesReports.mockReturnValue({ dailySales: [], categoryTotals: [],
    totals: { revenue: 0, orders: 0, cash: 0, gcash: 0, dineIn: 0, takeout: 0, delivery: 0 },
    avgOrderValue: 0, loading: false, error: null, fetchSales })
})

describe('report request states', () => {
  test('a denied or failed request shows an actionable error, not empty sales', () => {
    useSalesReports.mockReturnValue({ ...useSalesReports(), error: 'Unable to load sales reports.' })
    const screen = render(<ReportsScreen />)
    expect(screen.getByText('Reports unavailable')).toBeTruthy()
    expect(screen.queryByText('No sales data')).toBeNull()
    expect(screen.queryByText('Revenue')).toBeNull()
    fetchSales.mockClear()
    fireEvent.press(screen.getByRole('button', { name: 'Retry sales reports' }))
    expect(fetchSales).toHaveBeenCalledTimes(1)
  })
  test('a successful empty report retains the no-sales state', () => {
    const screen = render(<ReportsScreen />)
    expect(screen.getByText('No sales data')).toBeTruthy()
    expect(screen.queryByText('Reports unavailable')).toBeNull()
  })
})
