# Patanos release requirements

Static scope reference, consolidated 2026-10-06. **Not a second tracker:** status and checkboxes exist only in [implementationPlan.md](../implementationPlan.md). Read the relevant task scope before implementation; condensed tracker labels do not narrow acceptance requirements. Original 103 task IDs and complete task descriptions are preserved here. Changes to consequential technical choices belong in [architectureDecisions.md](../architectureDecisions.md).

## 2. Confirmed operating requirements

| Area | Decision for the first cafe release |
| --- | --- |
| Devices | Android phones and Android tablets, with landscape tablet layouts. iOS and web are later targets. |
| Business | One Philippine cafe; PHP currency; several family staff accounts, normally one active cashier/barista at a time. |
| Accounts | Separate owner/admin and cashier accounts. Both land on the POS after login. |
| Service | Counter service, takeout, and occasional delivery. Preserve the existing `dine-in`, `takeout`, and `delivery` data values. |
| Preparation | Verbal ordering and handoff. No kitchen display, preparation queue, or delivery dispatch integration required initially. |
| Payment timing | Support immediate Pay & Complete and Save Unpaid / Pay Later. Either may be used before or after preparation. |
| Payment methods | Cash and manually recorded GCash. No payment gateway integration in the first release. |
| Fixed-price bundle | Owner-approved 2026-10-05: three mini pizzas for PHP 99, mixed or same flavor, alongside PHP 39 singles. Exactly three matching flavor portions; no general discount engine. |
| Offline | Complete cash-sale operation on a previously enrolled device, including restart recovery, payment, order lookup, and later synchronization. |
| Inventory | Finished products, sizes, and portions first. Ingredient recipes and consumption come later. |
| Daily controls | Opening float, cashier handover, closing count, recorded corrections/refunds, and manual GCash reconciliation. |
| UI direction | Retain Electric Mango; redesign navigation and interactions for fewer steps, larger touch controls, search, accessibility, and phone/tablet ergonomics. |
| Printing | Optional later feature. Existing thermal printer is not a first-release dependency. |
| Deferred | Split payments, discounts, tax calculations, automated GCash, ingredient inventory, multi-location operation, expanded platforms, and hosted Sentry/crash monitoring (owner decision 2026-10-05). |
| Quality investment | Automated tests and a separate staging database remain required. Hosted error monitoring is optional P12; visible local sync problems, recovery and owner response procedures remain required. |
| Timing | No fixed launch date. Readiness gates determine the schedule. |

Not implementing tax calculations is a product-scope decision, not a conclusion about applicable business requirements. Before real-money launch, the owner must confirm applicable receipt, recordkeeping, tax, and privacy obligations with appropriate local advisers. Any mandatory requirement overrides the optional-feature classification and must be added to the release scope.


### Working defaults to document during implementation

These defaults make the plan executable without adding unnecessary scope. Record any owner-requested changes in the decision log before implementing them.

- Cashiers sell, record payments, view operational orders, and cancel unpaid orders with a reason. Owners manage staff, stock adjustments, refunds, sensitive reports, and settings. Enforce permissions on the server as well as in the UI.
- A paid sale is not proof that food was prepared or handed over. Do not add misleading kitchen-status automation. Verbal preparation remains outside the initial workflow.
- Use one active selling device/register at a time. Either a phone or tablet can be that device. Switching devices requires a controlled handover; simultaneous disconnected devices cannot guarantee a shared real-time stock count.
- First enrollment and new-account authorization require connectivity. Previously authorized staff can use a clearly bounded offline-access policy on an enrolled device. Remote revocation cannot take effect instantly while a device is disconnected.
- Manual GCash recording is bookkeeping, not gateway verification. Staff follow an owner-approved verification procedure; a customer screenshot alone must not be labelled system-verified payment.
- Preserve paid transactions. Corrections use linked, permission-controlled records instead of editing or deleting history. Start with full-sale or whole-item-quantity refunds; split-tender and arbitrary discount flows remain deferred.

## 4. Intended architecture and safety rules

Keep Expo Router, React Native, Supabase, feature-based components, and the existing theme. Refactor the transaction path deliberately rather than rewriting unrelated parts of the app.

```text
POS interaction
    -> shared domain validation and immutable transaction identity
    -> durable local transaction: order + payment/stock events + outbox
    -> show locally saved result; distinguish pending sync from synced
    -> replay-safe server transaction with authorization and validation
    -> acknowledge only the specific accepted events
    -> reconcile local history, stock, shifts, and reports
```

An outbox is a durable list of business changes waiting to reach the server. It must not be replaced wholesale from a stale in-memory copy. Server replay protection means sending the same operation again returns the same result instead of creating another sale.

### Transaction model to establish in P2

| Concern | Required distinction |
| --- | --- |
| Identity | Stable sale ID and operation/event ID, device/register ID, original staff ID, and shift ID. A display order number is not the deduplication key. |
| Money | PHP values represented consistently in centavos for application calculations; finite inputs, explicit rounding, and checked conversion at the database boundary. |
| Price history | Snapshot item, variant, modifiers, category, notes, unit price, and catalog version. Historical sales must not change when the menu changes. |
| Order lifecycle | Draft, saved unpaid/open, settled, or cancelled. Map this deliberately to current schema values rather than changing labels alone. |
| Payment | Method, amount, tender/change for cash, manual GCash reference/confirmation, and later refund records. Payment and cancellation are guarded transitions. |
| Sync | Local-only, pending, syncing, synced, or needs attention. Paid and synced are independent facts. |
| Time | Original event time, server receipt time, Asia/Manila business date, and shift membership. Flag implausible device clocks. |
| Stock | Exactly-once consumption/reservation and explicit release, restock, or waste movements. Never deduct twice when an unpaid order is later paid. |
| Audit | Actor, reason, prior state/version, related sale, and operation ID for sensitive actions. Do not log secrets or unnecessary customer details. |

