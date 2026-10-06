import { describe, expect, test } from '@jest/globals'

const { renderReconciliation, readReconciliationSources } = require('../../scripts/render-reconciliation.cjs')

describe('reviewed local database reconstruction', () => {
  test('uses the confirmed development metadata without changing expressions/nullability', () => {
    const { supplement } = readReconciliationSources()
    expect(supplement.columns).toHaveLength(94)
    expect(supplement.columns.filter(column => column.identity_generation === 'ALWAYS')).toHaveLength(8)
    expect(supplement.columns.filter(column => column.formatted_type === 'numeric(10,2)')).toHaveLength(10)
  })

  test('renders a deterministic guarded local-only correction', () => {
    const migration = renderReconciliation()
    expect(migration).toBe(renderReconciliation())
    expect(migration).toContain('NOT approved for remote deployment')
    expect(migration).toContain('requires an empty sales database')
    expect(migration.match(/SET GENERATED ALWAYS;/g)).toHaveLength(8)
    expect(migration.match(/TYPE numeric\(10,2\);/g)).toHaveLength(9)
    expect(migration).toContain('"subtotal" numeric(10,2) GENERATED ALWAYS')
    expect(migration).not.toContain('9223372036854776000')
  })

  test('restores report views and explicitly retains the permission baseline, not P1 fixes', () => {
    const migration = renderReconciliation()
    expect(migration).toContain('CREATE VIEW public."category_sales"')
    expect(migration).toContain('CREATE VIEW public."daily_sales"')
    expect(migration).toContain('ON TABLE public."daily_sales" TO "anon"')
    expect(migration).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE "postgres"')
    expect(migration).not.toContain('ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"')
    expect(migration).toContain('supabase_admin default privileges remain managed by Supabase')
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.place_order')
  })

  test('adds only the seven captured Realtime members without replacing managed publications', () => {
    const migration = renderReconciliation()
    expect(migration.match(/ADD TABLE public\./g)).toHaveLength(7)
    expect(migration).toContain('ADD TABLE public."order_items"')
    expect(migration).toContain('ADD TABLE public."orders"')
    expect(migration).not.toContain('supabase_realtime_messages_publication')
    expect(migration).not.toContain('DROP PUBLICATION')
  })
})
