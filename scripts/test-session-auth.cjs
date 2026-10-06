// Genuine installed-SDK Auth checks on the disposable LOCAL stack only. No .env or privileged client key.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')

const repoRoot = path.resolve(__dirname, '..')
const apiUrl = 'http://127.0.0.1:54321'
const ownerId = '11111111-1111-4111-8111-111111111111'
const cashierId = '22222222-2222-4222-8222-222222222222'
let currentCheck = 'local-only target guard'
let checks = 0
const clients = []

function check(condition, label) {
  currentCheck = label
  assert(condition, label)
  checks += 1
  console.log(`PASS ${label}`)
}

async function main() {
  assert.match(fs.readFileSync(path.join(repoRoot, 'supabase/config.toml'), 'utf8'), /project_id = "patanos-local"/)
  const cli = path.join(repoRoot, 'node_modules/supabase/dist/supabase.js')
  const status = JSON.parse(execFileSync(process.execPath, [cli, 'status', '--output', 'json'], {
    cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }))
  assert.equal(status.API_URL, apiUrl, 'refuse non-local Auth targets')
  const publicKey = status.ANON_KEY
  assert(publicKey)
  const storageKey = 'patanos-synthetic-auth-check'
  const makeClient = () => {
    const values = new Map([['patanos_offline_orders', '[{"id":"synthetic-pending-sale"}]'],
      ['patanos_dead_orders', '[{"id":"synthetic-held-sale"}]']])
    const client = createClient(apiUrl, publicKey, { auth: {
      storageKey, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false,
      storage: { getItem: async key => values.get(key) ?? null,
        setItem: async (key, value) => { values.set(key, value) }, removeItem: async key => { values.delete(key) } },
    }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000), redirect: 'error' }) } })
    clients.push(client)
    return { client, values }
  }
  const first = makeClient()
  const otherInstallation = makeClient()
  const cashier = makeClient()
  async function signIn(target, email, userId, label) {
    currentCheck = label
    const response = await target.client.auth.signInWithPassword({ email, password: 'Local-test-only-123!' })
    check(!response.error && response.data?.session?.user?.id === userId, label)
    return response.data.session
  }
  try {
    const firstSession = await signIn(first, 'admin@patanos.test', ownerId, 'real SDK owner password sign-in')
    await signIn(otherInstallation, 'admin@patanos.test', ownerId, 'separate owner session sign-in')
    await signIn(cashier, 'cashier@patanos.test', cashierId, 'separate cashier login retains its identity')
    check(first.values.has(storageKey), 'SDK persists its session under the specific configured key')
    const profile = await first.client.from('profiles').select('id,role,is_enabled').eq('id', ownerId).single()
    check(!profile.error && profile.data?.role === 'admin' && profile.data?.is_enabled === true, 'signed SDK resolves actual approved server profile')
    first.values.set(`${storageKey}-code-verifier`, 'synthetic-verifier')
    const result = await first.client.auth.signOut({ scope: 'local' })
    check(!result.error && !first.values.has(storageKey) && !first.values.has(`${storageKey}-code-verifier`),
      'local sign-out removes session and verifier keys')
    check(first.values.has('patanos_offline_orders') && first.values.has('patanos_dead_orders'),
      'SDK sign-out leaves unrelated synthetic pending/held order keys intact')
    const restored = await first.client.auth.getSession()
    check(!restored.error && restored.data.session === null, 'signed-out client cannot restore its former session')
    const refreshedOther = await otherInstallation.client.auth.refreshSession()
    check(!refreshedOther.error && refreshedOther.data?.session?.user?.id === ownerId, 'local sign-out does not revoke another SDK client refresh session')
    const refreshedFirst = await first.client.auth.refreshSession({ refresh_token: firstSession.refresh_token })
    check(Boolean(refreshedFirst.error) && !refreshedFirst.data?.session, 'signed-out session refresh credential is rejected')
    const oldJwtRead = await fetch(`${apiUrl}/rest/v1/inventory?select=stock_count`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${firstSession.access_token}` },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    check(oldJwtRead.status === 200, 'already-issued JWT remains usable until expiry: local logout is not server revocation')
  } finally {
    await Promise.all(clients.map(async client => {
      const result = await client.auth.signOut({ scope: 'local' })
      if (result.error) throw new Error('Synthetic session cleanup not confirmed')
    }))
  }
  console.log(`${checks} local installed-SDK/Auth checks passed. In-memory fixture storage is NOT native encryption/device evidence.`)
}
main().catch(() => {
  console.error(`FAIL ${currentCheck}. Check local fixtures/stack; no credentials or Auth responses printed.`)
  process.exitCode = 1
})
