import { describe, expect, jest, test, beforeEach } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { useSalesReports } from '@/src/hooks/useSalesReports'
import { supabase } from '@/src/lib/supabase'
import { useAuth } from '@/src/contexts/AuthContext'

jest.mock('@/src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: jest.fn() }))

const daily = [{ sale_date: '2026-10-05', total_orders: 2, total_revenue: '240', cash_sales: '120', gcash_sales: '120', takeout_count: 2 }]
const categories = [{ category_name: 'Drinks', items_sold: 2, revenue: '240' }]
function reportResults(dailyResult = { data: daily }, categoryResult = { data: categories }) {
  supabase.rpc.mockImplementation(name => ({ order: jest.fn().mockResolvedValue(
    name === 'owner_daily_sales' ? dailyResult : categoryResult,
  ) }))
}
beforeEach(() => {
  useAuth.mockReturnValue({ session: { user: { id: 'owner' } }, role: 'admin' })
  reportResults()
})

describe('owner report data boundary', () => {
  test('uses checked RPCs, preserving totals and inclusive date parameters', async () => {
    const { result } = renderHook(useSalesReports)
    await act(() => result.current.fetchSales('2026-10-01', '2026-10-05'))
    expect(supabase.rpc).toHaveBeenCalledWith('owner_daily_sales', { p_start_date: '2026-10-01', p_end_date: '2026-10-05' })
    expect(supabase.rpc).toHaveBeenCalledWith('owner_category_sales', { p_start_date: '2026-10-01', p_end_date: '2026-10-05' })
    expect(result.current.totals).toMatchObject({ orders: 2, revenue: 240, cash: 120, gcash: 120 })
    expect(result.current.avgOrderValue).toBe(120)
    expect(result.current.categoryTotals).toEqual([{ category_name: 'Drinks', items_sold: 2, revenue: 240 }])
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  test.each(['cashier', null])('does not request owner reports for role %s', async role => {
    useAuth.mockReturnValue({ session: { user: { id: 'staff' } }, role })
    const { result } = renderHook(useSalesReports)
    await act(() => result.current.fetchSales('2026-10-01', '2026-10-05'))
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(result.current.error).toMatch(/Owner access/)
    expect(result.current.dailySales).toEqual([])
  })

  test('clears stale totals after one RPC fails, without exposing raw backend messages', async () => {
    const { result } = renderHook(useSalesReports)
    await act(() => result.current.fetchSales('2026-10-01', '2026-10-05'))
    reportResults({ data: null, error: { message: 'sensitive backend detail' } })
    await act(() => result.current.fetchSales('2026-10-01', '2026-10-05'))
    expect(result.current.dailySales).toEqual([])
    expect(result.current.categorySales).toEqual([])
    expect(result.current.totals.revenue).toBe(0)
    expect(result.current.error).toMatch(/Unable to load/)
    expect(result.current.error).not.toContain('sensitive')
  })

  test('handles a thrown network failure and allows retry', async () => {
    supabase.rpc.mockImplementation(() => { throw new Error('Network unavailable') })
    const { result } = renderHook(useSalesReports)
    await act(() => result.current.fetchSales('2026-10-01', '2026-10-05'))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toMatch(/Unable to load/)
    reportResults()
    await act(() => result.current.fetchSales('2026-10-01', '2026-10-05'))
    expect(result.current.error).toBeNull()
    expect(result.current.totals.revenue).toBe(240)
  })

  test('clears privileged data on account switch and ignores in-flight owner responses', async () => {
    let resolveRequest
    const pending = new Promise(resolve => { resolveRequest = resolve })
    supabase.rpc.mockReturnValue({ order: () => pending })
    const { result, rerender } = renderHook(useSalesReports)
    let request
    act(() => { request = result.current.fetchSales('2026-10-01', '2026-10-05') })
    useAuth.mockReturnValue({ session: { user: { id: 'cashier' } }, role: 'cashier' })
    rerender()
    await act(async () => { resolveRequest({ data: daily }); await request })
    expect(result.current.dailySales).toEqual([])
    expect(result.current.categorySales).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  test('older date-range requests cannot overwrite newer results', async () => {
    const resolvers = []
    supabase.rpc.mockImplementation(() => ({ order: () => new Promise(resolve => resolvers.push(resolve)) }))
    const { result } = renderHook(useSalesReports)
    let older, newer
    act(() => { older = result.current.fetchSales('2026-10-01', '2026-10-01') })
    act(() => { newer = result.current.fetchSales('2026-10-05', '2026-10-05') })
    await act(async () => { resolvers[2]({ data: daily }); resolvers[3]({ data: categories }); await newer })
    await act(async () => { resolvers[0]({ data: [] }); resolvers[1]({ data: [] }); await older })
    expect(result.current.dailySales).toEqual(daily)
  })
})
