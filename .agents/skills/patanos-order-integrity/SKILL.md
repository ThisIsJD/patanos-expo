---
name: patanos-order-integrity
description: Implement or review Patanos cart, pricing, modifiers, order placement, offline queue and sync, payment, cancellation, or inventory behavior without losing, duplicating, or mispricing orders. Use whenever the POS transaction path changes.
---

# Patanos Order Integrity

Treat the order path as one distributed transaction workflow spanning React state, AsyncStorage, Supabase RPCs, and database triggers.

Read [references/order-flow.md](references/order-flow.md) before changing order behavior.

## Workflow

1. Trace the affected behavior through `CartContext`, `validateOrder`, `useOrders`, `offlineQueue`, and the known server RPC/triggers.
2. State the invariant being changed or protected and describe the failure case first.
3. Preserve online/offline payload parity unless the product requirement explicitly differs.
4. For a bug fix, create the smallest practical regression check or reproducible scenario before changing production logic. The repository has no automated test runner, so do not invent a passing test claim.
5. Make one focused change and verify both the direct path and its retry, cancellation, inventory, and UI-state consequences.

## Required invariants

- Validate order type, non-empty items, quantity, unit price, and subtotal before online submission and before offline enqueue.
- `unit_price` includes selected modifier prices. Do not add modifier prices again when calculating the subtotal.
- Preserve the server-side atomic `place_order` boundary for order, item, and modifier creation.
- Keep queue writes durable before presenting an offline order as accepted.
- Keep the active queue and dead-letter queue distinct. The current retry ceiling is five attempts.
- Preserve both the module-level sync lock and hook-level guard unless replacing them with a demonstrably safer design.
- Do not treat network reconnection as proof an RPC response was never committed. Analyze duplicate-order risk for retries, timeouts, and app restarts; the current client exposes no idempotency key.
- Refresh remote orders before clearing their queued representation when sync succeeds.
- Check inventory decrement on item creation and restoration on cancellation against current database triggers.
- Keep payment and cancellation state transitions explicit; do not silently coerce unsupported order or payment values.
- Preserve meaningful customer/order snapshots (`item_name`, `size_label`, modifier names/prices) even if menu records later change.

## Cross-skill routing

- Use `$patanos-supabase-change` when the RPC, schema, RLS, grants, trigger, Realtime, or storage boundary changes.
- Use `$patanos-expo-ui` when the transaction change materially affects screens, modals, or responsive interaction.
- Finish with `$patanos-verify` and report which online, offline, reconnection, payment, and cancellation paths were actually exercised.
