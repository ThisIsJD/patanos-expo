import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '@/src/lib/supabase'
import { useAuth } from '@/src/contexts/AuthContext'

/**
 * Owner-only reports; database RPCs enforce authorization independently of the UI.
 */
export function useSalesReports() {
  const { session, role } = useAuth()
  const [dailySales, setDailySales] = useState([])
  const [categorySales, setCategorySales] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reportIdentity, setReportIdentity] = useState(null)
  const requestVersion = useRef(0)
  const identity = `${session?.user?.id ?? ''}:${role ?? ''}`
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity

  useEffect(() => {
    requestVersion.current += 1
    setDailySales([])
    setCategorySales([])
    setError(null)
    setLoading(false)
    return () => { requestVersion.current += 1 }
  }, [identity])

  /**
   * Fetch sales data for a date range.
   * @param {string} startDate — ISO date string (YYYY-MM-DD)
   * @param {string} endDate — ISO date string (YYYY-MM-DD)
   */
  const fetchSales = useCallback(async (startDate, endDate) => {
    const version = ++requestVersion.current
    if (!session?.user?.id || role !== 'admin') {
      setDailySales([])
      setCategorySales([])
      setError('Owner access is required for sales reports.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = { p_start_date: startDate, p_end_date: endDate }
      const [dailyRes, categoryRes] = await Promise.all([
        supabase.rpc('owner_daily_sales', params).order('sale_date', { ascending: false }),
        supabase.rpc('owner_category_sales', params).order('revenue', { ascending: false }),
      ])
      if (version !== requestVersion.current || identity !== currentIdentity.current) return
      if (dailyRes.error || categoryRes.error) throw new Error('Report request failed')
      setDailySales(dailyRes.data ?? [])
      setCategorySales(categoryRes.data ?? [])
      setReportIdentity(identity)
    } catch {
      if (version !== requestVersion.current || identity !== currentIdentity.current) return
      // Never retain an earlier owner's totals after a denied or failed refresh.
      setDailySales([])
      setCategorySales([])
      setError('Unable to load sales reports. Check your connection and owner access, then retry.')
    } finally {
      if (version === requestVersion.current && identity === currentIdentity.current) setLoading(false)
    }
  }, [identity, role, session?.user?.id])

  // Mask data during the account-switch render, before effects have cleared state.
  const canShowReports = role === 'admin' && session?.user?.id && reportIdentity === identity
  const visibleDailySales = canShowReports ? dailySales : []
  const visibleCategorySales = canShowReports ? categorySales : []

  // Aggregate totals across the date range
  const totals = visibleDailySales.reduce(
    (acc, day) => ({
      orders: acc.orders + (day.total_orders || 0),
      revenue: acc.revenue + parseFloat(day.total_revenue || 0),
      cash: acc.cash + parseFloat(day.cash_sales || 0),
      gcash: acc.gcash + parseFloat(day.gcash_sales || 0),
      dineIn: acc.dineIn + (day.dinein_count || 0),
      takeout: acc.takeout + (day.takeout_count || 0),
      delivery: acc.delivery + (day.delivery_count || 0),
    }),
    { orders: 0, revenue: 0, cash: 0, gcash: 0, dineIn: 0, takeout: 0, delivery: 0 },
  )

  const avgOrderValue = totals.orders > 0
    ? totals.revenue / totals.orders
    : 0

  // Group category sales across the date range
  const categoryTotals = visibleCategorySales.reduce((acc, row) => {
    const existing = acc.find(c => c.category_name === row.category_name)
    if (existing) {
      existing.items_sold += row.items_sold || 0
      existing.revenue += parseFloat(row.revenue || 0)
    } else {
      acc.push({
        category_name: row.category_name,
        items_sold: row.items_sold || 0,
        revenue: parseFloat(row.revenue || 0),
      })
    }
    return acc
  }, []).sort((a, b) => b.revenue - a.revenue)

  return {
    dailySales: visibleDailySales,
    categorySales: visibleCategorySales,
    categoryTotals,
    totals,
    avgOrderValue,
    loading,
    error,
    fetchSales,
  }
}
