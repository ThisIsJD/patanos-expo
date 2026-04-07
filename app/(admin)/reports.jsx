import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, SPACING, RADIUS } from '@/src/constants/theme'
import { formatPrice } from '@/src/utils/formatPrice'
import { useSalesReports } from '@/src/hooks/useSalesReports'

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

function BarChart({ data, maxValue }) {
  if (data.length === 0) return null
  const max = maxValue || Math.max(...data.map(d => d.value), 1)

  return (
    <View style={styles.chartContainer}>
      {data.map((d, i) => (
        <View key={i} style={styles.barGroup}>
          <Text style={styles.barValue}>{formatPrice(d.value)}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { height: `${Math.max((d.value / max) * 100, 2)}%` },
              ]}
            />
          </View>
          <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
        </View>
      ))}
    </View>
  )
}

export default function ReportsScreen() {
  const { dailySales, categoryTotals, totals, avgOrderValue, loading, fetchSales } = useSalesReports()

  // Date range state
  const [range, setRange] = useState('today') // 'today' | 'week' | 'month'

  const dateRange = useMemo(() => {
    const now = new Date()
    const end = toDateStr(now)
    let start

    switch (range) {
      case 'today':
        start = end
        break
      case 'week': {
        const d = new Date(now)
        d.setDate(d.getDate() - 6)
        start = toDateStr(d)
        break
      }
      case 'month': {
        const d = new Date(now)
        d.setDate(d.getDate() - 29)
        start = toDateStr(d)
        break
      }
      default:
        start = end
    }
    return { start, end }
  }, [range])

  useEffect(() => {
    fetchSales(dateRange.start, dateRange.end)
  }, [dateRange, fetchSales])

  // Prepare bar chart data from dailySales
  const chartData = useMemo(() => {
    return [...dailySales]
      .sort((a, b) => a.sale_date.localeCompare(b.sale_date))
      .slice(-7) // max 7 bars
      .map(d => ({
        label: new Date(d.sale_date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        value: parseFloat(d.total_revenue || 0),
      }))
  }, [dailySales])

  const cashPct = totals.revenue > 0
    ? Math.round((totals.cash / totals.revenue) * 100)
    : 0
  const gcashPct = totals.revenue > 0 ? 100 - cashPct : 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Range filter */}
      <View style={styles.rangeRow}>
        {[
          { key: 'today', label: 'Today' },
          { key: 'week', label: 'Last 7 days' },
          { key: 'month', label: 'Last 30 days' },
        ].map(r => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangeTab, range === r.key && styles.rangeTabActive]}
            onPress={() => setRange(r.key)}>
            <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.accentGold} style={{ paddingTop: 60 }} />
      ) : (
        <>
          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <SummaryCard
              icon="cash-outline"
              label="Revenue"
              value={formatPrice(totals.revenue)}
              color={COLORS.success}
            />
            <SummaryCard
              icon="receipt-outline"
              label="Orders"
              value={String(totals.orders)}
              color={COLORS.accentGold}
            />
            <SummaryCard
              icon="trending-up-outline"
              label="Avg Order"
              value={formatPrice(avgOrderValue)}
              color={COLORS.info}
            />
          </View>

          {/* Revenue chart */}
          {chartData.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Revenue</Text>
              <BarChart data={chartData} />
            </View>
          )}

          {/* Payment breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
            <View style={styles.paymentRow}>
              <View style={styles.paymentItem}>
                <View style={[styles.paymentDot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.paymentLabel}>Cash</Text>
                <Text style={styles.paymentValue}>{formatPrice(totals.cash)}</Text>
                <Text style={styles.paymentPct}>{cashPct}%</Text>
              </View>
              <View style={styles.paymentItem}>
                <View style={[styles.paymentDot, { backgroundColor: COLORS.info }]} />
                <Text style={styles.paymentLabel}>GCash</Text>
                <Text style={styles.paymentValue}>{formatPrice(totals.gcash)}</Text>
                <Text style={styles.paymentPct}>{gcashPct}%</Text>
              </View>
            </View>
            {/* Simple progress bar */}
            {totals.revenue > 0 && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { flex: cashPct, backgroundColor: COLORS.success }]} />
                <View style={[styles.progressFill, { flex: gcashPct || 0.01, backgroundColor: COLORS.info }]} />
              </View>
            )}
          </View>

          {/* Order type breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Types</Text>
            <View style={styles.paymentRow}>
              <View style={styles.paymentItem}>
                <Ionicons name="restaurant-outline" size={16} color={COLORS.accentGold} />
                <Text style={styles.paymentLabel}>Dine-in</Text>
                <Text style={styles.paymentValue}>{totals.dineIn}</Text>
              </View>
              <View style={styles.paymentItem}>
                <Ionicons name="bag-handle-outline" size={16} color={COLORS.accentGold} />
                <Text style={styles.paymentLabel}>Takeout</Text>
                <Text style={styles.paymentValue}>{totals.takeout}</Text>
              </View>
              <View style={styles.paymentItem}>
                <Ionicons name="bicycle-outline" size={16} color={COLORS.accentGold} />
                <Text style={styles.paymentLabel}>Delivery</Text>
                <Text style={styles.paymentValue}>{totals.delivery}</Text>
              </View>
            </View>
          </View>

          {/* Category breakdown */}
          {categoryTotals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Categories</Text>
              {categoryTotals.map((cat, i) => (
                <View key={cat.category_name} style={styles.categoryRow}>
                  <Text style={styles.categoryRank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryName}>{cat.category_name}</Text>
                    <Text style={styles.categorySub}>{cat.items_sold} items sold</Text>
                  </View>
                  <Text style={styles.categoryRevenue}>{formatPrice(cat.revenue)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Daily breakdown table */}
          {dailySales.length > 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Breakdown</Text>
              {dailySales.map(day => (
                <View key={day.sale_date} style={styles.dayRow}>
                  <Text style={styles.dayDate}>
                    {new Date(day.sale_date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.dayOrders}>{day.total_orders} orders</Text>
                  <Text style={styles.dayRevenue}>{formatPrice(day.total_revenue)}</Text>
                </View>
              ))}
            </View>
          )}

          {totals.orders === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No sales data</Text>
              <Text style={styles.emptySub}>
                {range === 'today' ? 'No orders placed today yet' : 'No orders in this period'}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  rangeTabActive: {
    backgroundColor: COLORS.accentGoldSoft,
    borderColor: COLORS.accentGold,
  },
  rangeText: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
  rangeTextActive: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryValue: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 11,
  },
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 15,
    marginBottom: SPACING.md,
  },
  // Bar chart
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.xs,
    height: 140,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValue: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 9,
    marginBottom: 2,
  },
  barTrack: {
    width: '80%',
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: COLORS.accentGold,
    borderRadius: RADIUS.sm,
    minHeight: 2,
  },
  barLabel: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 10,
    marginTop: 4,
  },
  // Payment
  paymentRow: {
    gap: SPACING.sm,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  paymentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
    flex: 1,
  },
  paymentValue: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  paymentPct: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
    width: 36,
    textAlign: 'right',
  },
  progressBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  progressFill: {
    height: '100%',
  },
  // Categories
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  categoryRank: {
    color: COLORS.accentGold,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  categoryName: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 13,
  },
  categorySub: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 11,
    marginTop: 1,
  },
  categoryRevenue: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  // Daily table
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayDate: {
    color: COLORS.textSecondary,
    fontFamily: 'DMSans',
    fontSize: 13,
    flex: 1,
  },
  dayOrders: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 12,
    marginRight: SPACING.md,
  },
  dayRevenue: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 14,
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: SPACING.sm,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
  },
  emptySub: {
    color: COLORS.textMuted,
    fontFamily: 'DMSans',
    fontSize: 13,
  },
})
