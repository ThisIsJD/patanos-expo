import { describe, expect, test } from '@jest/globals'

const fs = require('node:fs')
const { renderStagingAccess } = require('../../scripts/render-staging-access.cjs')

describe('controlled staging fixture access specification', () => {
  test('matches deterministic executable SQL with a guarded transaction', () => {
    const sql = renderStagingAccess()
    expect(fs.readFileSync('supabase/staging/controlled-access.sql', 'utf8').replaceAll('\r\n', '\n')).toBe(sql)
    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1)
    expect(sql).toContain('exactly two approved confirmed users and no sales')
    expect(sql).not.toMatch(/encrypted_password|Local-test-only|service_role.*KEY/i)
  })
  test('fences every table, bypass-capable RPC, views and storage', () => {
    const sql = renderStagingAccess()
    expect(sql.match(/CREATE POLICY p0_staging_allowlist ON public\./g)).toHaveLength(10)
    expect(sql).toContain("RAISE EXCEPTION 'Staging staff access not approved'")
    expect(sql).toContain("SECURITY DEFINER SET search_path = ''")
    expect(sql.match(/SET \(security_invoker = true\)/g)).toHaveLength(2)
    expect(sql).toContain('p0_staging_storage_allowlist ON storage.objects')
    expect(sql).not.toMatch(/GRANT.*TO anon;/)
    expect(sql).not.toMatch(/GRANT.*TRUNCATE/)
    expect(sql).toContain('NOT the P1 production authorization/payment/inventory fixes')
  })
})
