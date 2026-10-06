# P0.1 Architecture Decisions

Date: 2026-10-04

Scope: P0-03 in the [implementation plan](implementationPlan.md). These are development decisions and explicit qualification gates. They do not claim the corresponding application behavior exists yet.

Basis: the owner's answered operating questions, the [readiness assessment](assessments/currentImplementation.md), and the freshly inspected cart, validator, order hook, offline queue, authentication, stock hook, and database snapshot.

Status vocabulary: **Selected** means the development direction is settled. **Qualification pending** means a technical spike or device check must validate it before integration. **Owner confirmation pending** means the stated working default can be changed before its implementation gate.

## ADR-01 — Scope, roles, and order lifecycle

**Selected.** One cafe, one active selling register/device at a time, separate owner and cashier identities, Android phones/tablets, PHP, and cash/manual GCash. Both roles enter the POS after authentication and role resolution. Owner tools remain secondary and must have server authorization.

The supported order path is draft -> open/unpaid -> paid, or draft -> immediate paid sale. Cancelling is permitted only for unpaid orders; paid corrections use refund records. Keep the current database `completed` value mapped to paid/settled until a deliberate schema migration changes it. Do not interpret payment as proof of preparation or handoff. Preserve `dine-in`, `takeout`, and `delivery` values; any clearer counter-service UI label must map to those values explicitly.

Save Unpaid creates a durable operational order. Pay & Complete creates a durable paid sale without requiring a prior visit to the open-orders screen. Cashier payment access does not imply permission to refund, change stock, or change historical prices.

**Implementation gates:** P1 account/RLS tests; P2 atomic creation/payment/cancellation; P5 usability acceptance. No new kitchen state or delivery dispatch service is required.

## ADR-02 — Transactional local storage and submission

**Selected; qualification pending in P0.2/P3.** Use Expo SQLite as the proposed Android sales database, with versioned migrations, foreign-key enforcement, parameterized statements, and exclusive transaction boundaries for related writes. AsyncStorage remains suitable for preferences and rebuildable cache; it stops being the financial outbox after migration.

The local database stores sale/item snapshots, payment/refund records, stock/shift events, drafts, and an outbox. Persist the sale and all associated outgoing operations in one transaction before clearing the cart or showing success. Record acknowledgments per operation; never replace a queue from a stale snapshot. The app reads its unified local view and reconciles acknowledged remote data by stable identity.

Use the same local persistence path for online and offline actions. Connectivity determines when to submit, rather than whether a sale receives durable local protection. Local acceptance, server acknowledgment, and reconciliation are distinct states. A server rejection of a collected cash sale produces an owner-visible exception; it cannot silently erase or reprice it.

SQLite persists across app restarts, but uninstall, data clearing, device loss, and physical storage failure need a separate recovery strategy. Its existence does not prove recovery works. SDK 54's [Expo SQLite documentation](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/) supports the library choice; transaction concurrency, crash recovery, and migration behavior must be qualified on devices.

**Implementation gates:** P0-03 records this choice; the P0.2 technical spike establishes API/build compatibility; P3 passes concurrent enqueue, disk failure, restart, interrupted migration, and ambiguous-commit scenarios. Preserve the old queues until migration is verified.

## ADR-03 — Stable identity, ordering, and server authority

**Selected.** Generate collision-resistant IDs for sales and each business operation using a platform cryptographic UUID implementation qualified for the installed SDK. Create IDs once, persist them, and reuse them for retries. Staff/device/shift IDs and original occurrence time travel with the operation; an order number is a display reference, never a deduplication key.

The server maintains unique operation identities, expected-state/version checks, payload consistency, and atomic financial/stock effects. An identical replay returns the original committed result. The same identity with a different payload is an error. Direct table writes must not bypass guarded creation, payment, cancellation, refunds, or stock adjustments.

Operation ordering is per sale and dependent event: create precedes pay/cancel, and accepted payment precedes refund. One logical sync coordinator owns the process; durable state handles restart recovery, while local locks prevent overlapping processors. Preserve the current five-attempt needs-attention transition until a tested replacement is intentionally approved. Offline time alone must not consume retries.