The existing one-peso subtotal tolerance is the current behavior, not an acceptable substitute for a defined money contract. P2 must document the transition to deterministic centavo calculations, legacy-data handling, and server/client compatibility before changing validation. Offline prices also need an explicit acceptance policy; never silently reprice a sale after cash was collected.

### Candidate tools and services

These are phase requirements/proposals; actual installation status is established by repository code and tests, not this specification. Confirm compatibility with the repository's actual Expo SDK and React versions before installation; do not copy versions from the latest documentation blindly.

| Need | Proposed approach | Phase / verification |
| --- | --- | --- |
| Durable local sales and outbox | Evaluate and adopt `expo-sqlite` with transactions and versioned migrations; retain AsyncStorage for suitable non-critical preferences/cache. | P0 spike, P3 implementation. Verify restart, disk failure, concurrency, and upgrades. [Expo SQLite documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/). |
| Native credentials | Evaluate `expo-secure-store` for sensitive tokens/device secrets; keep the sales database separate. | P1. Verify token-size handling, device lock, backup exclusions, and reinstall behavior. SecureStore is not an order backup. [Expo SecureStore documentation](https://docs.expo.dev/versions/latest/sdk/securestore/). |
| Unit/component tests | Jest with `jest-expo` and React Native Testing Library, selected for installed-version compatibility. | P0 foundation; every phase adds regression tests. [Expo testing guide](https://docs.expo.dev/develop/unit-testing/). |
| Device-flow automation | Evaluate Maestro for Android checkout, navigation, and restart flows; supplement with controlled network/process-failure tests. | P0 spike, P7 suite. [Maestro documentation](https://docs.maestro.dev/). |
| Separate backend environments | Local/test setup plus separate staging and production Supabase projects; synthetic data and distinct credentials. | P0. Verify migration promotion and access isolation. [Supabase environment guidance](https://supabase.com/docs/guides/deployment/managing-environments). |
| Optional error monitoring | Existing opt-in Sentry skeleton retained, inactive without a DSN. Future release/environment tags, source maps, redaction, and hosted alerts. | P12, deferred by owner on 2026-10-05; not required for POS operation or P0/P7 completion. [Expo Sentry guide](https://docs.expo.dev/guides/using-sentry/). |
| Continuous checks | Repository CI for lint, tests, migration checks, and a reproducible Android build workflow. | P0 initial pipeline; P7 release gate. Choose the existing repository host's suitable CI service. |

Service setup, credentials, SQL application, and deployment require explicit authorization at execution time. Monitoring must not transmit auth tokens, raw payment evidence, complete customer notes, or database secrets. Any local database encryption decision must include key recovery and upgrade testing; encryption alone does not prevent order loss.

## Required and optional phase scopes

P0–P8 are required for the agreed Android release; P9–P12 remain separately approved optional scope. Owner-approved sequencing allows local P1/P2 work before deferred staging gates; the tracker defines current dependencies. Phone and tablet acceptance remains required. The three-pizza PHP 99 bundle is required first-release scope.

## P0 — Revalidate the baseline and build the development foundation

**Outcome:** Developers can reproduce defects, test fixes safely, and work from an agreed POS design. This phase does not make the current app safe for sole-POS use.

**Primary areas:** `package.json`, lockfile, lint/config files, `database-review.sql`, `queryresults.json`, test/CI setup, EAS configuration, and project documentation.

### P0.1 — Baseline and decision records

#### P0-01

Record the current revision and pre-existing worktree changes. Re-run lint, dependency/security audit, Expo compatibility checks, and Android build/export checks. Separate source failures, toolchain failures, and unverified device behavior; triage rather than blindly force dependency upgrades.

#### P0-02

Obtain authorized read-only database metadata covering complete function/trigger bodies, RLS, table/column grants, view security, Storage policies/limits, and Auth settings. Date the snapshot and reconcile it with the original findings; do not assume saved metadata describes production.

#### P0-03

Record architecture decisions for sale lifecycle, local database, price/rounding rules, offline access duration, refund/restock behavior, active-device handover, and supported Android device/OS matrix. Capture unresolved implementation choices with an owner and resolution gate.

### P0.2 — Safe environments and automated checks

#### P0-04

Create version-controlled schema migrations, synthetic drinks/meals data, staff-role fixtures, and a repeatable local/staging setup. Provision the separate staging project only with authorization; ensure no production credentials or customer records enter tests.

#### P0-05

Add compatible unit/component test tooling and scripts; fix lint alias resolution and actual source lint defects. Add CI checks and first regressions for queue overwrite, retry duplication, invalid quantities/money, and modifier selection. Update repository command guidance when test scripts actually exist.

#### P0-06

Establish and verify an Android development/release-candidate build path. Separate staging/production build identifiers or visibly distinguish installations and backend targets; record a reproducible candidate APK/install against the intended staging backend. Hosted Sentry delivery/source-map verification moved to optional P12 by owner decision on 2026-10-05; the inactive skeleton is not a completion dependency.

### P0.3 — UX blueprint and acceptance scenarios

#### P0-07

Produce phone and tablet-landscape wireframes for POS, modifiers, cart, quick checkout, saved unpaid orders, sync problems, shifts, and owner tools. Review the real verbal-order workflow with the owner; retain Electric Mango tokens and feature-based UI ownership.

#### P0-08

Establish representative scenario data and acceptance targets: simple drink, modified drink, meal, mixed order, takeout/delivery notes, sold-out portion, unpaid order, GCash, cancellation, refund, offline restart, and shift handover. Record actual cafe menu size and target device performance rather than inventing benchmarks from a desktop.

#### P0-GATE

Baseline results, architecture decisions, wireframes, working test command, isolated staging connection, and reproducible Android installation evidence are recorded. Required access/decisions are available for P1–P3. Owner-approved overlap permits local P1/P2 development before this gate; remaining staging/install evidence is due at the integrated cash-sale/offline milestone and must pass before P7 acceptance.

## P1 — Close security gaps and establish safe staff access

**Outcome:** Each account can do only its permitted work, even when calling the backend directly. Offline access has documented limits.

**Primary areas:** `AuthContext`, auth/root layouts, Supabase client, database policies/functions/grants, environment handling, and image upload/storage.

### P1.1 — Database authorization

#### P1-01

Prevent self-promotion through profile updates, signup metadata, or indirect role helpers. Restrict role changes to a trusted owner-controlled server path; test table and column permissions as well as RLS.

#### P1-02

Restrict reporting views to intended users and verify underlying row visibility. Remove inappropriate anonymous access. Test actual queries using anonymous, cashier, and owner identities, not only the SQL editor's privileged account.

#### P1-03

Harden RPC grants, authentication/role checks, fixed search paths, and direct order/child writes. Remove bypass paths around atomic business operations. Test that client-supplied totals, actor IDs, status, and stock fields cannot grant unauthorized behavior. Include the locally reproduced cashier cancellation/invoker-trigger boundary: order status changes but admin-only inventory UPDATE prevents stock restoration; do not solve it by broadly granting cashiers inventory writes.

### P1.2 — Account lifecycle and device security

#### P1-04

Implement minimal owner-controlled account provisioning, disabling, password recovery, and role assignment without shipping privileged keys. Restrict the currently enabled public signup path so it cannot automatically confer cashier privileges. Replace localhost-only confirmation/recovery routing with approved destinations, implement the link flow, and qualify email delivery/throttling against the recorded 2/hour quota. Give both roles a POS-first route after profile/permission resolution; eliminate role-loading flashes.

Owner-approved 2026-10-06 procedure: create/confirm separate email login accounts in Supabase's Manage Users dashboard, then approve cafe access and assign roles in Patanos. No in-app Auth account/password creation. Hosted promotion must review and explicitly bootstrap the initial owner; newly created profiles must never automatically become approved cashiers.

#### P1-05

Introduce appropriate native credential storage and lock/unlock behavior. Define logout/account-switch handling that locks protected data but never deletes unsynced transactions; show actionable sign-out/session errors.

#### P1-06

Implement previously enrolled offline staff access with separate identities, bounded cached authorization, local unlock protection, attempt limits, and reconnect revalidation. Document session expiry, disabled-user handling, lost-device response, and how already-recorded sales remain recoverable after revocation.

### P1.3 — Secrets, storage, and audit boundaries

#### P1-07

Review tracked environment files and repository history without printing secret values. Replace tracked local configuration with a safe template and appropriate ignores; rotate private credentials only if exposure warrants it. Public Supabase configuration is not a service-role credential.

#### P1-08

Enforce image upload authorization, allowed formats, byte limits, and cleanup rules at the appropriate client/server boundaries. Restrict audit and monitoring access; document retention and redaction for transaction metadata and optional delivery details.

#### P1-GATE

Staging negative tests prove no cashier self-promotion, unauthorized role assignment, anonymous reporting, unauthorized RPC execution, or direct mutation bypass. Account disable/logout/offline-lock scenarios pass on Android; document the unavoidable offline-revocation window.

## P2 — Make orders, payments, and stock effects transactional

**Outcome:** A sale has one durable identity, is validated consistently, and cannot be charged, cancelled, or deducted from stock twice through retries.

**Primary areas:** `CartContext`, `validateOrder`, `useOrders`, order RPCs, triggers, schema migrations, and shared domain helpers.

### P2.1 — Domain validation and immutable history

#### P2-01

Implement shared money/quantity rules: finite numeric input, integer quantities within supported limits, required item IDs, supported enums, and deterministic modifier-inclusive totals. Enforce equivalent server checks; document and test migration from the current one-peso tolerance.

#### P2-02

Validate selected variant, published/available modifiers, group targeting, minimum/maximum selections, and required choices. Preserve cart edit values; distinguish lines with different notes or selections. Add regression tests for every identified modifier/cart defect. Include the approved three-pizza bundle: exactly three permitted flavors (repeats allowed), catalog-derived PHP 99 price, quantity multiplication, immutable composition and rejection of invalid/short-stock selections; no parent/child double charging.

#### P2-03

Define and migrate immutable sale/item/payment snapshots, catalog versions, original staff/device/shift identity, occurrence and receipt timestamps, and Asia/Manila business dates. Preserve legacy records and clearly label unknown historical metadata instead of fabricating it. Snapshot bundle parent price and child flavors/quantities; define deterministic revenue allocation (proposed PHP 33 per pizza for this equal-price bundle) without recognizing parent and child revenue twice.

### P2.2 — Replay-safe server operations

#### P2-04

Add stable client-generated sale and operation IDs with database uniqueness and replay handling. Repeating an accepted operation returns its original result; reusing an ID with a different payload fails visibly. Cover online submissions as well as offline sync.

#### P2-05

Implement atomic creation, payment, and cancellation operations with server authorization, expected-state/version checks, amount validation, and returned committed state. Concurrent pay/pay and pay/cancel attempts must produce one valid outcome, not false success.

#### P2-06

Reconcile triggers and new operations so item stock effects occur exactly once. Define unpaid-order reservation/consumption, cancellation release versus waste, and refund restock rules; eliminate duplicate effects between legacy triggers and new movement records. Cover insufficient-stock clamping, repeated cancellation, multiple lines of the same tracked variant, and the 2026-10-05 cashier/invoker-trigger restoration failure. Verify stock effects through authorized server operations without granting general cashier inventory mutation.

### P2.3 — Offline compatibility and reporting semantics

#### P2-07

Define authenticated offline sale ingestion: approved catalog snapshots/price versions, original actor attribution, device authorization, operation ordering, and conflict handling. Never trust an arbitrary client-provided actor or arbitrary stale price; never discard a collected cash sale merely because current stock or price changed.

#### P2-08

Define report recognition using payment/refund occurrence and explicit business-date rules, not delayed sync time or order creation alone. Keep unpaid orders visible across midnight; handle device-clock anomalies and old-format records explicitly.

#### P2-GATE

Database integration tests prove atomic rollback, replay safety after an ambiguous response, payload-conflict rejection, authorization, single payment/cancellation outcome, correct stock effects, and correct money/time handling. Migration and compatibility recovery are rehearsed in staging.

## P3 — Deliver complete offline cash sales and reliable synchronization

**Outcome:** The cafe can operate through an internet outage on its enrolled active device, restart the app, and reconcile later without silently losing or duplicating sales.

**Primary areas:** `offlineQueue`, local persistence layer, `useOrders`, cart/auth contexts, menu caching, sync provider/status UI, and local migrations.

### P3.1 — Durable local transaction storage

#### P3-01

Implement the selected transactional local database and versioned migrations for drafts, orders, payments, outbox events, stock movements, and shift events. Save the sale and its outbox entry together before clearing the cart or showing success; handle disk/write failures without pretending a sale is saved.

#### P3-02

Migrate existing active and dead-letter AsyncStorage queues safely. Preserve the source until migrated rows are validated; make interrupted migrations resumable and deduplicated. Preserve original payloads and mark missing historical attribution for owner review.

#### P3-03

Persist draft carts, the required menu/modifier catalog, and locally relevant open/history orders. Avoid stale cache overwrites; show cache age and usable image fallbacks. Offline cold-start must not depend on refreshing an expired network session before showing authorized local work.

### P3.2 — Cashier-visible offline behavior

#### P3-04

Implement offline Pay & Complete, Save Unpaid, later cash payment, unpaid cancellation, cash tender/change, and local transaction lookup. Use stable local receipt references and explicit Paid — pending sync labels; do not equate payment completion with server acknowledgment.

#### P3-05

Add visible pending/failed counts and a recovery screen with failure reason, retry state, and safe owner actions. Preserve five-attempt dead-letter behavior unless a documented tested replacement is approved. Moving a record to needs-attention must never hide it from sales history or erase its payment.

#### P3-06

Preserve staff/shift attribution across lock, logout, account change, and reconnect. Implement same-device staff switching using locally authorized separate accounts; P6 adds the full counted-cash handover lifecycle. Require synchronization and a verified transfer before changing active selling devices; provide a documented outage fallback when transfer is impossible.

### P3.3 — Synchronization and reconciliation

#### P3-07

Replace stale whole-queue rewrites with per-operation acknowledgments and durable concurrency control. Enqueueing during sync cannot lose a new record. Recover after process death between server commit and local acknowledgment through server replay protection.

#### P3-08

Trigger synchronization on usable connectivity, app startup/resume, and manual retry. Add bounded backoff/jitter and distinguish transport, authorization, validation, and business-conflict failures. Do not consume all attempts just because the device remains offline.

#### P3-09

Reconcile local and remote views by identity, avoiding duplicate display and double-counted totals. Preserve dependency ordering for create/pay/cancel/refund events. Detect clock/catalog/stock conflicts and allow authorized resolution without silently altering paid history or creating a second sale.

#### P3-GATE

On a real Android phone and tablet, complete a simulated offline selling session, force-stop/restart, reopen unpaid orders, collect cash, switch authorized staff on the same device, reconnect, and verify every sale/payment/stock event exactly once. Use fixture shift attribution until P6 implements opening/closing and cash handover. Also pass queue-enqueue race, fifth failure, ambiguous response, expired authorization, low-storage, and interrupted-migration tests.

## P4 — Make product and portion tracking dependable

**Outcome:** Staff can trust counts for tracked drinks, meals, sizes, and packaged items without waiting for ingredient inventory.

**Primary areas:** `useInventory`, `useMenu`, menu/admin inventory screens, product availability, local stock projections, and stock RPCs/ledger.

### P4.1 — Product setup and operational visibility

#### P4-01

Make inventory reachable from owner tools and add a compact POS stock/sold-out indication. Distinguish untracked, tracked, low-stock, unavailable, draft, and archived variants; do not represent unknown stock as zero.

#### P4-02

Create stock records reliably when tracking is enabled and backfill missing records safely. Support size/portion-level opening counts and thresholds; seed and verify the cafe's real drinks and meals menu in staging.

#### P4-03

Make related product/variant changes atomic or explicitly recoverable; surface sibling-update failures. Replace fragile name-only grouping with stable product relationships where needed. Archive sold products/modifiers instead of deleting referenced history. Define bundle-to-flavor portion relationships: each three-pizza bundle reserves/consumes three actual flavor portions, including repeated flavors; payment/retry cannot consume them again. Cover cancellation dispositions per component and no synthetic bundle-only stock count.

### P4.2 — Auditable stock movements

#### P4-04

Replace unsafe absolute count overwrites with authorized movement operations or version-checked counts. Record opening stock, additions, sales/reservations, cancellations, returns, waste, and corrections with actor, reason, time, and unique operation identity.

#### P4-05

Implement cycle counts that account for sales occurring during counting, with a clear effective time/version. Save threshold and tracking configuration consistently; prevent a stale edit from silently undoing later sales or tracking changes.

#### P4-06

Implement available-to-sell projections including local unsynced activity on the active device. Prevent normal overselling of known local stock; flag unavoidable reconciliation discrepancies instead of rejecting already-paid offline sales out of existence.

### P4.3 — Cancellation, refund, and sale verification

#### P4-07

Verify cashier cancellation can perform its authorized stock effect without requiring unrestricted inventory writes or silently updating zero inventory rows. Aggregate all same-variant order-line quantities for eligible restoration. Prepared drinks/meals marked waste must not automatically return to sellable stock; refunding money and restocking are separate explicit decisions.

#### P4-08

Add stock movement history, low-stock states, error/retry feedback, and owner adjustment controls. Test no double deduction when saved unpaid orders are paid, replayed, or viewed from another device after handover.

#### P4-GATE

A scripted drinks/meals trading day reconciles opening portions + additions − consumed/wasted portions + valid returns to closing stock. Online/offline sales, concurrent adjustments, cancellation, replay, and archived product history all pass with explainable movement records.

## P5 — Redesign the Android POS experience

**Outcome:** The main path feels like a counter-service tool, not a content-management dashboard. Design work starts in P0; this phase completes integrated behavior against the hardened transaction layer.

**Primary areas:** auth/root/POS layouts, `app/(pos)`, `src/components/pos`, shared controls, menu selectors, and existing theme tokens. Keep route files focused on orchestration.

### P5.1 — Navigation, theme, and responsive shell

#### P5-01

Route both staff roles directly to POS after authorization. Make POS, Orders, and Shift the main destinations; expose owner tools as a secondary role-protected destination. Keep gallery and less-used content management out of checkout navigation.

#### P5-02

Implement responsive phone and tablet layouts using actual available width and safe-area insets. Enable and verify tablet landscape/orientation changes without losing cart/payment state; do not stretch the phone layout into a tablet screen.

#### P5-03

Refine Electric Mango through existing colors, type, spacing, and radii: clear totals, restrained accent use, readable supporting text, consistent dialogs, and visible selected/error/disabled states. Review contrast and remove decorative font dependence from critical transaction text.

### P5.2 — Menu discovery and accurate cart editing

#### P5-04

Add responsive local menu search by name/category and useful variant terms, clear search/reset states, and category navigation. Show product name, price/from-price, availability, and portion state without requiring image loading.

#### P5-05

Let a simple single-variant item without required choices enter the cart in one tap. Open a focused variant/modifier sheet when decisions are required; keep defaults explicit and validate requirements before adding. Optional customization stays easy to reach. Bundle selection shows three flavor slots, fixed PHP 99 total, repeat selection and per-flavor availability; cart/edit/history preserve its composition with fewer steps than manual discount entry.

#### P5-06

Preserve selected size, modifiers, quantity, and notes when editing. Add large increment/decrement/remove targets, clear item price breakdowns, and reversible removal where safe. Never merge different preparation notes into one ambiguous row.

### P5.3 — Fast checkout and saved orders

#### P5-07

Provide clear Pay & Complete and Save Unpaid actions. Default the service type to the normal counter workflow while keeping takeout/delivery one easy selection away; optional delivery/name notes must not become mandatory counter-service fields.

#### P5-08

Create a keyboard-safe checkout with prominent total, cash/GCash choice, exact-cash shortcut, useful tender shortcuts, and visible change. Persist entered values on failure; prevent duplicate submission and unsafe dismissal while saving; provide truthful retry/recovery feedback.

#### P5-09

Add a concise confirmation with paid amount, method, reference, sync state, and New Order action. Keep unpaid orders easy to reopen and pay later; search operational history by reference/time/status without a silent 50-order cutoff. Preserve open orders across business dates.

### P5.4 — Accessibility and feedback

#### P5-10

Use at least 48-dp interactive targets for primary touch controls, adequate spacing, accessible labels/roles/states, predictable focus, and readable text scaling. Test TalkBack, large text, keyboard overlap, system navigation areas, and portrait/landscape transitions.

#### P5-11

Design loading, empty, error, offline, syncing, stale-data, and needs-attention states for every affected screen. Replace false empty results with recoverable errors; provide startup/font-loading failure fallbacks; synchronize catalog/modifier/category subscriptions and report refresh rules without leaks or stale cache overwrite.

#### P5-12

Test the prototype and implemented screens with the actual owner/cashiers. Record tap counts, mistakes, completion time, and feedback for common drink and meal orders; improve friction and confirm results on the smallest phone and landscape tablet in the supported matrix.

#### P5-GATE

Owner/cashiers complete the agreed representative flows without guidance on both device classes. No clipped payment actions, inaccessible critical controls, lost edits, duplicate submissions, or admin-first redirects remain. Screenshots and scenario results are recorded for normal and failure states.

## P6 — Add daily cafe controls and trustworthy reporting

**Outcome:** The owner can explain money and stock at the end of each shift, including offline sales and recorded corrections.

**Primary areas:** shift/account controls, payment/refund operations, order history, reports, owner tools, audit records, and sync events.

### P6.1 — Shift opening, handover, and close

#### P6-01

Implement one active register/shift policy, opening cash float, named cashier assignment, and an owner-approved handover flow. Support the owner's cashier role without shared credentials; prevent overlapping active ownership during connected device changes.

#### P6-02

Record cash paid-in/paid-out movements with reasons and permissions. Compute expected drawer cash as opening float + cash sale receipts before refunds + paid-in − cash refunds − paid-out. Count tender minus change as the sale receipt, subtract each refund only once, and keep GCash outside drawer cash.

#### P6-03

Implement closing count, expected-versus-counted variance, explanation, and immutable close/handover records. Support local offline close/handover and later synchronization; mark totals provisional while relevant operations need reconciliation.

### P6.2 — Payment correction, refunds, and GCash

#### P6-04

Add owner-authorized refunds linked to original sale/items, bounded by the remaining refundable amount/quantity. Require reason, method, actor, shift, unique operation ID, and explicit restock/waste choice. Test repeated and concurrent refund attempts. Initial pizza-bundle refunds are whole-bundle units bounded by PHP 99 per bundle; no arbitrary partial component refunds. Prepared portions are not automatically restocked.

#### P6-05

Support safe offline owner cash refunds for locally verifiable sales on the active device, with durable payment/stock/shift events and no cross-device over-refund promise. If original payment/refund history cannot be established, require reconciliation before proceeding; never erase the original sale.

#### P6-06

Record manual GCash payments and references with an explicit staff-confirmation state. Document verification when either device lacks connectivity, duplicate-reference review, and daily merchant-record matching. Do not imply the app transfers or refunds GCash; actual transfers/refunds remain an external manual action and are recorded with evidence/reference.

### P6.3 — Reports and minimum owner administration

#### P6-07

Rebuild sales summaries around Asia/Manila business dates and payment/refund occurrence. Separate gross sales, refunds, net sales, cash/GCash, unpaid balances, and pending-sync totals. Use immutable category/item snapshots so menu edits do not rewrite history.

#### P6-08

Add date-range history, pagination/search, transaction detail, refund/cancellation links, and reconciliation/export capability for the owner. Show freshness and incomplete-sync warnings; verify no local/remote double counting or midnight filtering errors.

#### P6-09

Finish only the owner tools needed to operate: product/portion setup, availability, staff access, shifts, reconciliation, and recovery. Confirm management mutations have success/error feedback and audit trails; keep gallery/content polishing deferred.

#### P6-GATE

Reconcile a complete simulated day: opening float, cash and GCash, unpaid orders, waste, cash movement, refund, staff handover, midnight boundary, offline close, and delayed sync. Drawer variance and report totals match the independent expected ledger, with explanations for any intentionally provisional records.

## P7 — Prove reliability and prepare a release candidate

**Outcome:** There is fresh, repeatable evidence that the actual Android application and staging backend work together under normal and failure conditions.

### P7.1 — Automated regression and security coverage

#### P7-01

Complete unit/component coverage for money, modifiers, cart identity/edits, timezone boundaries, state transitions, stock movements, shifts, and UI failure states. Make the critical assertions part of CI; a coverage percentage alone is not a release gate.

#### P7-02

Run database authorization/integration suites using real staging roles and transactional failure injection. Cover replay IDs, anonymous access, self-promotion, forged actor/price/status, refund limits, concurrent stock changes, and migration compatibility.

#### P7-03

Automate core Android device journeys and run controlled interruption tests: airplane mode, flapping connectivity, timeout after commit, app kill, startup already online, background/resume, account switch, and stale catalog. Include unpaid-to-paid and cancellation/refund dependency ordering.

### P7.2 — Device, performance, and local operational checks

#### P7-04

Install a signed release-candidate build on actual cafe phone/tablet hardware. Test orientation, large text, TalkBack, keyboard, prolonged trading use, low storage, large order history, and realistic menu/image load. Measure startup/search/cart/checkout responsiveness against P0 targets.

#### P7-05

Provide actionable in-app operational signals: oldest pending sale, failed sync count, queue growth, stock conflicts, cash variance, and authorization failures. Verify visible warnings, a named owner response procedure and privacy-safe diagnostic handling, including while offline. Hosted crash/error alerts and release/source-map attribution are deferred to P12; this task does not require Sentry or another external monitoring service.

#### P7-06

Re-run dependency/security and Expo compatibility checks against the release lockfile; resolve or formally triage findings with exploitability and mitigation evidence. Resolve all release-blocking security/transaction failures and re-run affected tests after fixes.

### P7.3 — Recovery and safe releases

#### P7-07

Document and rehearse backend backup/restore and local unsynced-data recovery using non-production data. Define acceptable recovery time/data loss with the owner, secure any export/import mechanism, and prevent replay duplication after restore. State clearly what cannot be recovered from a destroyed device while fully offline.

#### P7-08

Test application/local-database/server migrations across supported upgrade paths with non-empty queues. Design rollback or forward recovery that does not downgrade away new transactions; block incompatible old clients from unsafe writes while preserving their recovery path.

#### P7-09

Finalize environment separation, Android signing ownership, build/version identifiers, release distribution, and operational documentation. Replace starter README content and stale commands; document outage, dead-letter, lost-device, cash-discrepancy, and owner-access recovery procedures.

#### P7-GATE

CI, staging security/integrity suites, real-device checks, and restore/upgrade drills have recorded passing evidence for the exact release candidate. No known order-loss, duplicate-payment/stock-effect, unauthorized access, or unexplainable reconciliation blocker remains. Owner accepts documented residual limitations.

## P8 — Run a controlled cafe pilot and hand over production

**Outcome:** The cafe demonstrates operational readiness, then deliberately adopts the POS. A build that passes tests is not automatically a completed pilot.

### P8.1 — Pilot preparation

#### P8-01

Confirm owner approval for the pilot, required local business obligations, real menu/portion counts, staff accounts, shift procedures, and device ownership. Decide release distribution and support contacts; printing/tax features move into scope if the applicable requirements demand them.

#### P8-02

Prepare a paper/manual fallback with unique references and a controlled later-entry/reconciliation procedure. Train staff on paid-versus-synced status, pending sales, refunds, GCash verification, active-device handover, and never clearing unsynced app data.

#### P8-03

Set an owner-approved pilot observation period and measurable success criteria: no unexplained missing/duplicate sales, reconciled money/portions, recoverable sync failures, and staff completing core flows independently. Include representative busy service and a planned outage drill; no calendar deadline overrides failures.

### P8.2 — Supervised operation and final release

#### P8-04

Run the supervised pilot with independent daily reconciliation, issue logging, and monitored recovery. Correct defects, reopen affected earlier gates, and repeat relevant scenarios; do not count duplicate shadow entries as new real sales.

#### P8-05

Review pilot results and obtain explicit owner go/no-go approval. With separate authorization, apply verified production migrations/configuration, seed approved real configuration, install the approved release, and perform smoke checks without fabricated business transactions in revenue reports.

#### P8-06

Deliver owner runbooks, signing/account custody, backup schedule, local operational warning ownership, support/escalation procedure, and a post-launch review cadence. Verify staff can perform daily close and identify unresolved sync records without a developer. Hosted Sentry ownership applies only if optional P12 is adopted.

#### P8-GATE

Pilot success criteria and production smoke checks are evidenced, open critical issues are zero, rollback/recovery and support are ready, and the owner signs off. Mark the required release scope complete only now; optional phases remain separate.

## P9 — Optional receipt and thermal printing

**Prerequisite:** P8 complete, unless a mandatory operating requirement brings printing forward.

### P9.1 — Hardware and receipt requirements

#### P9-01

Identify the actual printer model, paper width, Android connectivity (Bluetooth/USB/network), supported protocol, driver/library options, and permissions. Validate hardware compatibility before selecting a dependency.

#### P9-02

Design receipt content, PHP formatting, shop details, transaction/payment references, and reprint labels; confirm any applicable receipt requirements with the owner. Keep transactional history usable without a printer.

### P9.2 — Printing integration and recovery

#### P9-03

Add optional print/reprint jobs after durable sale completion, with clear disconnected/paper-out/retry feedback. Printing failure must not undo a sale, duplicate a payment, or block the next customer.

#### P9-GATE

Real-printer tests pass for cash/GCash, offline sales, interrupted printing, reconnection, and labelled reprints on supported phone/tablet hardware. Document setup and troubleshooting.

## P10 — Ingredient and recipe inventory

**Prerequisite:** Product/portion tracking is stable and the cafe has validated its actual recipes and counting process.

### P10.1 — Recipes, units, and receiving

#### P10-01

Model ingredients, purchase units, preparation units, conversion factors, supplier receipts, and count precision. Confirm actual drink sizes and meal portions with the owner rather than assuming standard recipes.

#### P10-02

Add versioned recipes and modifier consumption rules, yield/preparation batches where needed, and migration from portion-only tracking without losing historical stock records.

### P10.2 — Consumption and reconciliation

#### P10-03

Implement atomic, replay-safe ingredient consumption and explicit waste/return behavior across online/offline sales. Prevent double consumption when both finished portions and recipe ingredients are tracked.

#### P10-04

Add ingredient counts, variance reports, low-stock guidance, and recipe costing after the quantity model is verified. Keep POS sale speed independent of owner inventory forms.

#### P10-GATE

Run a measured recipe/portion pilot using real preparation quantities; explain differences between expected and counted ingredients. Replay, refund, waste, and offline recovery tests pass without corrupting the established portion ledger.

## P11 — Expanded payments, platforms, and administration

### P11.1 — Additional payment and pricing features

#### P11-01

If approved, design split payments and discounts with explicit permissions, rounding, refunds, audit, and reporting rules. Add tax/receipt logic only from confirmed business requirements; assess whether it must precede rather than follow launch.

#### P11-02

If approved, integrate a payment provider using authenticated server-side confirmation, replay-safe callbacks, pending/failed states, reconciliation, and controlled refunds. Never treat a client screenshot or button press as gateway settlement.

### P11.2 — Web, iOS, and broader business workflows

#### P11-03

Repair and independently verify web SSR/storage initialization, destructive-action confirmations, uploads, authentication persistence, and offline architecture before offering web POS. Configure and test signed iOS builds before promising iOS support.

#### P11-04

Refine secondary content management/gallery and evaluate preparation displays, delivery integrations, or multi-location support only when requested. Multi-register/offline concurrency requires a new allocation/conflict design, not just an extra device login.

#### P11-GATE

For each adopted subphase, replace broad backlog items with approved detailed tasks and evidence gates. Mark the entire phase complete only if all adopted scope is delivered and any removed/deferred scope is explicitly documented and approved.

## P12 — Optional hosted error and crash monitoring

### P12.1 — Authorized service setup

#### P12-01

If separately approved, provision/configure Sentry, secure build-only upload credentials, verify uploader installation and select privacy/retention/access settings. Keep collection opt-in and disabled when no matching DSN is configured; never transmit private credentials or payment/customer notes.

### P12.2 — Delivery and diagnostics qualification

#### P12-02

On an authorized staging native candidate, verify actual safe event receipt, correct release/environment, useful source maps, privacy filtering and actionable alert ownership. Qualify native crash collection before enabling it; a mocked test, bundle export or SDK flush is not delivery evidence.

#### P12-GATE

Hosted delivery, diagnostics, alerts, native privacy where enabled and owner response procedures have dated evidence. Loss of the monitoring service cannot interrupt checkout or durable local sales. No initial-release completion depends on this optional gate.

## 7. Finding-to-plan traceability

The finding identifiers refer to the [original assessment](../assessments/currentImplementation.md). Additional rows cover its unnumbered inventory, UI, and operating gaps. Revalidation can change severity or confirm a fix; it must not silently erase the record.

| Finding / gap | Primary implementation coverage |
| --- | --- |
| S01: Own-profile role escalation | P1-01, P1-GATE, P7-02 |
| S02: Reporting-view access | P1-02, P6-07, P7-02 |
| S03: Broad order/child mutations | P1-03, P2-05, P7-02 |
| S04: RPC privilege/validation uncertainty | P0-02, P1-03, P2-04–P2-07 |
| S05: Dependency findings | P0-01, P7-06 |
| S06: Session persistence / staff device access | P1-04–P1-06, P3-06 |
| S07: Tracked environment file | P1-07 |
| S08: Upload/storage hardening | P1-08 |
| O01: Queue rewrite can lose new sales | P0-05, P3-01, P3-07, P3-GATE |
| O02: Retry/ambiguous response can duplicate | P2-04, P3-07, P7-03 |
| O03: Incomplete offline sales/recovery | All P3; P6-03/P6-05; P7-07 |
| O04: Payment/cancellation races and fragile UI | P2-05/P2-06, P5-08, P6-04 |
| O05: Date/reporting/old unpaid orders | P2-03/P2-08, P5-09, P6-07/P6-08 |
| O06: Required/draft/wrong-variant modifiers | P2-02, P5-05/P5-06 |
| O07: Cart edit, note merging, draft loss | P2-02, P3-03, P5-06 |
| O08: Non-finite/fractional/invalid payloads | P2-01, P2-GATE |
| Hidden/missing inventory, stale absolute edits, cancellation permissions | All P4 |
| Mutable menu/category history and unsafe deletion | P2-03, P4-03, P6-07 |
| Admin-first routing, portrait lock, touch/keyboard/accessibility | P0-07, P1-04, all P5 |
| False empty/error states, stale caches/realtime/report refresh | P3-03, P5-11, P6-08 |
| Splash/font failure and startup resilience | P5-03, P5-11, P7-04 |
| Missing cash controls, refunds, GCash reconciliation | All P6 |
| No reliable test/CI/staging/recovery evidence; optional hosted monitoring | P0-04–P0-06, all P7; hosted monitoring deferred to P12 |
| Starter docs, release-version/signing/build gaps | P0-06, P7-09, P8-06 |
| Optional printer, ingredient inventory, broken web path | P9, P10, P11-03 respectively |

## 8. Non-negotiable release evidence

The relevant phase gates must attach evidence for these scenarios. This matrix does not create a second set of progress checkboxes.

| Scenario | Evidence required | Gate |
| --- | --- | --- |
| Anonymous/cashier attempts privileged actions | Negative authorization tests against staging, including direct API calls | P1, P7 |
| Same operation arrives more than once | One sale/payment/stock effect; identical replay result; payload conflicts rejected | P2, P7 |
| Cash sale while offline, then force-stop | Paid local sale, original staff/shift, and stock survive restart | P3, P7 |
| New sale added during sync | Both records retained; neither lost nor duplicated | P3, P7 |
| Commit succeeds but response is lost | Replay resolves original result without a second sale | P2, P3, P7 |
| Saved unpaid order paid/cancelled later | One guarded outcome and one appropriate stock effect | P2–P4 |
| Fifth sync failure or revoked account | Visible recoverable record, no silent deletion or actor reassignment | P1, P3 |
| Price/catalog/stock changes during outage | Paid history preserved; explicit conflict and authorized reconciliation | P2–P4 |
| Drink prepared, then cancelled/refunded | Waste and money correction handled separately from sellable restock | P4, P6 |
| Manual GCash | Staff confirmation and reconciliation recorded; no false gateway verification | P5, P6 |
| Midnight and delayed next-day sync | Correct Asia/Manila sale/refund date and shift; unpaid orders remain visible | P2, P6 |
| Staff/device handover | Correct identities; no concurrent active device assumption during outage | P1, P3, P6 |
| End-of-day cash and portions | Independent expected ledger matches reports and counted stock/cash | P4, P6, P8 |
| App/database upgrade with pending events | No deleted queue, duplicate replay, or incompatible silent write | P7 |
| Phone/tablet real service flow | Accessible, unclipped UI; required payment/stock/offline checks on signed build | P5, P7, P8 |
| Backup restore / lost device | Timed recovery drill and explicit limits for unsynced data | P7, P8 |

Mocked tests, native bundle export, live backend tests, and real-device acceptance are different evidence types. Record which was performed. No single type substitutes for all the others.
