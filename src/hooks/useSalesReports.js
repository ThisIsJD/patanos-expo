import { useState, useCallback } from 'react'
import { supabase } from '@/src/lib/supabase'

/**
 * Hook for fetching sales report data from daily_sales and category_sales views.
 */
export function useSalesReports() {
  const [dailySales, setDailySales] = useState([])
  const [categorySales, setCategorySales] = useState([])
  const [loading, setLoading] = useState(false)

  /**
   * Fetch sales data for a date range.
   * @param {string} startDate — ISO date string (YYYY-MM-DD)
   * @param {string} endDate — ISO date string (YYYY-MM-DD)
   */
  const fetchSales = useCallback(async (startDate, endDate) => {
    setLoading(true)

    const [dailyRes, categoryRes] = await Promise.all([
      supabase
        .from('daily_sales')
        .select('*')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false }),
      supabase
        .from('category_sales')
        .select('*')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('revenue', { ascending: false }),
    ])

    if (dailyRes.data) setDailySales(dailyRes.data)
    if (categoryRes.data) setCategorySales(categoryRes.data)
    setLoading(false)
  }, [])

  // Aggregate totals across the date range
  const totals = dailySales.reduce(
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
  const categoryTotals = categorySales.reduce((acc, row) => {
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
    dailySales,
    categorySales,
    categoryTotals,
    totals,
    avgOrderValue,
    loading,
    fetchSales,
  }
}
