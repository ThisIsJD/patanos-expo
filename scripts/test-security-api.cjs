// Synthetic local Auth/PostgREST checks only; no .env, linked project or service key.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const apiUrl = 'http://127.0.0.1:54321'
const ownerId = '11111111-1111-4111-8111-111111111111'
const cashierId = '22222222-2222-4222-8222-222222222222'
let currentCheck = 'local CLI status and loopback-only target guard'

async function main() {
  assert.match(fs.readFileSync(path.join(repoRoot, 'supabase/config.toml'), 'utf8'), /project_id = "patanos-local"/)
  const cli = path.join(repoRoot, 'node_modules/supabase/dist/supabase.js')
  const status = JSON.parse(execFileSync(process.execPath, [cli, 'status', '--output', 'json'], {
    cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }))
  assert.equal(status.API_URL, apiUrl, 'refuse any non-local API target')
  const publicKey = status.ANON_KEY
  assert(publicKey, 'local public key must exist')
  let checks = 0

  async function request(endpoint, token, method = 'GET', body) {
    currentCheck = `local HTTP request: ${endpoint.split('?')[0]}`
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: publicKey, ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const raw = await response.text()
    return { status: response.status, data: raw ? JSON.parse(raw) : null }
  }
  function check(condition, label) {
    currentCheck = label
    assert(condition, label)
    checks += 1
    console.log(`PASS ${label}`)
  }
  function denied(result, label) {
    check([401, 403].includes(result.status) && result.data?.code === '42501', label)
  }
  async function login(email, expectedId) {
    const result = await request('/auth/v1/token?grant_type=password', null, 'POST', {
      email, password: 'Local-test-only-123!',
    })
    check(result.status === 200 && result.data?.user?.id === expectedId, `real local Auth login: ${email}`)
    return result.data.access_token
  }

  const ownerToken = await login('admin@patanos.test', ownerId)
  const cashierToken = await login('cashier@patanos.test', cashierId)
  const signup = await request('/auth/v1/signup', null, 'POST', {
    email: 'unauthorized-signup@patanos.test', password: 'Local-test-only-123!', data: { role: 'admin' },
  })
  check(signup.status === 422 && signup.data?.error_code === 'signup_disabled', 'email provider enabled but public signup remains disabled')
  const range = { p_start_date: '2000-01-01', p_end_date: '2100-01-01' }

  // Report checks run before attempted promotion, so a vulnerable promotion cannot mask them.
  for (const [identity, token] of [['anonymous', null], ['cashier', cashierToken], ['owner', ownerToken]]) {
    for (const report of ['daily_sales', 'category_sales']) {
      denied(await request(`/rest/v1/${report}?select=*`, token), `${identity} cannot read direct ${report} view`)
      const result = await request(`/rest/v1/rpc/owner_${report}`, token, 'POST', range)
      if (identity === 'owner') {
        check(result.status === 200 && Array.isArray(result.data), `owner can query ${report} RPC`)
      } else {
        denied(result, `${identity} cannot query ${report} RPC`)
      }
    }
  }
  denied(await request(`/rest/v1/profiles?id=eq.${cashierId}`, cashierToken, 'PATCH', { role: 'admin' }),
    'cashier cannot self-promote through a real API request')
  const profile = await request(`/rest/v1/profiles?id=eq.${cashierId}&select=role`, cashierToken)
  check(profile.status === 200 && profile.data?.[0]?.role === 'cashier', 'failed self-promotion leaves role unchanged')
  const metadata = await request('/auth/v1/user', cashierToken, 'PUT', { data: { role: 'admin' } })
  check(metadata.status === 200, 'synthetic user can edit untrusted Auth metadata')
  const unchangedRole = await request(`/rest/v1/profiles?id=eq.${cashierId}&select=role`, cashierToken)
  check(unchangedRole.data?.[0]?.role === 'cashier', 'untrusted Auth metadata cannot promote server-stored staff role')
  for (const [identity, token] of [['anonymous', null], ['cashier', cashierToken]]) {
    denied(await request('/rest/v1/rpc/set_staff_role', token, 'POST', { p_user_id: cashierId, p_role: 'admin' }),
      `${identity} cannot assign staff roles`)
  }
  const noOp = await request('/rest/v1/rpc/set_staff_role', ownerToken, 'POST', { p_user_id: cashierId, p_role: 'cashier' })
  check(noOp.status === 200 && noOp.data?.role === 'cashier', 'owner-controlled role path accepts an authorized no-op')
  denied(await request('/rest/v1/rpc/set_staff_role', ownerToken, 'POST', { p_user_id: ownerId, p_role: 'cashier' }),
    'last owner cannot be demoted')
  const invalidRange = await request('/rest/v1/rpc/owner_daily_sales', ownerToken, 'POST', {
    p_start_date: '2026-10-06', p_end_date: '2026-10-05',
  })
  check(invalidRange.status === 400 && invalidRange.data?.code === '22023', 'owner report rejects reversed dates')
  try {
    const promoted = await request('/rest/v1/rpc/set_staff_role', ownerToken, 'POST', { p_user_id: cashierId, p_role: 'admin' })
    check(promoted.status === 200 && promoted.data?.role === 'admin', 'owner can promote synthetic staff through real API')
    const promotedProfile = await request(`/rest/v1/profiles?id=eq.${cashierId}&select=role`, cashierToken)
    check(promotedProfile.data?.[0]?.role === 'admin', 'existing signed session resolves updated server role')
  } finally {
    const restored = await request('/rest/v1/rpc/set_staff_role', ownerToken, 'POST', { p_user_id: cashierId, p_role: 'cashier' })
    check(restored.status === 200 && restored.data?.role === 'cashier', 'owner restores synthetic cashier role')
  }
  denied(await request('/rest/v1/rpc/owner_daily_sales', cashierToken, 'POST', range),
    'demoted signed session immediately loses owner report access')

  const orderPayload = { p_order_type: 'takeout', p_subtotal: 265, p_total_amount: 265, p_notes: 'Synthetic API order',
    p_items: [
      { menu_item_id: 101, item_name: 'Untrusted name', quantity: 1, unit_price: 120, modifiers: [{ id: 201, modifier_name: 'Untrusted milk', extra_price: 0 }] },
      { menu_item_id: 101, quantity: 1, unit_price: 145, modifiers: [{ id: 202, extra_price: 25 }] },
    ] }
  for (const [identity, token] of [['anonymous', null], ['cashier', cashierToken], ['owner', ownerToken]]) {
    for (const relation of ['orders', 'order_items', 'order_item_modifiers']) {
      denied(await request(`/rest/v1/${relation}?id=eq.9999999`, token, 'PATCH', { created_at: '2000-01-01' }),
        `${identity} cannot directly mutate ${relation}`)
    }
  }
  denied(await request('/rest/v1/rpc/place_order', null, 'POST', orderPayload), 'anonymous cannot place an order')
  denied(await request('/rest/v1/rpc/complete_order', null, 'POST', { p_order_id: 1, p_payment_method: 'cash', p_amount_tendered: 500 }),
    'anonymous cannot complete an order')
  denied(await request('/rest/v1/rpc/cancel_order', null, 'POST', { p_order_id: 1, p_reason: 'Unauthorized' }),
    'anonymous cannot cancel an order')
  const forged = await request('/rest/v1/rpc/place_order', cashierToken, 'POST', { ...orderPayload, p_total_amount: 0 })
  check(forged.status === 400 && forged.data?.code === '22023', 'API rejects forged order total')
  const initialStock = await request('/rest/v1/inventory?menu_item_id=eq.101&select=stock_count', cashierToken)
  const stockBefore = initialStock.data?.[0]?.stock_count
  assert.equal(typeof stockBefore, 'number')
  const placed = await request('/rest/v1/rpc/place_order', cashierToken, 'POST', orderPayload)
  check(placed.status === 200 && placed.data?.created_by === cashierId && placed.data?.total_amount === 265, 'cashier API placement records authoritative totals and actor')
  const orderId = placed.data.id
  const soldStock = await request('/rest/v1/inventory?menu_item_id=eq.101&select=stock_count', cashierToken)
  check(soldStock.data?.[0]?.stock_count === stockBefore - 2, 'API placement consumes both portions')
  const cancelled = await request('/rest/v1/rpc/cancel_order', cashierToken, 'POST', { p_order_id: orderId, p_reason: 'Synthetic not-prepared cancellation', p_release_stock: true })
  check(cancelled.status === 200 && cancelled.data?.status === 'cancelled', 'cashier API can cancel an open unpaid order')
  const restoredStock = await request('/rest/v1/inventory?menu_item_id=eq.101&select=stock_count', cashierToken)
  check(restoredStock.data?.[0]?.stock_count === stockBefore, 'API cashier cancellation restores both same-variant lines without inventory grants')
  const repeatCancel = await request('/rest/v1/rpc/cancel_order', cashierToken, 'POST', { p_order_id: orderId, p_reason: 'Repeat' })
  check(repeatCancel.status >= 400 && repeatCancel.data?.code === '55000', 'API repeat cancellation cannot repeat stock restoration')
  const paymentOrder = await request('/rest/v1/rpc/place_order', ownerToken, 'POST', { p_order_type: 'dine-in', p_subtotal: 180, p_total_amount: 180,
    p_items: [{ menu_item_id: 103, quantity: 1, unit_price: 180 }] })
  check(paymentOrder.status === 200 && paymentOrder.data?.created_by === ownerId, 'owner can place an order through checked API')
  const paymentId = paymentOrder.data.id
  const payment = await request('/rest/v1/rpc/complete_order', cashierToken, 'POST', { p_order_id: paymentId, p_payment_method: 'cash', p_amount_tendered: 200 })
  check(payment.status === 200 && payment.data?.change_amount === 20, 'staff handoff payment derives change on server')
  const repeatPayment = await request('/rest/v1/rpc/complete_order', cashierToken, 'POST', { p_order_id: paymentId, p_payment_method: 'cash', p_amount_tendered: 500 })
  check(repeatPayment.status >= 400 && repeatPayment.data?.code === '55000', 'API repeat payment cannot overwrite completed sale')
  const paidCancel = await request('/rest/v1/rpc/cancel_order', ownerToken, 'POST', { p_order_id: paymentId, p_reason: 'No refund implementation' })
  check(paidCancel.status >= 400 && paidCancel.data?.code === '55000', 'even owner cannot use unpaid cancellation as a refund')

  const raceOrder = await request('/rest/v1/rpc/place_order', cashierToken, 'POST', { p_order_type: 'takeout', p_subtotal: 180, p_total_amount: 180,
    p_items: [{ menu_item_id: 103, quantity: 1, unit_price: 180 }] })
  check(raceOrder.status === 200, 'synthetic race order is created')
  const raceResults = await Promise.all([
    request('/rest/v1/rpc/complete_order', cashierToken, 'POST', { p_order_id: raceOrder.data.id, p_payment_method: 'cash', p_amount_tendered: 200 }),
    request('/rest/v1/rpc/cancel_order', ownerToken, 'POST', { p_order_id: raceOrder.data.id, p_reason: 'Synthetic concurrent cancellation' }),
  ])
  check(raceResults.filter(result => result.status === 200).length === 1
    && raceResults.filter(result => result.data?.code === '55000').length === 1, 'concurrent payment/cancellation permits exactly one terminal transition')
  const stockForRace = await request('/rest/v1/inventory?menu_item_id=eq.103&select=stock_count', cashierToken)
  const availablePortions = stockForRace.data?.[0]?.stock_count
  check(availablePortions === 10, 'payment or default unknown-preparation cancellation both retain consumed portions')
  assert(Number.isInteger(availablePortions) && availablePortions > 0 && availablePortions <= 100)
  const stockPayload = { p_order_type: 'takeout', p_subtotal: availablePortions * 180, p_total_amount: availablePortions * 180,
    p_items: [{ menu_item_id: 103, quantity: availablePortions, unit_price: 180 }] }
  const competingOrders = await Promise.all([
    request('/rest/v1/rpc/place_order', cashierToken, 'POST', stockPayload),
    request('/rest/v1/rpc/place_order', ownerToken, 'POST', stockPayload),
  ])
  check(competingOrders.filter(result => result.status === 200).length === 1
    && competingOrders.filter(result => result.data?.code === '23514').length === 1, 'concurrent orders cannot both consume the same last portions')
  const depleted = await request('/rest/v1/inventory?menu_item_id=eq.103&select=stock_count', cashierToken)
  check(depleted.data?.[0]?.stock_count === 0, 'competing sale failure leaves zero stock, not negative or duplicated effects')
  const acceptedOrder = competingOrders.find(result => result.status === 200)
  const released = await request('/rest/v1/rpc/cancel_order', ownerToken, 'POST', { p_order_id: acceptedOrder.data.id, p_reason: 'Synthetic concurrency cleanup', p_release_stock: true })
  check(released.status === 200, 'owner releases accepted synthetic unpaid order')
  const stockAfterRace = await request('/rest/v1/inventory?menu_item_id=eq.103&select=stock_count', cashierToken)
  check(stockAfterRace.data?.[0]?.stock_count === availablePortions, 'only accepted concurrent sale portions are restored')
  denied(await request(`/rest/v1/profiles?id=eq.${cashierId}`, cashierToken, 'PATCH', { is_enabled: true }),
    'cashier cannot bypass approval through profile PATCH')
  denied(await request('/rest/v1/rpc/approve_staff', cashierToken, 'POST', {
    p_user_id: cashierId, p_role: 'admin', p_reason: 'Unauthorized approval',
  }), 'cashier cannot approve staff through API')
  try {
    const disabled = await request('/rest/v1/rpc/set_staff_enabled', ownerToken, 'POST', {
      p_user_id: cashierId, p_enabled: false, p_reason: 'Synthetic disabled-session test',
    })
    check(disabled.status === 200 && disabled.data?.is_enabled === false, 'owner disables cashier through checked API')
    const disabledRole = await request('/rest/v1/rpc/get_user_role', cashierToken, 'POST', {})
    check(disabledRole.status === 200 && disabledRole.data === null, 'existing JWT loses server role immediately')
    for (const relation of ['categories', 'gallery_photos', 'inventory', 'menu_items', 'modifier_groups',
      'modifiers', 'orders', 'order_items', 'order_item_modifiers']) {
      const result = await request(`/rest/v1/${relation}?select=*`, cashierToken)
      check(result.status === 200 && Array.isArray(result.data) && result.data.length === 0,
        `disabled existing JWT cannot read ${relation}`)
    }
    const ownDisabledProfile = await request(`/rest/v1/profiles?select=id,is_enabled`, cashierToken)
    check(ownDisabledProfile.data?.length === 1 && ownDisabledProfile.data[0].id === cashierId
      && ownDisabledProfile.data[0].is_enabled === false, 'disabled session sees only its own approval state')
    denied(await request('/rest/v1/rpc/place_order', cashierToken, 'POST', orderPayload), 'disabled session cannot submit a sale')
    denied(await request('/rest/v1/rpc/complete_order', cashierToken, 'POST', { p_order_id: paymentId, p_payment_method: 'cash', p_amount_tendered: 200 }),
      'disabled session cannot submit payment')
    denied(await request('/rest/v1/rpc/cancel_order', cashierToken, 'POST', { p_order_id: orderId, p_reason: 'Disabled attempt' }),
      'disabled session cannot cancel an order')
  } finally {
    const enabled = await request('/rest/v1/rpc/approve_staff', ownerToken, 'POST', {
      p_user_id: cashierId, p_role: 'cashier', p_reason: 'Restore synthetic test account',
    })
    check(enabled.status === 200 && enabled.data?.is_enabled === true && enabled.data?.role === 'cashier',
      'owner atomically approves role and restores synthetic cashier')
  }
  try {
    const secondOwner = await request('/rest/v1/rpc/approve_staff', ownerToken, 'POST', {
      p_user_id: cashierId, p_role: 'admin', p_reason: 'Synthetic concurrent owner test',
    })
    check(secondOwner.status === 200, 'owner prepares second active synthetic owner')
    const competingDisables = await Promise.all([
      request('/rest/v1/rpc/set_staff_enabled', ownerToken, 'POST', { p_user_id: ownerId, p_enabled: false, p_reason: 'Synthetic simultaneous disable' }),
      request('/rest/v1/rpc/set_staff_enabled', cashierToken, 'POST', { p_user_id: cashierId, p_enabled: false, p_reason: 'Synthetic simultaneous disable' }),
    ])
    check(competingDisables.filter(result => result.status === 200).length === 1
      && competingDisables.filter(result => result.data?.code === '42501').length === 1,
    'simultaneous owner disabling leaves exactly one active owner')
  } finally {
    const roles = await Promise.all([ownerToken, cashierToken].map(token => request('/rest/v1/rpc/get_user_role', token, 'POST', {})))
    const survivingToken = roles[0].data === 'admin' ? ownerToken : roles[1].data === 'admin' ? cashierToken : null
    assert(survivingToken, 'at least one active owner must survive')
    const restoredOwner = await request('/rest/v1/rpc/approve_staff', survivingToken, 'POST', {
      p_user_id: ownerId, p_role: 'admin', p_reason: 'Restore synthetic owner after race',
    })
    check(restoredOwner.status === 200 && restoredOwner.data?.is_enabled === true, 'surviving owner restores original owner')
    const restoredCashier = await request('/rest/v1/rpc/approve_staff', ownerToken, 'POST', {
      p_user_id: cashierId, p_role: 'cashier', p_reason: 'Restore synthetic cashier after race',
    })
    check(restoredCashier.status === 200 && restoredCashier.data?.is_enabled === true, 'owner restores original cashier role and approval')
  }
  console.log(`${checks} local HTTP/Auth security checks passed; no remote target or privileged client credential used.`)
}

main().catch(() => {
  // Never print CLI/status/Auth payloads, tokens or request headers on failure.
  console.error(`FAIL ${currentCheck}. Verify the local stack, synthetic fixtures and migration revision. No credentials printed.`)
  process.exitCode = 1
})
