import { describe, expect, test } from '@jest/globals'

const fs = require('node:fs')
const { renderStagingBootstrap, STAGING_REF } = require('../../scripts/render-staging-bootstrap.cjs')

describe('closed staging setup artifact, not live staff acceptance', () => {
  test('is deterministic and matches the reviewed executable file', () => {
    expect(STAGING_REF).toBe('omxoyujlteqcolqcdzxp')
    const sql = renderStagingBootstrap()
    expect(sql).toBe(renderStagingBootstrap())
    expect(fs.readFileSync('supabase/staging/closed-bootstrap.sql', 'utf8').replaceAll('\r\n', '\n')).toBe(sql)
    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1)
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1)
  })

  test('guards existing data and excludes local credentials and Auth fixtures', () => {
    const sql = renderStagingBootstrap()
    expect(sql).toContain('requires an empty project')
    expect(sql).toContain('OR EXISTS (SELECT 1 FROM auth.users)')
    expect(sql).toContain('OR EXISTS (SELECT 1 FROM storage.objects)')
    expect(sql).not.toMatch(/INSERT INTO auth\.(users|identities)/)
    expect(sql).not.toMatch(/Local-test-only|encrypted_password|9223372036854776000/)
    expect(sql).toContain('Test Chicken Rice')
    expect(sql).toContain('Test Iced Latte')
  })

  test('closes API grants last rather than claiming vulnerable baseline policies are fixed', () => {
    const sql = renderStagingBootstrap()
    const fence = sql.indexOf('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;')
    expect(fence).toBeGreaterThan(sql.lastIndexOf('GRANT '))
    expect(sql).toContain('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;')
    expect(sql).toContain('client_access_enabled boolean NOT NULL DEFAULT false')
    expect(sql).toContain('UPDATE storage.buckets SET public = false')
    expect(sql).not.toContain('ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"')
  })
})