**Implementation gates:** P1 grants/RLS; P2 real-role database integration and atomic rollback tests; P3 replay/restart tests. The supplied P0-02 export confirms the current `place_order` has an authentication guard and atomic creation, but no replay key, staff-role check, or catalog/total derivation. See the [SQL review](evidence/P0-foundation.md#database-and-auth-review).

## ADR-04 — PHP money and rounding

**Selected.** Represent application money as safe integer centavos. Parse entered decimal text explicitly to a maximum of two decimal places; reject non-finite values, unsupported formats, negatives where disallowed, and arithmetic overflow. Require integer item quantities. For the initial scope, prices and modifier extras have no fractional-cent rounding stage: sum their centavos, then multiply by quantity.

Database boundaries use a consistent integer-centavo or exact decimal representation selected in the P2 migration. Convert explicitly and round-trip exactly. Item unit price already includes modifiers; totals must never add those modifiers twice. Preserve separate base/modifier snapshots for explanation.

Example: PHP 95.00 base + PHP 15.50 extra = 11,050 centavos per item. Two items total 22,100 centavos. PHP 300.00 tendered returns 7,900 centavos change. GCash does not affect cash tender/change or the physical drawer.

The existing one-peso validation tolerance remains untouched by P0.1. P2 replaces it only after client/server contracts, queued legacy prices, and historical conversions are tested together. New-format totals require exact centavo agreement. Legacy mismatches become explicit migration/reconciliation cases, not silently adjusted historical sales.

**Implementation gates:** P2 money validation and legacy-queue compatibility tests. No discounts, split tender, or tax calculations are introduced by this decision.

## ADR-05 — Catalog versions and offline pricing

**Selected.** Persist an approved catalog version with immutable item/variant/modifier prices and selection rules. Validate new orders against the device's usable approved catalog and preserve that version in each sale. The server must retain enough catalog history to verify accepted offline prices and choices.

The server checks authorized catalog provenance and operation permissions; it must not accept arbitrary prices just because the client supplies a catalog ID. If prices or availability change after cash was collected, keep the original paid snapshot and report the conflict. Do not silently apply today's price to yesterday's offline transaction.

Expired catalogs, removed products, implausible timestamps, and stock shortages require distinct conflict reasons. Current availability controls new sales after refresh; historical references remain valid. Archive referenced menu/modifier data rather than deleting it.

**Implementation gates:** P2's offline-ingestion contract and negative tests; P3 stale-catalog recovery; P4 archive/history verification. The exact catalog validity interval and server storage schema are implementation choices to settle in P2-07.

## ADR-06 — Staff authorization and bounded offline access

**Selected direction; 72-hour working default awaiting owner confirmation by P1-06.** First device enrollment and first authorization of each staff account require online owner-approved access. Cache a server-authorized, device-bound permission record for each permitted staff identity. Distinguish local unlock from a successful Supabase online login.

Use a maximum 72 hours since successful server role/device validation as the initial offline-selling window. This covers multi-day connection interruptions while placing a limit on stale account access. Do not renew that window through local unlock alone. Show remaining eligibility and revalidate on reconnect. Beyond the limit, preserve existing records and provide owner recovery/manual fallback rather than deleting the queue or inventing authorization.

Use native protected storage for sensitive session/device secrets and an appropriate separate local unlock credential for each staff identity. Qualify secure token storage, size handling, rate limits, background locking, and reset behavior in P1. A cashier must not acquire an owner's offline grant simply by editing a profile/cache row. Remote operations must validate permission provenance and cannot trust a supplied `created_by` field.

Remote revocation is delayed while offline. Cached grants and device timestamps are not proof against a fully compromised device. Define clock rollback/tamper detection and an auditable review path for delayed submissions. Disable future authorization after reconnect while keeping previously collected sales available for authorized reconciliation.

Logout/account change locks access but retains transactional data and its original actor. Never store a service-role key on the device. [Expo SecureStore for SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/) is the proposed secret store, not the sales backup.

**Implementation gates:** Owner confirms the working duration; P1 validates device/account permission boundaries and disabled-user behavior; P3 proves restart recovery with expired online tokens. Changes to the working duration require a dated decision update.

## ADR-07 — Portion reservations, cancellation, waste, and refunds

**Selected direction; disposition wording reviewed with the owner before P4 acceptance.** Track available quantities per variant/portion before ingredient recipes. Opening physical/countable portions, active reservations, consumption, returns, waste, and owner adjustments are separate auditable movements.

Saving an unpaid order reserves its tracked portions. An immediate paid sale consumes portions once. Paying a reserved order converts reservation to consumption without reducing available stock a second time. Replays must not repeat any effect. This is a target ledger model; inspect the actual trigger bodies before replacing their current decrement/restore behavior.

For unpaid cancellation, record whether the item was unprepared and can be released, or prepared/discarded and is waste. When preparation is unknown, default to no sellable return pending review. Cashiers may perform the narrowly authorized cancellation/release through a guarded operation, without general stock-edit access. This decision adds a cancellation disposition, not a preparation display workflow.

Refunding money does not automatically restock a prepared drink or meal. Start with full-sale or whole-item-quantity refunds by the owner, bounded by previously paid and still-refundable amounts. Cash refunds and external manual GCash refunds have separate references. Restock only explicitly verified returnable quantities; otherwise retain consumption or record waste as appropriate.

**Implementation gates:** P2 exactly-once effects and refund-compatible schema; P4 independent portion ledger reconciliation; P6 refund limits, manual GCash accounting, and audit. Absolute count edits must not overwrite sales that happened during counting.

## ADR-08 — One active selling device and controlled handover

**Selected.** Either an Android phone or tablet may sell, but the first release assumes one active selling device for the location. Other connected devices may provide owner views where authorized. Simultaneous offline selling on separate devices is outside the initial stock-consistency guarantee.

Same-device cashier changes use separate authorized identities and preserve pending records, shift attribution, counted cash, and later sync. P3 supplies identity preservation; P6 supplies opening float and counted-cash handover/close.

Changing active hardware requires the old device to finish synchronization, reconcile outstanding exceptions, and transfer ownership through a guarded handover. The new device receives the approved catalog, open orders, stock, and shift state before selling. During an outage, continue on the original device; if unavailable, use the documented manual fallback until ownership and pending data are reconciled. Do not create a second assumed shared offline register.

**Implementation gates:** P3 device/staff attribution and controlled sync; P6 handover/shift tests; P7 lost-device recovery. Multi-register allocation is a separately approved later design.

## ADR-09 — Business dates, cash recognition, and history

**Selected.** The initial business day uses midnight in `Asia/Manila`, independent of server UTC and device display timezone. Store UTC instants plus explicit business-date and shift membership. Keep event occurrence separate from server receipt/sync time.

Recognize paid cash/GCash on the payment occurrence date; recognize refunds on their occurrence date and link them to the original payment. Order creation alone does not make revenue. Pending local figures are visibly provisional until reconciliation. Cashier shifts may cross midnight without hiding unpaid orders or splitting their ownership unexpectedly.

Expected drawer = opening float + cash sale receipts (tender minus change) + paid-in - cash refunds - paid-out. Subtract refunds only once. GCash is reconciled separately against merchant records. Never sum local and remote representations of the same sale twice.

Do not assume device time is trustworthy. Detect implausible or rolled-back clocks and route disputed business dates for owner resolution while retaining the original timestamps. Preserve unknown historical fields as unknown; do not manufacture past actor/payment/category snapshots.

**Implementation gates:** P2 timestamp/history contract; P6 midnight, delayed-sync, refund, and cross-midnight-shift reconciliation tests.

## ADR-10 — Android qualification matrix and UI architecture

**Selected matrix; actual cafe device details pending P0-08.** Preserve Expo Router routes, feature components, contexts/hooks, Supabase boundaries, and Electric Mango tokens. Use measured available width for layouts; enable tablet landscape later in P5. No replacement theme, browser-only UI framework, or kitchen dashboard is required.

The inspected native toolchain uses minimum API 24, compile/target API 36. This is build configuration, not evidence that all those devices work. Qualify the matrix below before claiming support. Add the owner's actual device models and Android versions when available; test on both actual classes before release.

| ID | Target | Required checks | Resolution gate |
| --- | --- | --- | --- |
| Q1 | Compact phone, 320–360 dp available width, portrait | Cart, modifier sheet, keyboard-safe payment, 48-dp controls, large text | P5/P7 |
| Q2 | Regular phone, roughly 390–430 dp available width | Cash/GCash, unpaid orders, offline restart, TalkBack, prolonged use | P5/P7 |
| Q3 | Tablet portrait, 600–800 dp available width | Responsive grid/cart, text scaling, system bars, rotation state | P5/P7 |
| Q4 | Tablet landscape, at least 960 dp available width | Side cart, fast search/checkout, keyboard, orientation changes | P5/P7 |
| Q5 | Minimum API 24 compatibility emulator/device | Installation/startup, native storage/security APIs, core offline flow | P0.2/P7 |
| Q6 | Target API 36 emulator/device | Native build, edge-to-edge insets, background/resume, permissions | P0.2/P7 |
| Q7 | Actual cafe phone and tablet | Signed candidate, real menu, crash recovery, whole trading session | P0-08 captures models; P7/P8 verify |

An API/image mismatch or unsupported older device may require a documented support-floor decision before release. Do not silently raise the supported floor based on a desktop build. iOS and web remain independent later qualification targets.

## ADR-11 — Dependency remediation and development evidence

**Selected.** Preserve the current SDK 54 baseline during P0.1 evidence capture. Plan SDK-compatible patch updates first, with lockfile review, lint, native build, and regression checks in the development foundation. Investigate runtime pathways separately from developer/build dependencies.

Do not apply `npm audit fix --force`: the fresh audit suggests an Expo 44 downgrade and unrelated major updates for some transitive chains. Those suggestions are not a coherent Expo/RN release strategy. If supported patches cannot resolve a release blocker, propose one coordinated SDK upgrade with a separate compatibility/migration record.

Add proper test tooling and CI in P0.2. Ad-hoc baseline diagnostics are defect reproductions, not a passing automated suite. Record failed checks accurately; passing baseline completion means the baseline was collected and triaged, not that the application is safe for production.

**Implementation gates:** P0-05 toolchain/tests; P7 updated audit and exact release-candidate checks.

## ADR-12 — Interim P1 server mutation boundary

**Implemented locally, 2026-10-06; not remotely promoted.** Even owner clients cannot directly write orders or their children. Checked staff RPCs derive actors, catalog prices/snapshots, totals, change and timestamps; fixed search paths, invoker write guards and private atomic audits protect this boundary. Any authorized staff member may settle/cancel an open order for single-location handoff. Paid orders require a future refund operation, not cancellation.

Retain the existing one-peso submitted-total tolerance, but store the catalog-derived amount. Reject stale unit/modifier prices rather than silently reprice an unpaid queued order. Brief catalog SHARE locks keep one placement internally consistent; sorted inventory locks and order row locks protect stock and terminal transitions. Measure contention before expanding beyond the single cafe.

Cancellation defaults to **no stock return**; only an explicit whole-order unprepared confirmation releases aggregated portions (ADR-07). Record the disposition and actor. Per-line preparation/waste classification remains P4; wording approval remains OPEN-05. This interim contract does not implement ADR-03 replay identities or ADR-05 paid offline snapshot acceptance. P2/P3 must replace those gaps without silently repricing recorded sales.

**Promotion gate:** review live history/grants and staging fences, coordinate client/schema versions, then repeat genuine API and Android checks with separate authorization. Never apply the empty-database reconstruction to existing sales.

## ADR-13 — Permission-resolved navigation and installed-app recovery

**Navigation and recovery implemented/tested locally; remote/native qualification pending, 2026-10-06.** Both roles enter POS only after a matching server profile resolves. Explicit route guards remove owner screens on demotion; missing/failed permission checks show retry/sign-out, never an owner fallback. These are presentation protections, not replacements for RLS/RPC checks. Same-account token refresh preserves the mounted POS while rechecking; account changes mask the previous identity immediately. Secondary owner tools are pushed above POS and dismissed back to its existing cart rather than creating a duplicate register screen.

The owner selected emailed recovery links opening the matching installed Android app. Use the configured variant schemes: `patanosexpo-development://reset-password`, `patanosexpo-staging://reset-password`, and `patanosexpo://reset-password`. PKCE binds the link exchange to the requesting installation; use the latest email because a new request replaces its stored verifier. The owner approved SDK-compatible `expo-crypto` for native cryptographic randomness/S256; no Math.random/plain-challenge fallback is accepted for this flow. [Supabase PKCE constraints](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [SDK 54 Crypto](https://docs.expo.dev/versions/v54.0.0/sdk/crypto/).

Persist a non-secret recovery gate before exchange can create a signed-in session. Strip the code from native route history; verify the SDK's recovery marker and matching Auth identities; recheck the live user before password update. Recovery locks normal POS/owner navigation, including restart, until confirmed local sign-out and marker cleanup. It does not turn the JWT into a restricted-purpose server token. Password fields stay in component memory and clear after acknowledged success. The form requires 12–64 characters; server password policy/delivery remain separate qualification.

`EXPO_PUBLIC_PASSWORD_RECOVERY_ENABLED` defaults off until the matching exact allowlist and native target are prepared for controlled testing. Existing hosted localhost/redirect settings remain unchanged. Local CLI redirects are applied to the disposable local stack; actual email/native delivery is not qualified. Old APKs without the crypto module refuse recovery requests without breaking ordinary login. Current forms support Android-installed recovery; Expo Go, browser/iOS links, real email quota/delivery and native behavior are not certified. The per-installation sliding two/hour reservation and one-minute spacing provide UX protection, not a replacement for the shared server quota. No email addresses, passwords, link codes or tokens are stored in that reservation record.

Failing an online profile check currently blocks protected UI. This does not establish the 72-hour offline grant or durable draft recovery in ADR-06/P3. Keep those gates open and qualify loss/reconnect behavior before cafe use.

**Implementation gates:** remaining P1-04 lifecycle/recovery, P1-05 credential/lock handling, P1-06 bounded offline identities, staging and actual Android acceptance. No cloud build or remote settings change is authorized by this decision.

## ADR-14 — Dashboard logins, explicit cafe approval

**Owner-approved and locally implemented/tested, 2026-10-06; hosted/device acceptance pending.** Create/confirm individual email logins through Supabase's Manage Users dashboard, then approve roles/access in Patanos Settings. Do not ship privileged keys, create passwords in the app, or build an Auth-admin endpoint for this first release.

Add `profiles.is_enabled`, default false for both existing and future profiles. Ignore signup metadata for role/approval. Only eligible confirmed, non-anonymous, unbanned email accounts can resolve a staff role. Approval and role assignment commit atomically; disabling blocks new protected table/RPC requests from existing JWTs. Preserve own-profile reads for access-denied feedback and existing anonymous published catalog/image reads. Owner Storage writes inherit the active-role check.

Serialize role/approval changes, protect the last **active eligible** owner, and audit accepted access transitions privately. Sale RPCs hold the staff profile lock through their transaction, so a concurrent disable waits for committed work rather than invalidating a half-finished sale. This does not revoke every Auth token or erase cached information; enrolled offline identities, reconnect enforcement and lost-device policy remain P1-05/06. No queue/draft migration is implied.

**Promotion gate:** review current hosted metadata and fences, explicitly bootstrap the reviewed initial owner through a trusted server/SQL operation, then approve only reviewed existing staff. Never bulk-enable historical profiles. The local seed enables only the two published synthetic fixtures. Coordinate schema/client versions and repeat staging/Android checks with separate authorization; the reconstruction is not a production upgrade.

## ADR-15 — Interim session lock and queue-preserving handover

**Locally implemented in part, 2026-10-06.** Owner deferred adding `expo-secure-store`; session tokens and recovery verifiers remain in AsyncStorage. No protected-storage adapter/migration or new dependency was added. Deferral does not waive P1-05 credential protection or the release gate.

Lock on cold restored sessions, manual register lock and AppState background/inactive transitions. Returning to foreground never unlocks automatically: verify the same account's password and live approved profile online. Pause SDK refresh and new POS mutations/retries while locked. No PIN, biometric or bounded offline grant is implemented. An opaque native Modal blocks Back and hides underlying accessibility while retaining the mounted cart. Android window-blur locking is intentionally omitted because app-owned Modals can trigger it; notification shade, recents, screenshot privacy and native behavior remain unqualified.

Track POS mutations, queue persistence and staff-approval RPCs as in-flight leases. Explicit local logout locks immediately, waits up to 15 seconds for tracked work and refuses to report success while it remains unresolved; do not abort financial requests or manufacture acknowledgement. Preserve queue/dead-letter keys. Unsaved drafts are not durable and logout warns about loss. This does not cover every legacy owner-content mutation or recovery/transaction race.

New queued records retain `staffUserId` client metadata. Sync holds other-account and legacy unknown-actor records without retry penalties and invalidates a run on lock/account change. Never silently adopt unknown sales. This metadata is not trusted server authorization; P2/P3 must add verified provenance, migration/recovery, durable concurrent writes and replay identities. Existing queue overwrite/lost-ack defects remain.

Use SDK sign-out scope `local`: other sessions remain, and issued JWTs can remain valid until expiry. Local Auth checks reproduce this; backend role/disable enforcement remains separate. [Supabase sign-out semantics](https://supabase.com/docs/guides/auth/signout).

**Acceptance gates:** encrypted native credential/verifier lifecycle, enrolled bounded offline unlocking, actual Android background/cold-start/keyboard/TalkBack/privacy tests and staged handover/revocation. P1-05 stays unchecked; no remote settings, SQL, cloud build or deployment is authorized here.

## Outstanding decision and access register

These entries make remaining choices explicit; they are not hidden claims of complete downstream implementation.

| ID | Missing fact or decision | Working direction / action | Owner | Must resolve by |
| --- | --- | --- | --- | --- |
| OPEN-01 | Baseline/procedure direction closed; hosted acceptance open | Owner chose dashboard-created logins plus in-app approval (ADR-14). Role/disable/signup boundaries and recovery are locally implemented/tested. Initial-owner bootstrap, hosted signup/redirect/session settings, the shared 2/hour email quota and actual native/staging checks still need controlled qualification. | Developer implements; owner approves hosted setup | P1-04 and P1-GATE |
| OPEN-02 | Phone measurements and unprinted catalog units; later tablet model/qualification | 2026-10-05 phone `SM-A156E/DSN`, Android 16; current test is phone-only. Owner confirms menu prices/portions unchanged. No tablet details needed for the immediate P0.2 phone run; retain Q3/Q4/Q7 qualification before tablet release. No inferred performance. | Cafe owner and developer | P0-08 phone targets; tablet before P5/P7 acceptance |
| OPEN-03 | Offline access duration | Initial 72-hour maximum after server authorization | Cafe owner | P1-06 |
| OPEN-04 | Offline catalog expiry and acceptable historical prices | Approved versioned snapshots; no silent repricing after payment | Owner for policy, developer for server enforcement | P2-07 |
| OPEN-05 | Exact cancellation/restock wording for prepared meals/drinks | Explicit unprepared release versus waste; no automatic refund restock | Cafe owner | P4-07 |
| OPEN-06 | Local encryption, key reset, and recoverable backup tradeoff | Owner deferred expo-secure-store on 2026-10-06 (ADR-15); AsyncStorage credentials remain unprotected. Qualify native secrets before release; assess SQLCipher with tested key/restore lifecycle before enabling it | Developer and owner | P1/P3 storage design; P7 restore gate |
| OPEN-07 | Correct staging app variant and real client isolation | Staging/SQL-role containment exists, but supplied build reports `.dev`; real staged login/install is unverified. Owner approved local development first: corrected staging build/client checks at integrated cash-sale/offline milestone, before P7. Auth settings owner-confirmed; hosted monitoring optional P12. | Repository owner | Integrated P2/P3/P5 milestone; must close before P7; monitoring only P12 |

## Dated scope amendment — 2026-10-05

Owner approved the poster's three-mini-pizza PHP 99 offer for the first release, mixed or same flavor, alongside PHP 39 singles. This is a fixed catalog bundle, not a general discount engine. Implement immutable parent/composition snapshots and three actual flavor portion effects, multiplied by bundle quantity and protected from replay. Proposed equal allocation is PHP 33 per component; validate reporting without parent/child double recognition. Initial refund unit is one whole bundle; prepared food does not automatically restock. Existing P2-02/P2-03/P4-03/P5-05/P6-04 tasks and [acceptance scenarios](specifications/cafe-acceptance.md) now include this approved scope. No runtime bundle functionality is claimed.

## Verification record

2026-10-06 sequencing amendment: owner approved proceeding with P1 without another
early staging APK. Keep staging and all existing acceptance tasks; verify changes
locally throughout development, then authorize reviewed staging promotion/build at
the integrated cash-sale/offline milestone. Native behavior still needs device
checks when introduced. Local P1 role/report regression evidence is now in
[P1 permission evidence](evidence/P1-security.md); no remote P1 application or
production security acceptance is claimed. The original P0.1 record below is historical.

P0.1 inspected the current domain path and documented explicit choices, compatibility evidence, consequences, and downstream acceptance gates. No local database dependency, schema migration, payment rule, or device policy has been applied by this document. SQLite/native-security APIs still require their planned technical qualification. The supplied version-2 SQL definitions and owner-confirmed Auth baseline are recorded; OPEN-01's evidence collection is closed and absent staff procedures remain P1 implementation work. Actual role/API behavior still needs staging tests.
