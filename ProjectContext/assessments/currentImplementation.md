# Patanos POS: Current Implementation and Cafe Readiness

Follow-up evidence (2026-10-04): [P0-02 database review](../evidence/P0-foundation.md#database-and-auth-review) reconciles a supplied version-2 export, including complete function bodies, and the owner-confirmed Auth baseline. It confirms the permission concerns, establishes that `place_order` rejects unauthenticated callers, and identifies additional stock-restoration/numbering defects. JWT expiry is one hour, CAPTCHA is disabled, and staff administration procedures do not yet exist. P0.1 evidence collection is complete; actual role/API/device tests and security/transaction fixes remain pending. The original assessment below remains the dated baseline, not a claim of deployment readiness.

Assessment completed: **2026-10-04**. Most code review and diagnostic commands were performed during the preceding review session. Repository status and lint were checked again on 2026-10-04, with no tracked application changes found and the same lint findings reproduced.

## 1. Current phase and overall verdict

**Patanos is a working MVP at the alpha / hardening stage, before a controlled cafe pilot. It is not yet ready to be the sole POS for a small cafe or for an unrestricted production deployment.**

An MVP is the first implementation of the main product features. Hardening means making those features dependable when internet connections fail, staff make mistakes, two devices act at once, or the app restarts.

The main cafe screens and data flows already exist. The remaining work is substantial because it concerns money, order preservation, permissions, daily reconciliation, and recovery. A screen being implemented does not mean the business process behind it is ready.

The most urgent findings are:

1. The saved database policies appear to allow a user to change their own role to admin. This is a critical policy defect in the snapshot; live exploitation was not attempted.
2. A locally reproduced offline queue race can erase an order added while a sync is running.
3. Order retries have no visible server idempotency key, so an uncertain network response can lead to duplicate orders and stock deductions.
4. Payments and cancellations do not enforce an expected current order status in the client mutation. The saved database update policy is also too broad.
5. Offline ordering is incomplete: queued orders cannot be paid or cancelled, and orders that reach the retry limit disappear from the ordinary queue display.
6. App dates and database dates disagree, creating a risk of hidden orders and incorrect daily sales grouping.
7. The configured web export fails. Android bundle export succeeds, but a signed, installed production app has not been verified.
8. Lint fails, and the dependency audit reports affected packages that need triage.

### Position in the development lifecycle

| Phase | Meaning | Current position |
| --- | --- | --- |
| 1. Product foundation | Choose the stack, structure, theme, and basic data model. | Established. |
| 2. MVP implementation | Build menu, cart, orders, payment entry, inventory, and reports. | Main paths implemented, with gaps. |
| 3. Hardening and integration verification | Secure permissions; prevent lost/duplicate orders; validate money, stock, and failure behavior. | **Current phase. Required work remains.** |
| 4. Controlled cafe pilot | Staff use real devices under supervision, with a reliable fallback and daily reconciliation. | Readiness not established. |
| 5. Production release | Install a verified release, secure the backend, document operations, and verify recovery. | Readiness not established. |
| 6. Routine operations | Monitor failures, maintain backups, support staff, and release updates safely. | Operating procedures not established in this repository. |

This is a readiness assessment, not a percentage-complete estimate. A single unresolved order-loss or authorization defect can prevent launch even when most screens are built.

### Readiness by area

| Area | Assessment | Practical meaning |
| --- | --- | --- |
| Basic functionality | Substantial MVP implementation | A basic drinks/meals order can be assembled and submitted through the intended flow. Real transaction behavior still needs verification. |
| Security | Blocking issues in saved metadata | Permissions cannot currently be accepted as safe for production. |
| Order and payment integrity | Needs hardening | Duplicate submission, concurrent status changes, and recovery need explicit protections. |
| Offline operation | Partial and unsafe to rely on | Local queuing exists, but dependable offline cafe operation is not established. |
| Inventory | Basic finished-item stock tracking | Useful for portions or packaged products; not ingredient/recipe inventory. |
| Reports and daily close | Partial | Sales summaries exist, but consistent business dates and cash reconciliation are missing. |
| Staff usability | Good foundation; device checks outstanding | Responsive POS layouts exist, with editing, error, accessibility, and navigation gaps. |
| Deployment | Configured, partly verified | Android assets/bytecode export succeeds; web static export fails; signed builds and installations were not checked. |
| Maintainability and quality control | Organized code, weak verification | Feature folders are clear, but lint fails and there is no automated test command or active CI workflow. |

## 2. Scope and evidence limits

The review covered all **45 first-party application source files in `app/` and `src/`, approximately 7,498 lines**, including routes, components, contexts, hooks, utilities, theme, and order infrastructure. It also examined package/build/lint configuration, tracked-file inventory, repository guidance, the metadata query, and the saved database metadata. Supporting agent/template folders were identified as development material, not POS functionality; their bundled third-party templates and document schemas are outside the application audit.

The stack is Expo SDK 54, React 19, React Native 0.81, Expo Router, Supabase, AsyncStorage, and NetInfo. Source is JavaScript/JSX, with feature-specific components and data hooks.

The database snapshot describes ten public application tables, two reporting views, 48 policies across public/storage, 11 triggers, 35 indexes, 42 constraints, and seven public function permission entries. This is evidence of a developed data model, not proof of secure or correct runtime behavior.

Important boundaries:

- **Live Supabase metadata was not refreshed.** All database findings below refer to [queryresults.json](../../queryresults.json). Its capture time is not recorded in the file.
- The snapshot contains function signatures, privileges, and trigger wiring, **not the complete function bodies**. Server pricing checks, authentication inside RPCs, stock locking, and cancellation restoration cannot be fully assessed from it.
- [database-review.sql](../../database-review.sql) is a read-only metadata query. It does not export function bodies, column-specific grants, bucket upload limits, or all production configuration needed for a complete security review.
- No real staff login, order creation, payment, cancellation, or stock mutation was performed against Supabase.
- No phone, tablet, emulator, browser interaction, printer, or cash drawer was exercised.
- No migration, deployment, dependency update, or production-code fix was performed. This assessment documents the current implementation.
- `.env` values were not read or printed. Export checks disabled dotenv loading and used dummy public configuration.

“Confirmed” below means established by source inspection or a local diagnostic. “Snapshot finding” means established in the saved metadata, with live status unverified. “Needs verification” means the repository does not contain enough evidence to establish the behavior.

## 3. What is already implemented

| Capability | Implementation | Remaining cafe concern |
| --- | --- | --- |
| Staff login | Supabase email/password login, persisted sessions, profile lookup, admin/cashier redirects. | Role loading, secure permissions, account provisioning/recovery, and shared-device controls. |
| Menu administration | Create/edit products and sizes, prices, category assignment, images, availability switches. | No category management screen, no exposed archive/publish workflow, and some sibling updates are separate unchecked writes. |
| Drinks and meals | Products can have sizes; modifiers can represent add-ons, flavors, or preparation choices; item notes are supported. | Required choices and unavailable modifiers are not enforced correctly. |
| Cart | Quantity controls, price totals, item removal, clearing, notes, and editing. | Editing resets selections; differently noted items can merge; unsubmitted carts are not persisted. |
| Order types | Dine-in, takeout, delivery. | No table/customer identity, delivery address/contact, dispatch, or delivery fee workflow. |
| Online order placement | Uses the `place_order` RPC for the intended atomic order/items/modifiers operation. | Full function body, server validation, duplicate prevention, and stock concurrency remain unverified. |
| Open/completed orders | Expandable order details, payment action, cancellation, completed-today list, Realtime refresh. | Older open orders are filtered out; cancelled history is not displayed; completed list is limited to 50. |
| Cash collection | Amount tendered, quick cash buttons, exact amount, and change calculation. | Server money checks, concurrent collection, receipt, and daily cash reconciliation. |
| GCash entry | Records a payment method and optional reference. | This is manual bookkeeping. There is no gateway integration or automatic payment confirmation. |
| Offline support | Cached menu/categories/modifiers and persistent queued orders; reconnect sync; five-attempt dead-letter transition. | Queue loss/duplication risks, incomplete payment/cancellation, attribution, and failed-order recovery. |
| Inventory | Stock count, tracking switch, low-stock threshold, adjustment, and Realtime refresh. | Screen discoverability, inventory row creation, stock concurrency, ingredient tracking, and trigger verification. |
| Sales reports | Today/7-day/30-day summaries, cash/GCash split, order types, category totals, and revenue chart. | Access control, business timezone, payment-date meaning, errors, exports, and shift reconciliation. |
| Gallery | Photo upload, captions, links, ordering, edit/delete. | Secondary to till readiness; storage cleanup and upload validation need attention. |
| UI foundation | Electric Mango theme, phone cart sheet, tablet side-by-side cart, scrolling lists, modals, and feedback. | Safe areas, keyboard behavior, small touch targets, accessibility, and real device validation. |
| Release configuration | EAS development/preview/production profiles, Android package, icons, and splash setup. | Verified release configuration, signed artifacts, installation, rollback, and operating documentation. |

The feature-based architecture is a strength. The normal pricing path also correctly includes modifier extras in `unit_price` once, then calculates subtotal as `unit_price * quantity`; it does not add modifier prices twice.

## 4. Security findings

### S01 — Critical: own-profile updates appear to permit admin role escalation

**Impact: a staff account could gain admin access and change menu, stock, and other protected data if the live database matches the snapshot and no additional column restriction exists.**

Evidence: [queryresults.json](../../queryresults.json), line 1839, shows the `Users can update own profile` policy with `qual` and `with_check` both limited to `id = auth.uid()`. The `role` column is on that same table at line 1150. The relation grants authenticated users table-level UPDATE; the recorded profile trigger is an `updated_at` trigger, not a role-change guard.

The ownership check restricts whose row can change, but does not restrict which columns can change. Removing a role editor from the app would not fix this because an authenticated client can call the API directly.

**Status:** critical policy defect in the snapshot; no live exploit performed. Column-specific privileges and the body of `get_user_role` were not exported.

**Required outcome:** staff may edit approved personal fields but cannot promote themselves. Role changes must use an admin-authorized server path. Verify both allowed and denied requests against a safe environment, including direct API requests.

This distinction between row permissions and column permissions is explained in [Supabase's column-level security guidance](https://supabase.com/docs/guides/database/postgres/column-level-security).

### S02 — High: reporting views appear readable without staff authorization

Evidence: [queryresults.json](../../queryresults.json), lines 2038 and 2048, describes `category_sales` and `daily_sales` as views owned by `postgres`, with SELECT granted to `anon` and `authenticated`, and no `security_invoker` option recorded.

**Impact:** someone outside the cafe may be able to read revenue, order volumes, and category performance directly through the data API. Hiding the Reports tab from cashiers does not control view access.

**Status:** snapshot exposure finding, assuming these views are exposed through the live Data API. Live access was not attempted. Views bypass underlying RLS by default when created with an owner that bypasses RLS; see [Supabase's view/RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security#views-and-rls).

**Required outcome:** explicitly authorize reporting for the intended staff roles. Using invoker semantics alone is not enough if the business requires admin-only reports; the final permissions must express that requirement.

### S03 — High: order updates and child inserts are too broadly authorized

Evidence: [queryresults.json](../../queryresults.json), line 1791, allows order updates when `auth.uid() IS NOT NULL`, without restricting role, current status, or editable fields. The order table has table-level UPDATE privileges. Child-record INSERT policies authorize admin/cashier roles without requiring a specific open parent order or the atomic RPC path.

**Impact:** an authenticated caller may be able to alter amounts, payment details, ownership, or status directly, or append items to an order outside the intended transaction flow. A completed order could potentially be changed without an auditable correction process.

**Status:** snapshot policy weaknesses. Complete live server enforcement was not inspected.

**Required outcome:** enforce approved state transitions and financial checks in server operations, restrict direct writes, and record who collected payment or cancelled an order. If staff accounts are provisioned administratively, separately verify that public self-signup cannot create operational access.

### S04 — High: privileged order RPC is executable by anonymous callers

Evidence: [queryresults.json](../../queryresults.json), line 2540: `place_order` is owned by `postgres`, uses `security_definer: true`, grants execution to PUBLIC/anon/authenticated, and sets `search_path=public`. The client checks authentication in [useOrders.js](../../src/hooks/useOrders.js), line 69, but that does not secure direct RPC calls.

**Impact:** if the function lacks its own authentication/role checks, an unauthenticated caller could invoke privileged business writes. Client-supplied prices and totals also require trusted validation inside the server boundary.

**Status:** high-risk exposure and verification gap, **not proof that anonymous order creation currently succeeds**. The function body is absent. A `public` search path is not by itself proof of an exploitable object-shadowing attack; schema CREATE privileges and referenced objects also matter.

**Required outcome:** inspect the full function, enforce caller authorization, narrow execution grants, validate the payload and pricing policy, and use a safe search path with appropriately qualified references. See [Supabase's database function security guidance](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker).

### S05 — High priority: dependency audit has unresolved findings

`npm.cmd audit --json` returned **36 affected package entries: 2 critical, 14 high, 19 moderate, and 1 low**. These are package entries, not 36 independent confirmed attacks against the POS.

The critical entries include:

| Package | Installed version | Advisory |
| --- | --- | --- |
| `shell-quote` | 1.8.3 | [Quoting does not escape newlines in object `.op` values](https://github.com/advisories/GHSA-w7jw-789q-3m8p). |
| `tar` | 7.5.13 | [Decompression/parse denial of service through unlimited input](https://github.com/advisories/GHSA-23hp-3jrh-7fpw). |

Evidence: [package-lock.json](../../package-lock.json), lines 11614 and 12118, installed package metadata, and the registry audit response. Other reported packages include Expo tooling, `node-forge`, `undici`, and `ws` dependency paths.

**Impact:** vulnerable tooling or runtime dependencies may expose developers, builds, or the deployed app depending on reachable inputs. Expo packages can contain build tooling even when classified as production dependencies, so audit severity does not establish mobile exploitability.

**Required outcome:** classify each relevant advisory by runtime/build exposure and update compatible dependencies deliberately. Do not blindly apply forced fixes; the audit suggested major Expo changes, including an older Expo version, that require compatibility review. No fixes or package changes were made.

### S06 — Medium: persistent session storage needs a shared-device security decision

Evidence: [supabase.js](../../src/lib/supabase.js), line 9, stores persisted auth sessions in AsyncStorage. There is no application lock/PIN flow, inactivity lock, or biometric gate in the reviewed screens. [AuthContext.jsx](../../src/contexts/AuthContext.jsx), line 79, does not check the returned sign-out error.

**Impact:** an unattended or compromised cafe device can expose an active staff session. Native AsyncStorage is not encrypted, and browser persistence is readable by JavaScript. This is a hardening concern, not evidence of token theft. [React Native's security guidance](https://reactnative.dev/docs/security#async-storage) describes these storage limits.

**Required outcome:** choose session storage appropriate to each platform, handle logout failures visibly, and define device locking, individual staff accounts, and access revocation. Persistent browser sessions also need appropriate XSS defenses at the hosting boundary.

### S07 — Medium: `.env` is already tracked

`git ls-files --error-unmatch .env` succeeds, although [.gitignore](../../.gitignore) includes `.env`. Ignore rules do not remove files already tracked by Git.

**Impact:** configuration values added to this tracked file can enter repository history. **No secret exposure is established here:** the file contents were deliberately not read, and a public Supabase URL/anon key is not a service-role secret.

**Required outcome:** review the file privately, use a safe example configuration, stop tracking local environment values, and rotate credentials only if actual private credentials were exposed. Any history rewrite needs separate planning and authorization.

### S08 — Medium: upload and hosting protections are not fully established

[imageUpload.js](../../src/utils/imageUpload.js), line 10, derives extension/MIME from a URI and has no explicit file-size/type validation. Server bucket size/MIME restrictions are absent from the metadata export. Public read of menu/gallery images can be appropriate, but write permissions and upload limits need live verification.

No web hosting header configuration is visible for content security policy or protection against framing. Such controls could exist at the host and were not inspected. No raw HTML injection, `eval`, or service-role key usage was found in the reviewed first-party app source; this is a positive observation, not a comprehensive secret or penetration audit.

## 5. Order, payment, and offline reliability

### O01 — Critical operational defect: sync can erase newly queued orders

Evidence: [offlineQueue.js](../../src/lib/offlineQueue.js), line 46, reads a queue snapshot, processes it, then overwrites the queue with `remaining` at line 74. `enqueue`, line 18, independently reads and writes the same key. The sync lock protects sync processors, but does not serialize enqueue/dequeue with sync persistence.

**Failure example:** sync reads order A. Before its remote request finishes, another order B is added to the queue. Sync succeeds for A and writes its old snapshot's empty remainder, erasing B.

**Local reproduction:** the real queue functions were run with an in-memory AsyncStorage replacement and a paused submission callback. Queue length was 2 immediately before releasing the callback; after sync, the saved queue was `[]`. No real server was involved.

**Required outcome:** serialize queue mutations or reconcile against current durable state, and remove only acknowledged order IDs. Verify enqueue during sync, process interruption, write failure, and app restart.

### O02 — High: retries can create duplicate orders

Evidence: local queue IDs are not passed to `place_order`; [useOrders.js](../../src/hooks/useOrders.js), line 90, submits only type, amounts, notes, and items. The saved RPC signature has no idempotency parameter, and the snapshot has no visible order request-ID constraint.

**Failure example:** the server commits an order, but the response is lost. The queue retains it as failed. A retry creates another order, potentially deducting stock twice. App termination after a commit but before queue persistence creates the same uncertainty.

**Local simulation:** a callback modeled “commit succeeded, response lost,” followed by a successful retry. One queued order resulted in two simulated commits. This demonstrates the client retry behavior; it does not reproduce live RPC behavior or rule out unknown internal server safeguards.

**Required outcome:** use a stable client request ID that the server persists uniquely and returns consistently on retry. Cover online double submission and restart recovery as well as offline sync.

### O03 — High: offline support does not cover a complete sale

Confirmed gaps:

- Queued cards have no payment or cancellation actions: [open-orders.jsx](../../app/(pos)/open-orders.jsx), line 94. No durable offline payment update queue exists.
- Already downloaded remote orders are not persisted for offline restart. Menu caches and local queued orders are persisted; remote order history is not.
- Five failures move an order to a dead-letter key, but no screen uses `getDeadLetters`: [offlineQueue.js](../../src/lib/offlineQueue.js), line 60. Staff cannot inspect or recover those failures through the app.
- Remaining failed orders are retried on a connectivity change or manual sync, without a timed retry/backoff schedule. Starting online with an existing queue does not explicitly trigger sync: [useOrders.js](../../src/hooks/useOrders.js), line 186.
- A request failure while NetInfo still says online is returned as an error; it is not automatically enqueued. This needs careful reconciliation because blindly enqueueing could duplicate a committed request.
- Queue keys are device-wide, not user-scoped. Original staff identity is not stored in queued payloads, and queued timestamp/identity are not forwarded to the RPC. A later account can sync an earlier account's orders using its own session.
- Local labels `Q1`, `Q2`, etc. are derived from queue position and can change after synchronization; they are not stable cafe ticket numbers.

**Required outcome:** either implement and verify the promised offline sales lifecycle, or provide an explicit supported operating mode that prevents unsupported actions and gives staff a reliable paper/manual reconciliation process. An “Offline — orders will be queued” banner currently promises more continuity than the full workflow provides.

### O04 — High: payment/cancellation state transitions are not guarded

Evidence: [useOrders.js](../../src/hooks/useOrders.js), lines 196 and 219, updates orders by ID only. Neither mutation requires `status = 'open'`, checks a version, or verifies that a row was changed. [PaymentSheet.jsx](../../src/components/pos/PaymentSheet.jsx), line 37, validates cash sufficiency in the UI; the saved constraints do not show equivalent completed-payment requirements.

**Failure example:** one device completes an order while another cancels it. Both submit updates, and the final state can depend on arrival order. Stock restoration and sales totals then depend on server logic that was not exported.

GCash confirmation accepts an optional reference and does not check a provider. The cafe must verify the actual receipt of funds; this screen does not perform that verification. There is no split payment, refund flow, or payment attempt/audit ledger.

The payment modal resets inputs even when its parent handles a returned error, and close/back remain available during submission. Unexpected exceptions can leave submitting states stuck. The new-order handler also lacks `try/finally`: [order.jsx](../../app/(pos)/order.jsx), line 80.

**Required outcome:** atomically authorize and validate payment/cancellation on the server, require an allowed starting state, reject stale requests, return a definitive outcome, and preserve/reconcile uncertain payment attempts. Record the responsible staff member and server timestamp.

### O05 — High: business-date handling can hide orders and misgroup sales

There are three different definitions of “today”:

1. [useOrders.js](../../src/hooks/useOrders.js), line 19, uses the device's local midnight.
2. [reports.jsx](../../app/(admin)/reports.jsx), line 15, uses the UTC date from `toISOString()`.
3. The saved staff policy uses `created_at::date = CURRENT_DATE`; reporting views group `created_at::date`, and the saved database timezone is UTC: [queryresults.json](../../queryresults.json), lines 1779, 4, and 2493.

**Example if the cafe uses UTC+8:** an order created at 07:00 local time has the previous UTC date. After 08:00 local time, the database's current UTC date changes, so a cashier's current-day policy can exclude that same order even though the local workday has not changed. Local diagnostics confirmed the 07:00 and 09:00 timestamps fall on different UTC dates.

Both roles' app queries also exclude open orders created before local midnight. An unpaid order from yesterday can become inaccessible through the normal screen even if it remains open. Reports attribute completed sales to order creation date rather than payment date. Queued orders are submitted later without forwarding their original queued timestamp, so their business-date meaning needs explicit design.

**Required outcome:** choose a cafe timezone and business-day rule, use it consistently in queries, policies, reports, and daily close, and keep all unresolved open orders accessible. Decide whether sales belong to the sale/payment day, and distinguish original sale time from sync time.

### O06 — High for drinks/meals accuracy: modifier rules are incomplete

Evidence: [ModifierPicker.jsx](../../src/components/pos/ModifierPicker.jsx), line 79, submits without checking `min_select`. “Required” is displayed at line 157 but not enforced. The picker renders every modifier at line 161 without respecting `available`; it also does not filter out unpublished modifier groups.

The picker selects groups using the originally tapped item ID, while size variants may have different IDs. Admin item targeting deduplicates products by name: [useModifiers.js](../../src/hooks/useModifiers.js), line 39. This can attach choices inconsistently across sizes, or confuse identically named products in different categories.

**Cafe example:** a meal can be submitted without a required preparation choice, or a drink can include an add-on the administrator marked unavailable.

**Required outcome:** enforce required/maximum selections and availability both in the picker and server validation; define product-level versus variant-level targeting clearly.

### O07 — Medium: editing and note merging can change the customer's request

Editing opens the picker without passing existing quantity, size, or selections: [order.jsx](../../app/(pos)/order.jsx), line 71. The picker resets to quantity 1, no modifiers, and the first available size at line 45. Confirming an edit can therefore replace a previously customized item with defaults.

Cart identity uses menu ID and modifier IDs, excluding notes: [CartContext.jsx](../../src/contexts/CartContext.jsx), line 13. A local reducer reproduction adding “No ice” and “Extra ice” for the same product returned one row with quantity 2 and only “No ice.” In the UI, adding another identical item after entering a note has the same merging issue.

The cart exists only in React memory. A restart or route-provider teardown can discard an order that has not yet been placed.

**Required outcome:** prefill edits, preserve intentional notes separately, and define whether unfinished carts must survive restart or staff changes.

### O08 — Medium: client validation accepts malformed numeric input

[validateOrder.js](../../src/utils/validateOrder.js), line 22, checks number type and ranges, but not finite numbers or integer quantities. It does not validate menu IDs, modifier association, modifier rules, or availability.

Local diagnostics returned `{ valid: true }` for a fractional quantity, a `NaN` price/subtotal, and a missing menu item ID. Normal UI quantity buttons produce integers, so this is a defense/recovery gap rather than proof that ordinary taps create these payloads. Non-finite numbers also serialize unexpectedly, so malformed cached data can fail later.

**Required outcome:** reject malformed values early and enforce trusted server checks. Preserve the existing convention that unit price already includes modifier extras. Decide explicitly whether the current one-peso subtotal tolerance is appropriate for the business.

## 6. Inventory and menu operation

Inventory is currently **per menu-item/size stock**, not shared ingredient stock. It can represent ten meals available or twenty bottled drinks, but cannot calculate milk, coffee beans, meat, rice, packaging, recipe consumption, purchasing, waste, or ingredient cost.

That limitation is not automatically a launch blocker for a small cafe if staff intentionally manage ingredients outside the POS. It must be understood so the owner does not mistake portion tracking for a complete inventory system.

Other findings:

- The Inventory route is hidden with `href: null`: [admin layout](../../app/(admin)/_layout.jsx), line 64. No navigation link to it was found elsewhere in the app.
- A `createInventoryEntry` helper exists but no screen calls it: [useInventory.js](../../src/hooks/useInventory.js), line 97. Menu insertion does not create an inventory row, and the snapshot contains no menu-insert trigger for that purpose. New-product stock onboarding is incomplete unless handled outside the app.
- The POS uses `menu_items.available`, not stock data. Whether sold-out stock automatically changes availability depends on missing server function bodies.
- Stock adjustments write an absolute value: [useInventory.js](../../src/hooks/useInventory.js), line 45. If stock changes due to a sale while an editor is open, saving an old count can overwrite that change. There is no visible stock movement/audit ledger.
- Stock and threshold are saved as two separate updates: [inventory.jsx](../../app/(admin)/inventory.jsx), line 102. One can succeed while the other fails. The editor also retains its original object after a tracking toggle, so displayed controls can stay stale.
- Cancellation restoration is especially important to verify for cashiers. `restore_stock_on_cancel` is recorded as an invoker function, while inventory UPDATE is admin-only. If its body performs an ordinary inventory update, cashier cancellation may fail to restore stock. Its body and live behavior are unverified.
- Product rename/image updates span separate sibling writes whose errors are not checked: [useMenu.js](../../src/hooks/useMenu.js), line 135. Name/category grouping is used as product identity, so partial edits can split product groups.
- Historical menu/modifier foreign keys use RESTRICT. Deleting previously sold records can fail, but the admin UI mainly offers deletion rather than a clear archive flow. Historical category reports join current menu categories, so moving an item can reclassify old sales.

**Required outcome:** expose a complete stock setup workflow, validate decrement/restoration under concurrency and each staff role, keep sold-out behavior explicit, and use safe stock adjustments. Provide an archive strategy that preserves order history.

## 7. Daily cafe operability and missing workflows

For a simple counter-service cafe, the existing menu/cart/payment foundation is useful. A reliable cafe POS also needs a clear answer to “what happens if something goes wrong, and how do we balance the money at closing?”

| Business process | Current implementation | Launch decision |
| --- | --- | --- |
| Receipts/invoices | No receipt generation, printing, sharing, or reprint workflow found. | Define the cafe's required receipt process and implement/integrate it or agree on an appropriate manual process before launch. |
| Cash shifts | No opening float, paid-in/paid-out, shift handover, expected cash, or counted-cash close. | Establish daily cash reconciliation. A documented manual close may be sufficient for an initial small pilot. |
| Refunds/corrections | Cancellation exists for displayed open orders; no completed-sale refund or correction workflow. | Establish an authorized, auditable correction/refund process. |
| Preparation/handoff | No preparing/ready/served states, kitchen/barista queue, or ticket printing. | Decide whether verbal/paper handoff is sufficient. Larger meal workflows will need more coordination. |
| Tables/customers | No table number, customer name, or customer-facing ticket identity. | Optional for basic counter service; important if orders need matching to tables or pickup customers. |
| Delivery | An order-type label only. | Treat delivery management as outside current scope until customer/address/fee/handoff handling is added or documented. |
| Menu setup | Products and modifiers are editable; category creation and archive/publish controls are not exposed. | Prepare the actual cafe menu and ensure staff can safely maintain it. |
| Staff accounts | Login exists; no staff creation, deactivation, role-management, or password recovery UI. | Establish an owner-controlled provisioning and revocation process. |
| Tax/discount rules | Discount column exists in the schema, but no discount or tax workflow was found. | Verify applicable local requirements and the cafe's pricing policy separately. This review does not certify legal or accounting compliance. |
| History/export | Reports cover fixed recent ranges; completed POS list is capped at 50; no searchable full sales/cancellation history or export. | Provide a way to investigate and reconcile older transactions. |
| Incident recovery | No staff recovery screen, failed-order console, or restore runbook. | Define internet outage, device loss, stuck payment, and failed-sync procedures. |

Not every cafe needs recipes, table management, split payments, or a kitchen display at launch. The mandatory part is that the supported operating model is clear and its money/order/recovery paths are dependable.

## 8. Usability, error handling, and platform readiness

### Native UI and error states

The dark theme and feature components provide a coherent foundation. The POS adjusts at a 768-pixel breakpoint; phone users get a cart sheet and tablet users get a side panel. Modals, scroll containers, unavailable-product indicators, loading states, and payment feedback are implemented in several places.

Remaining concerns:

- Many hooks ignore read errors and expose no screen-level error state. An API failure can appear as an empty menu, no unpaid orders, or no sales: [useOrders.js](../../src/hooks/useOrders.js), line 44; [useSalesReports.js](../../src/hooks/useSalesReports.js), line 35; [useMenu.js](../../src/hooks/useMenu.js), line 36. “All clear” must not imply that an unpaid-order query succeeded.
- `loading` is unused on the orders and inventory screens. Reports do not refresh on focus or Realtime changes; an already-open report can remain stale after payment.
- The POS menu hook subscribes only to `menu_items`, so category and modifier changes on another device need a separate refresh mechanism. Multiple screen instances use the same channel names and maintain independent state; subscription ownership and cross-screen queue counts need verification.
- Cache data has no freshness timestamp or explicit version. Cache reads and network requests run independently, which can allow a late cache read to replace fresh state.
- Profile loading is not awaited before auth loading finishes. An unknown role initially takes the admin redirect branch: [AuthContext.jsx](../../src/contexts/AuthContext.jsx), line 29; [root layout](../../app/_layout.jsx), line 35. This is a navigation/fail-closed issue; database permissions must remain the security boundary.
- Safe-area insets are read but unused in the phone cart and modifier picker, while footer padding is fixed. Payment content lacks a scroll container. Check bottom navigation overlap and keyboard clipping on actual devices.
- Icon-only controls lack explicit accessibility labels/roles in the reviewed source, and some quantity controls are small. Large text, screen reader behavior, and touch accuracy remain unverified.
- App orientation is locked to portrait despite tablet support. Confirm that this suits the intended cafe hardware.
- Fonts keep the splash screen visible until loading succeeds, without an explicit font-error fallback. Startup failure behavior should be checked.

### Web is not currently a verified deployment target

The all-platform export fails during static rendering with **`ReferenceError: window is not defined`**. The stack enters AsyncStorage through Supabase session initialization. [app.json](../../app.json) configures static web output, while [supabase.js](../../src/lib/supabase.js), line 7, creates a persistent client with browser-dependent storage at module load.

There is a second confirmed compatibility issue: the installed `react-native-web` Alert implementation has an empty `static alert() {}`. Core flows depend on `Alert.alert` callbacks for cart removal/clearing, cancellations, deletions, and logout. Those confirmations do not work through that implementation on web. [ConfirmModal.jsx](../../src/components/common/ConfirmModal.jsx) exists but is not wired into those flows.

The upload helper also uses the native `{ uri, name, type }` FormData pattern without a browser-specific File/Blob path. Browser upload behavior was not exercised.

**Required outcome:** fix static-render compatibility and cross-platform confirmations/uploads, then verify browser use if web is a required launch platform. A cafe can choose an Android-only initial release, but that does not resolve backend, offline, or payment blockers.

## 9. Deployment, maintainability, and operations

### Deployment foundation

EAS build profiles and the Android package are configured. The Android export produced a Hermes bundle and assets successfully. That proves local bundling with dummy configuration, **not a working signed APK/AAB, installation, successful authentication, or cafe transaction**.

The all-platform attempt reported Android and iOS bundling before failing on web static rendering. No standalone iOS export, signed iOS build, device installation, or submission was verified. An iOS bundle identifier is not recorded in `app.json`; actual EAS credentials/settings also need checking.

Package version is `1.0.0`, while Expo app version is `1.1.0`. This discrepancy is not itself a blocker, but release numbering should be intentional. Production environment variables, account ownership, signing credentials, distribution, and rollback are not established by the presence of `eas.json`.

### Quality and support

- **Lint currently fails:** 95 findings, comprising 81 errors and 14 warnings. Most errors are unresolved `@/` imports in the lint resolver; two are unescaped quotes in `OrderCard`. Successful native bundling shows the lint alias errors should not be interpreted as proof that the app cannot resolve its imports at runtime. The lint configuration still needs correction and a clean baseline.
- There is no automated test script/framework or active `.github/workflows` CI pipeline. `.github-template` contains reusable development material, not a running build/test workflow.
- A lockfile exists, which supports reproducible dependency installs. Add release checks using a controlled install and compatible dependency/security validation.
- No versioned Supabase migration directory or complete function definitions are present. The saved metadata/query cannot independently recreate the backend. This complicates staging, review, rollback, and disaster recovery.
- README is still the Expo starter text and references `reset-project`, which is not in `package.json`. It does not explain cafe setup, accounts, menu preparation, releases, or incident handling.
- No structured crash reporting, centralized error monitoring, failed-order alerting, or business audit log integration was found. Most errors rely on alerts, ignored responses, or console warnings.
- Backup configuration and restore capability may exist in Supabase, but were not inspected. Local queued orders reside on one device and need their own recovery strategy; a remote database backup cannot recover an order that never synced.
- The Android export includes many font/icon assets. Optimize only after measuring installed size and device performance; no performance benchmark or startup measurement was performed.

The project instructions and skills are helpful engineering guardrails. They do not substitute for verified permissions, tests, backup restores, or staff operating procedures.

## 10. Recommended path to cafe readiness

### Gate 1: make the transaction and security boundaries trustworthy

Complete before a real-money pilot:

1. Obtain fresh read-only database metadata plus complete order, role, user-provisioning, and stock function definitions. Verify column grants, view access, API exposure, bucket restrictions, and signup/account policy.
2. Resolve S01-S04: self-promotion, reporting exposure, broad order/child writes, and RPC authorization. Demonstrate denied direct requests from anonymous and unauthorized staff clients.
3. Fix O01 and establish durable queue mutation rules. Implement server-enforced duplicate prevention for online/offline requests.
4. Make payment and cancellation atomic, authorized state transitions; validate cash/payment fields and stock effects under simultaneous device actions.
5. Align timezone/business-day handling and keep unresolved orders accessible across midnight.
6. Enforce modifier requirements, availability, and accurate cart editing/notes.
7. Triage critical/high dependency findings and establish an intentional dependency baseline.

**Exit evidence:** denied unauthorized writes, one server order per request ID, no lost queued orders, correct price/stock/payment outcomes, and stable business-date reporting in a safe validation environment.

### Gate 2: define and complete the supported cafe operating model

1. Decide whether initial service is online-only with a documented outage fallback or fully offline-capable. Implement that choice honestly in the UI.
2. Expose failed-order recovery and preserve original staff/time attribution.
3. Complete inventory navigation/setup and safe stock adjustments, or explicitly manage stock outside the app for the pilot.
4. Establish receipt, correction/refund, staff access, preparation handoff, and closing reconciliation processes suitable for the cafe.
5. Make failed/stale reads visible so staff do not mistake an unavailable service for an empty result.
6. Document menu setup, daily opening/closing, outage handling, and escalation contacts.

**Exit evidence:** a staff member can complete and reconcile a service period, including failed payment/sync cases, using the agreed process without developer intervention.

### Gate 3: verify releases and recovery

1. Correct lint and add meaningful automated coverage for transaction invariants and queue persistence. No existing automated test command can be used as a launch gate yet.
2. Build and install a signed preview/release on the actual cafe hardware with the intended environment configuration.
3. Verify native startup, auth refresh, image permissions, phone/tablet layout, keyboard handling, and accessibility.
4. Resolve web export and web interactions if web is in launch scope; independently verify iOS if required.
5. Establish environment separation, versioned backend changes, a release/rollback checklist, monitoring, backup policy, and a demonstrated restore procedure.

**Exit evidence:** installed release checks and recovery drills, not only successful JavaScript bundling.

### Gate 4: controlled cafe pilot, then production decision

Run the cafe's actual menu and staff workflow under supervision, with a trusted fallback. Reconcile every order, cash payment, GCash payment, cancellation, and stock adjustment. Include a busy period and a connection interruption.

The owner should approve full use only after discrepancies are explained, critical/high transaction and security findings are resolved, and staff can recover from supported failures. Calendar estimates would be unreliable before inspecting the missing server definitions and confirming the required operating model.

## 11. Required scenarios still to verify

None of the following live/device scenarios was exercised in this review:

| Scenario | Expected outcome |
| --- | --- |
| Admin/cashier login, missing profile, revoked role, expired session | Correct access and visible recovery; unknown roles do not gain admin presentation or privileges. |
| Anonymous direct API access and staff attempts to change role/amounts | Denied unless explicitly authorized by the business model. |
| Drink sizes, required choices, unavailable add-ons, notes, quantity edits | Customer request and price stay accurate through cart, server order, and history. |
| Double tap, lost response, restart after server commit | One order and one stock deduction. |
| Offline order, restart, enqueue during sync, failed storage write | Accepted orders remain durable and visible; failures are not falsely shown as accepted. |
| Reconnect, online startup with pending queue, five failures | Predictable sync, clear pending/failure state, recoverable dead-letter orders. |
| Two devices pay/cancel the same order | Exactly one permitted final transition; no payment/stock disagreement. |
| Cash underpayment, exact cash, change, failed request | Server rejects invalid amounts and the UI preserves/reconciles uncertain outcomes. |
| Manual GCash confirmation and duplicate/reference errors | Actual funds are verified under a documented cafe procedure. |
| Last stock unit, concurrent sales/restock, cashier cancellation | No overselling or lost adjustment; stock is restored once when appropriate. |
| UTC+8 morning, midnight, overnight unpaid order, delayed sync | Consistent business date; unpaid orders remain accessible; close totals reconcile. |
| More than 50 completed orders, old/cancelled transactions | History and reconciliation are complete through the agreed interface/process. |
| API error, stale menu/cache, Realtime disconnect | Staff see the failure or freshness limit, with a usable refresh/recovery path. |
| Device loss, app data deletion, database restore | Documented recovery with understood limits for unsynced device-local orders. |
| Actual phone/tablet, keyboard, safe areas, large text | Core touch and payment workflows remain usable. |
| Signed release install/update; browser and iOS if supported | Correct environment, startup, authentication, and release behavior. |

## 12. Verification record

The repository has **no automated test command**. The following were source checks, diagnostics, lint, dependency checks, and exports; they are not a passing automated test suite.

| Command/check | Observed outcome |
| --- | --- |
| `git status --short` and `git diff --stat` | Existing untracked project guidance/template/context/metadata files were present. No tracked application diff. Rechecked on 2026-10-04. |
| `git ls-files --error-unmatch .env` | Exit 0: `.env` is tracked. Contents were not inspected. |
| `npm run lint` / initial `npm audit --json` | PowerShell blocked `npm.ps1` under its execution policy. Used the ordinary `.cmd` launchers without changing that policy. |
| `$env:EXPO_NO_DOTENV='1'; npm.cmd run lint` | Exit 1: 95 findings, 81 errors and 14 warnings. Rechecked on 2026-10-04 with the same result. |
| `npm.cmd audit --json` | Initial sandbox network request failed. Authorized retry contacted the npm registry and exited 1 because vulnerabilities were reported: 36 affected packages, including 2 critical and 14 high. A compact parsed response confirmed the counts. |
| `$env:EXPO_NO_DOTENV='1'; $env:EXPO_OFFLINE='1'; npx.cmd expo install --check` | Exit 0: “Dependencies are up to date,” accompanied by “Dependency validation is unreliable in offline-mode.” This is limited local compatibility evidence, not a clean security or online validation result. |
| `npx.cmd expo export --platform all --output-dir dist/readiness-review-20261002` with the environment below | Initial sandbox attempt was blocked executing `hermesc.exe`. Authorized retry bundled Android/iOS, then exited 1 with `window is not defined` during web static rendering. |
| `npx.cmd expo export --platform android --output-dir dist/readiness-review-20261002-android` with the environment below | Authorized run exited 0. Exported one Android Hermes bundle, approximately 4.71 MB, 63 assets, and `metadata.json`. No signed application was built or installed. |
| `$reviewScript \| node`, inline Node/VM diagnostics loading `validateOrder.js`, `offlineQueue.js`, and `CartContext.jsx` | Observed malformed-input acceptance; queue overwrite from length 2 to empty; two simulated commits on retry; note merging into a quantity-2 row. Storage and submission were mocked in memory; no remote data was used. |
| Inline Node timestamp diagnostic | Confirmed UTC+8 07:00 and 09:00 map to different UTC dates. This supports the date-boundary example, not a live RLS execution result. |
| Installed `react-native-web/dist/exports/Alert/index.js` inspection | Confirmed the installed implementation is `static alert() {}`. |
| `git diff --check` | Exit 0 before and after report creation. It does not inspect untracked files. |
| `git diff --no-index --check -- NUL ProjectContext/assessments/currentImplementation.md` | Exit 0: no whitespace errors in the new report. Git noted normal LF-to-CRLF conversion on this Windows checkout. |
| Inline Node document check (`$docCheckScript \| node`) | Exit 0: all 41 relative source links resolve, the 13 numbered sections are present, and the code fences are balanced. |

Export environment, set only for diagnostic commands:

```powershell
$env:EXPO_NO_DOTENV='1'
$env:EXPO_OFFLINE='1'
$env:EXPO_PUBLIC_SUPABASE_URL='https://readiness-check.invalid'
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY='readiness-check-placeholder'
```

The ignored `dist/readiness-review-20261002*` paths are local diagnostic output, not deployable production configurations. No deployment occurred. Advisory counts reflect the registry response collected in the preceding review session and may change as advisories are updated.

The order-integrity and Supabase skills guided the full transaction/policy review; the security skill guided severity and exposure distinctions; the verification skill guided the separation between observed results and unperformed live/device checks.

## 13. Final assessment

Patanos has a credible implementation foundation for a small drinks-and-meals cafe. Its current phase is **MVP hardening before pilot**, with the strongest progress in screens, menu/cart features, and basic data integration.

The next milestone should be a **secure, recoverable, reconcilable cafe pilot**, supported by verified server behavior and an installed release. The present code and metadata do not yet establish that readiness. Resolve permission and transaction-integrity blockers first, then complete the chosen cafe operating model and prove it on actual hardware.
