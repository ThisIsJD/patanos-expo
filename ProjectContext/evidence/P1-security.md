# P1 security boundaries

Date: 2026-10-06 (Asia/Shanghai; work began 2026-10-05).

Status: **P1-01/P1-02/P1-03 complete for local development acceptance; P1 overall 33.3% (3/9).** Staging and Android acceptance remain open in P1-GATE. No remote migration, cloud build, deployment or device test was performed. Entries below preserve dated checkpoints, not separate per-task reports.

## Approved plan sequencing

The owner approved revising the schedule and proceeding with P1. Keep the existing staging project, but stop requiring a new staging APK before each development increment. Develop with automated local checks and development-device tests where relevant. At the integrated cash-sale/offline milestone, separately authorize reviewed staging promotion, build/install the corrected staging variant and finish deferred P0 connection/install evidence. Repeat security/device acceptance before P7. Native dependency/configuration changes may require an earlier development build.

P0 remains 5/9 (55.6%); P0-04/P0-06/P0-08/P0-GATE are not checked. The P1-01/02 checkpoint had seven of 103 items checked; P1-03 brings this to eight. No unfinished gate was removed or reclassified as complete to permit development.

## What changed

### Staff roles (P1-01)

- API identities can read profiles subject to existing RLS and update only `full_name`/`avatar_url`. Broad table UPDATE and protected-column grants are removed; profile insertion/deletion are not client operations.
- An invoker trigger rejects identity/role changes by untrusted SQL identities, even if a later migration accidentally restores broad UPDATE. It does not trust editable metadata or a custom session flag.
- `set_staff_role` checks the authenticated server-stored owner role. It uses a fixed empty search path, qualified references, serialized profile changes and last-owner protection. Cashiers/anonymous callers cannot assign roles; owners must use this path rather than direct profile updates.
- Actual role transitions and authoritative actor/target/old/new roles are written atomically to an API-inaccessible private audit table. Rejected requests/no-ops do not add audit records.
- Existing Auth profile creation ignores requested role metadata; SQL and real Auth metadata-tampering tests verify this. This does **not** implement safe staff onboarding: the legacy default cashier role/public-signup issue in the original development backend remains P1-04 work.

### Sales reports (P1-02)

- Direct `daily_sales`/`category_sales` client grants are removed, including anonymous access. Even the owner client uses checked RPCs.
- `owner_daily_sales`/`owner_category_sales` require a live owner role, validate the inclusive date range and retain existing report fields/formulas. SQL tests include actual completed cashier sales, so owner visibility is not inferred from empty results.
- `useSalesReports` calls these RPCs, masks previous-account data immediately, ignores stale requests and clears totals on failure. Reports show a clear error and 48-dp minimum Retry control instead of presenting a failed request as zero sales. Theme/native UI guidance informed this small change; the wider P5 redesign is not implemented.
- Historical category joins, timezone/business-date calculations, payment/refund totals and report semantics remain P2/P6 scope.

## Compatibility and promotion boundary

The updated reporting hook **requires the new RPC migration**. Only the isolated local database was upgraded. The original development backend and existing staging setup were not changed; running this client against their older schema can show “Reports unavailable” until coordinated, separately authorized promotion. P1-01/02 did not change POS transaction code; the P1-03 entry below does and also requires its migration. Do not use a generic `db push` to replay the empty-database P0 reconstruction into a populated environment.

Before future staging promotion, inspect live grants/policies/function bodies and the existing staging allowlist fences; rehearse only the additive P1 migration, preserve fences and data, coordinate client/schema versions, and repeat actual password-login API tests. Initial-owner provisioning, disabling/recovery, active-owner checks during disable, native credential storage, bounded offline authorization and logout behavior remain unfinished. UI-only role checks are not the security boundary.

## Changed files

- `supabase/migrations/20261005010000_staff_roles_and_reports.sql`: additive role/report boundaries; no sales/history recreation.
- `supabase/tests/003_staff_security.sql`: 42 rollback-only security regressions; tolerates existing synthetic audit records.
- `supabase/tests/002_reconciliation.sql`: original reconciliation tests updated for the latest secure grants and owner report RPC; original migration/source snapshots remain unchanged.
- `supabase/config.toml`: email provider enabled, global signup still disabled. The CLI maps the email switch to provider enablement; real HTTP verifies existing-user login and signup rejection. [Supabase's upstream explanation](https://github.com/supabase/supabase/issues/40582).
- `scripts/test-security-api.cjs`, `package.json`, `.github/workflows/checks.yml`: loopback-only real Auth/API checks added to local commands and CI. No new dependency.
- `src/hooks/useSalesReports.js`, `app/(admin)/reports.jsx`, `tests/hooks/useSalesReports.test.js`, `tests/components/ReportsScreen.test.jsx`: checked RPC integration, stale/account isolation and error/retry regressions.
- `scripts/check-database.cjs`: preserves reconstruction hashes and checks P1 definitions.
- `CONTRIBUTING.md`, `implementationPlan.md`, `architectureDecisions.md`, `P0.2-staging-checklist.md` and this evidence: development sequencing, command guidance and honest gates.

## Exact checks and results

| Command/check | Result |
| --- | --- |
| Inspect `patanos-local` before reset | Exactly two published synthetic accounts, zero orders, four menu fixtures; no real cafe data. |
| `node scripts/test-security-api.cjs` before P1 replay | Initially identified local email-provider disabled (422), fixed without opening signup. Genuine owner/cashier login then succeeded; security regression failed on anonymous direct daily-report access, reproducing the baseline defect. |
| `npx.cmd --no-install supabase db reset --local` | Exit 0; original baseline, reconciliation and additive P1 migration plus local seed replayed. Only disposable local data/sessions affected. |
| `npx.cmd --no-install supabase test db` | Exit 0; three files, 77 checks (10 baseline, 25 reconciliation, 42 new security). Repeated after real API role changes; also passed. Initial test-only nested data-modifying CTE syntax error was corrected, not suppressed. |
| `node scripts/test-security-api.cjs` after P1 replay | Exit 0; 28 genuine local HTTP/Auth checks. Anonymous/cashier report denial, self-promotion/metadata denial, owner access/role transitions, last-owner protection, date rejection and immediate post-demotion denial. Uses only local public key and published synthetic credentials; no remote/env target accepted. |
| `npm.cmd test -- --runTestsByPath tests/hooks/useSalesReports.test.js tests/components/ReportsScreen.test.jsx --silent` | Exit 0; two suites/nine report regressions. |
| `npm.cmd run test:ci -- --silent` | Exit 0; 14 suites/82 cases. Seven `test.failing` cases still reproduce unfixed P2/P3 defects; 75 ordinary cases pass. Existing scoped six-file coverage: 83.71% statements, 72.53% branches, 75.36% functions, 87.11% lines; not whole-app coverage. |
| `npm.cmd run lint` | Exit 0; zero errors, 14 existing warnings. |
| `npm.cmd run db:check` | Exit 0; original metadata/migration provenance, reconciliation, P1 definitions, deterministic staging artifacts and synthetic fixtures checked. No SQL executed by this command. |
| `npm.cmd run export:android -- --output-dir dist/p1-20261006-android` | Initial sandbox attempt failed only because Hermes executable access was denied. Same command with approved execution escalation exited 0: 1,848 modules, 63 assets, approximately 6.14 MB Hermes bundle. `EXPO_NO_DOTENV=1`, placeholder public config and Sentry upload disabled; no environment secrets read or cloud build. This is a bundle check, not an installed APK. |
| Inline Node tracker/link/hash/package validator | Exit 0; 103 unique task IDs, seven checked (P0 five/P1 two), one update template, 52 valid local links in affected docs, nine preserved migration/evidence/transaction-source SHA-256 hashes, matching package/lock dependencies. |
| `git diff --check`, `node --check scripts/test-security-api.cjs`, `node --check scripts/check-database.cjs`, explicit whitespace validator | Exit 0; 17 changed/new files checked directly, including untracked files. Git emitted LF/CRLF normalization warnings only. |

## Local cleanup

After API tests, the stack still contained only the two published users, zero sales,
four menu variants and two synthetic role-audit entries. A final explicit local
reset exited 0 and restored source fixtures: two users, zero orders/audit rows,
`admin,cashier` roles and no injected Auth role metadata. Test sessions/probes were
removed; fixtures and synthetic credentials are reproducible from seed. The final
rollback-only SQL rerun passed all 77 checks. No real cafe data was deleted.
`npx.cmd --no-install supabase stop` exited 0 with backup retained for
`patanos-local`; Docker Desktop and remote projects were left unchanged.

The SQL permissions follow PostgreSQL's distinction between table and column grants; owner RPCs explicitly revoke default PUBLIC execution and fix their search paths. [PostgreSQL GRANT](https://www.postgresql.org/docs/17/sql-grant.html), [CREATE FUNCTION security guidance](https://www.postgresql.org/docs/17/sql-createfunction.html).

## Remaining release risks

- No P1 migration/test executed against staging, development or production; no fresh remote metadata claim. Existing staging containment is not generic production hardening.
- No signed APK, phone/tablet, TalkBack, landscape, physical touch-target or native-session check. The new report UI is component-tested only.
- P1-03 closes direct transaction writes and verifies server amounts/status/stock/cancellation locally, as recorded below. Replay identities, durable financial/portion ledgers and historical/offline catalog acceptance remain P2/P3/P4. The seven known client/offline regressions are still defects.
- Account administration, recovery/email quota, secure storage/lock, bounded offline grant, secret/history review and Storage/audit-retention policy remain P1-04 through P1-08.
- Parallel multi-owner demotion stress and remote role-disable behavior still need integrated acceptance. Report dates/category history are unchanged, not certified correct for cafe reconciliation.
- Local CLI/Docker and Hermes execution need sandbox escalation in this Windows environment. No cloud dependency or new APK was introduced to perform these checks.

## 2026-10-06 — P1-03 order/RPC authorization and stock disposition

### Reproduction and protected boundary

Before replay, a rollback-only `docker exec -i supabase_db_patanos-local psql -U postgres -d postgres -v ON_ERROR_STOP=1` probe used the published cashier identity: placement reduced stock 20 → 19; direct cashier cancellation updated the order but left stock 19. The invoker trigger lacked owner inventory rights. New hook tests initially failed on direct `.update()` calls; payment-sheet tests reproduced tender/reference clearing after a rejected payment.

`20261006000000_order_mutation_boundaries.sql` is additive, local/CI only. Source baseline/supplement migrations are unchanged. It adds one public cancellation-disposition column and a private audit relation; current public column count is 95, not a rewrite of the 94-column source snapshot.

- Anonymous/staff clients lose all order/child mutation and sequence grants; authenticated reads retain existing RLS. Even owners use checked operations. Invoker guards also reject raw row writes after an accidental grant. Private helpers/audits are not exposed; trigger helpers lose client execution grants.
- `place_order` requires a signed server-stored staff role, validates JSON/type/quantity/catalog/modifier availability, targeting, unique selections and min/max choices, and snapshots server names/prices. Unknown actor/status/stock fields are rejected. Forged totals fail; the existing one-peso tolerance persists only as validation tolerance, not a persisted discount. Catalog prices must match; unpaid stale queued items fail visibly rather than silently reprice.
- Catalog SHARE locks protect one catalog snapshot. Inventory rows lock in menu-ID order. Stock decrement no longer clamps shortages to zero: the constraint rejects and rolls back the entire placement, children, stock and audit together.
- `complete_order` locks an open order, validates cash/GCash and tender centavos, derives change/actor/time and audits success atomically. GCash remains manual with optional reference; no gateway confirmation is implied. Missing rows, invalid tender and repeated terminal transitions cannot report success or rewrite settlement.
- `cancel_order` accepts only open unpaid orders and requires a reason. **Default prepared/unknown disposition never returns sellable stock.** Explicit whole-order unprepared confirmation restores the SUM of same-variant lines once through the invoker trigger running inside the narrow trusted RPC. Cashiers still cannot edit inventory directly. Paid cancellation is denied even for owners; refund implementation remains P2/P6.
- `useOrders` uses the checked payment/cancel RPCs, refuses an empty acknowledgement and returns actionable transport failures. The payment sheet preserves tender/method/reference after failure; the open-orders alert distinguishes unprepared release from prepared/unknown consumption. Theme/native UI guidance kept these changes limited to failure and disposition behavior. No wider P5 redesign or physical-device claim.

Successful placement/payment/cancellation audits use the signed actor, with cancellation disposition and server time, in the same transaction. No payment reference or order notes are copied into the audit. Retention/owner audit UI remain P1-08/P6. See [ADR-12](../architectureDecisions.md#adr-12--interim-p1-server-mutation-boundary). Fixed search paths and explicit execution revocations follow [PostgreSQL function-security guidance](https://www.postgresql.org/docs/17/sql-createfunction.html).

### Verification and remaining acceptance

| Command/check | Result |
| --- | --- |
| Pre-reset local inspection | Two published synthetic users, zero orders, four menu fixtures. Docker Desktop started in the background; only patanos-local used. |
| `npx.cmd --no-install supabase db reset --local` | Final additive migration and synthetic seed replayed successfully. One intermediate SQL run correctly failed because a running reset had loaded the previous draft before the disposition edit; a fresh replay resolved that schema-version mismatch, without weakening tests. |
| `npx.cmd --no-install supabase test db` | Four files, 142 passing rollback-only checks: 10 baseline, 25 reconciliation, 42 role/report, 65 transaction-boundary regressions. Includes spoofed fields/prices, malformed inputs, modifier limits, atomic shortage, cash/GCash, unknown disposition, aggregated release, repeated transitions, no-profile denial, private audits and accidental-grant defense. |
| `node scripts/test-security-api.cjs` | 57 genuine local HTTP/Auth checks pass. Signed owner/cashier and anonymous mutation denials; server money/actor; cashier restoration; simultaneous payment/cancel permits one terminal transition; simultaneous last-portion placements permit only one sale and restore only its accepted portions. No remote/env target or service key used. |
| `npm.cmd test -- --runTestsByPath tests/hooks/useOrders.test.js tests/components/PaymentSheet.test.jsx tests/components/OpenOrdersScreen.test.jsx --silent` | Three suites, 17 focused tests pass: RPC payloads/failure/empty acknowledgement, online/offline parity, input preservation and both cancellation choices. |
| `npm.cmd run test:ci -- --silent` | 18 suites, 104 cases: 97 ordinary tests plus seven known expected failures. Scoped foundation coverage remains unchanged; no whole-app coverage claim. |
| `npm.cmd run lint` | Exit 0; no errors, 14 existing warnings. A new anonymous test-mock display-name error was fixed with a named mock component before the final run. |
| `npm.cmd run db:check`, `node --check scripts/test-security-api.cjs`, `node --check scripts/check-database.cjs`, `git diff --check` | Pass; source reconstruction/provenance and deterministic staging artifacts preserved, script syntax/diff checks clean. New/untracked source files also inspected directly for whitespace, scope and sensitive literals. |
| Tracker/protected-source validator and context tests | 103 stable IDs, eight checked, P1 3/9. Baseline/review/supplement and cart/validator/offline-queue SHA-256 values unchanged; five context-organization/link tests pass. Fifteen changed files checked for whitespace. |

Cleanup: inspected two synthetic users, four test orders, four menu variants and eight order-audit records; no real cafe data. Final `db reset --local` removed only reproducible synthetic probes/sessions and restored two users, zero orders/audits/sessions, four menu variants and `admin,cashier` roles. All 142 rollback-only SQL checks passed again. `npx.cmd --no-install supabase stop` exited 0 with local backup retained; remote databases and Docker Desktop were left unchanged.

Remaining checks: native alert wording/touch/keyboard/accessibility on the phone/tablet, real staging policies/fences/identities, migration compatibility with non-empty history and release promotion. No remote metadata was refreshed and no new APK/export was required. Direct report/payment/cancel callers need coordinated schema promotion before use against the old development/staging backend.

P1-04/05/06 account lifecycle/native secrets/lock/bounded offline authorization are next. P1-07/08 and P1-GATE remain open. Offline queue format, five-attempt/dead-letter behavior, shared validator and cart are unchanged; seven existing expected failures, enqueue-during-sync loss and lost-ack duplicate placement remain P2/P3 debt. No sale replay identity, payment/stock ledger, per-line preparation/waste flow, pizza bundle or complete offline cash workflow is claimed. General future-function/default grants and owner stock adjustments still require careful review in subsequent migrations.

## 2026-10-06 — P1-04 partial: profile resolution and protected POS-first navigation

The original context finished loading before fetching permissions and accepted stale profile responses after account changes/sign-out. The initial 12 regression cases reproduced ten failures; two cleanup/refresh cases already passed. A real Expo Router test also demonstrated that ordinary navigation back from owner tools created a second POS instance with an empty draft. The final regression uses the actual `CartProvider`, not just a mocked cart counter.

- `AuthContext` now waits for the matching profile, requires an explicit staff role, masks old-account permissions immediately, ignores superseded/unmounted responses, aborts profile requests after 15 seconds and provides a recoverable error state. Auth callbacks defer database requests outside the SDK auth lock; periodic checks fetch permissions rather than trusting a cached session alone. [Supabase callback guidance](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
- `SessionNavigator` uses the installed SDK's `Stack.Protected`. Unresolved/missing/failed roles cannot mount POS or owner screens; cashier deep links cannot mount owner tools. An already visible owner screen is removed on demotion. Both roles normally land on POS. These UI checks do not authorize backend requests; P1 RLS/RPC contracts remain the independent boundary. [Expo protected-route guidance](https://docs.expo.dev/router/advanced/protected/).
- Same-user token refresh keeps a previously resolved profile while rechecking, preserving the mounted cart. Owner tools push above POS; `dismissTo` returns to the existing POS/cart. New retry/logout/owner-navigation controls reuse Electric Mango tokens, accessibility labels and 48-dp minimum targets. The UI and order-integrity skills informed these focused state/touch/cart safeguards, not a full P5 redesign.
- SDK sign-out errors return a failure and alert rather than unconditional success. Auth code does not remove queued orders. This is not full P1-05 handover/unsynced-record/native sign-out qualification.

The helper rejects `is_enabled: false` if returned, but the current schema has no enabled field. **No server account-disable implementation or signup-policy change is claimed.** Existing legacy role reads remain compatible. Missing/network-failed profile checks intentionally block UI; there is no bounded cached offline grant. That can unmount an in-memory cart during an outage. Queue preservation is tested, but durable drafts, offline cold start, expired/revoked staff grants and reconnect enforcement remain P1-06/P3 acceptance.

### Fresh checks

| Command/check | Result |
| --- | --- |
| `npm.cmd test -- --runTestsByPath tests/contexts/AuthContext.test.jsx tests/components/SessionNavigator.test.jsx --silent` | Two suites, 26 cases pass: initial/profile/account races, unsupported/missing/disabled-profile presentation, retry, sign-in fallback, failed sign-out, persisted-queue preservation, deep links, demotion, token-refresh cart retention and secondary-tools cart return. Real installed router harness; no real Auth/API server exercised in these tests. |
| `npm.cmd run test:ci -- --silent` | 20 suites, 130 cases pass: 123 ordinary assertions plus seven known expected failures, still unfixed P2/P3 defects. Existing six-file coverage scope: 83.71% statements, 73.05% branches, 75.36% functions, 87.11% lines; not whole-app/auth coverage. |
| `npm.cmd run lint` | Exit 0; zero errors, 12 existing warnings. Removed the obsolete root navigator's two warnings; no unrelated lint cleanup. |
| `npm.cmd run db:check` | Exit 0; preserved database provenance/staging artifacts/P1 definitions. Static check only; no SQL or remote metadata query. |
| `npm.cmd run export:android -- --output-dir dist/p1-auth-20261006-android` | First attempt reached 1,851 modules but sandbox denied Hermes execution. Approved local execution retry passed; dotenv disabled, placeholder public configuration, Sentry configuration/upload disabled. Bundle export only, not a cloud build or installed APK. Temporary output stays under ignored `dist/`. |
| `npm.cmd test -- --runTestsByPath tests/config/projectContext.test.js --silent`, `git diff --check` | Five organization/link/tracker tests pass after the documentation update; tracked diff clean (Git line-ending warnings only). |
| Inline Node whitespace/tracker/source validator | 14 affected files inspected, including untracked files; 103 stable IDs/eight checked/P1-04 open. Cart, validator and offline queue content matches HEAD with Windows line endings normalized; no tested credential literals found. No whole-history secret scan is implied. |

Test-harness setup now uses the official safe-area mock's provider/contexts plus native View, supporting real router tests without a production dependency. An explicit test-only `.jsx` import prevents Babel resolving adjacent `app.json` in place of the index route; no production resolver change. Intermediate test failures were corrected, not converted to expected failures.

Changed application files: `src/contexts/AuthContext.jsx`, `src/utils/staffAccess.js`, `src/components/auth/AccessState.jsx`, `src/components/auth/SessionNavigator.jsx`, root/index and owner/POS layouts. Tests: `tests/contexts/AuthContext.test.jsx`, `tests/components/SessionNavigator.test.jsx`, `tests/setup.js`. No new dependency, transaction/RPC payload, queue format, cart reducer, migration or remote setting changed in this increment.

Owner approved installed Android-app password recovery; direction is recorded in ADR-13. The recovery flow and email/redirect configuration are **not implemented** by this increment. P1-04 remains unchecked and P1 remains 3/9 (33.3%); provisioning, server disable/signup boundary, recovery/email quota and native/staging checks remain. No phone/tablet, TalkBack, background/resume, physical touch, actual SDK token refresh/sign-out or remote role-disable acceptance was run. Live metadata was not refreshed; local SQL/API results in earlier entries are historical, not rerun here.

## 2026-10-06 — P1-04 partial: Android recovery implementation

Owner approved SDK-compatible `expo-crypto` for this increment. Inspection of installed auth-js showed native PKCE otherwise falls back to Math.random/plain challenge; explicit exchange emits SIGNED_IN, with its recovery marker returned separately. The adapter supplies Expo cryptographic randomness/SHA-256 and the client selects PKCE, while retaining manual URL processing. The real SDK request test verifies the S256 payload against its stored verifier with mocked transport/crypto delegation; it is not proof of native cryptography or server email delivery. [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [SDK 54 Crypto](https://docs.expo.dev/versions/v54.0.0/sdk/crypto/).

- Added forgot/reset forms, keyboard-safe scrolling, secure fields, 48-dp actions and loading/error/disabled states using existing Electric Mango tokens. Failed updates preserve inputs; acknowledged success clears them. Return-to-login errors cannot masquerade as successful sign-out. UI/Supabase skills informed these safeguards; no broader POS redesign.
- Strict matching of native scheme/destination/code rejects other builds, duplicate/unexpected parameters and bearer-token fragments. Native intent maps recovery paths without query/fragment into navigation; the original native event is verified separately. No password, token or code is deliberately written to recovery metadata or logs. [Expo native-intent guidance](https://docs.expo.dev/router/advanced/native-intent/).
- A non-secret gate is persisted before session exchange. Cold/warm links, restart, stale initial URL, double taps, mismatched identities and StrictMode replay are covered. Incomplete/corrupt gates fail closed. Recovery removes protected POS/owner routes until live-user recheck, password update and confirmed installation-local sign-out/cleanup. A pending exchange cannot be cancelled into unlocked POS. This is a UI gate, not a restricted-purpose JWT or substitute for backend authorization.
- Persisted two/hour request reservations plus one-minute spacing resist accidental resend and ambiguous-response retries. No email address is stored. These are per-installation UX limits; the shared server quota remains authoritative. Generic acknowledgement/errors do not claim actual delivery. New requests replace the prior PKCE verifier; use the newest email on the requesting installation.
- Email sending defaults **off** via `EXPO_PUBLIC_PASSWORD_RECOVERY_ENABLED=false`. This prevents emails falling back to the unchanged hosted localhost URL before separately authorized redirect/native setup. Unsupported/mismatched/Expo Go/crypto-unavailable runtimes refuse requests. Older APKs lacking ExpoCrypto are handled without an unconditional native-module startup failure; installed behavior remains untested. Local CLI redirect URLs were edited but no stack restarted, SQL executed or hosted setting changed.

### Fresh verification

| Command/check | Result |
| --- | --- |
| `npx.cmd --no-install expo install expo-crypto` | Initial restricted-network fetch failed; approved retry installed SDK-compatible `~15.0.9`, one added package. Installer reported 71 dependency vulnerabilities (1 low/18 moderate/52 high); no force remediation or release-security qualification. Existing Sentry CLI/unrs install-script restrictions remained. |
| `npm.cmd test -- --runTestsByPath tests/lib/passwordRecovery.test.js tests/lib/nativeCrypto.test.js tests/components/RecoveryForm.test.jsx tests/contexts/RecoveryContext.test.jsx tests/components/SessionNavigator.test.jsx --silent` | Five suites, 71 cases pass, including installed-SDK S256 request construction, recovery UI/provider/controller and real router checks. Network/native cryptography are mocked; no real Auth server/mailbox exercised. |
| `npm.cmd run test:ci -- --silent` | 24 suites, 190 cases: 183 ordinary assertions plus seven existing expected failures, still defects. Six-file foundation coverage remains 83.71% statements/73.05% branches/75.36% functions/87.11% lines; no whole-app/recovery coverage claim. |
| `npm.cmd run lint`, `npm.cmd run db:check`, `git diff --check` | Pass: zero lint errors/12 existing warnings; static database provenance/artifacts preserved; no SQL or remote metadata read. One intermediate test-only undefined Buffer lint error was fixed, not suppressed. |
| `npm.cmd run export:android -- --output-dir dist/p1-recovery-20261006-android` | Initial sandbox denied Hermes; approved local execution and final refresh passed: 1,862 modules, 63 assets, about 6.18 MB Hermes bundle. Dotenv disabled, placeholder public config, email sending/Sentry upload off. No APK, cloud build or native qualification. Output remains ignored. |
| Inline Node source/tracker/package validator | 23 affected files, including untracked source/tests, inspected for whitespace/sensitive literals. 103 stable IDs/eight checked/P1-04 open; normalized cart/validator/queue content matches HEAD. Manifest/lock declarations and installed Expo compatibility metadata agree on expo-crypto. No whole-history secret scan implied. |

Changed areas: recovery utility/controller/native-crypto adapter/context/form; reset/forgot/native-intent routes; root/index/session navigation and login link; Supabase client PKCE setting; five test files; package/lock; safe environment template and local CLI redirects. Existing phase tracker/ADR/contributor documentation updated; no per-task Markdown file or migration added.

P1-04 remains partial and P1 stays 33.3%. Required next work: owner provisioning/disable and server signup controls, actual local/staging recovery API/email/error/quota qualification, exact hosted redirect authorization and installed-phone cold/warm/background/restart/keyboard/TalkBack checks. Password UI minimum is not server policy certification; other-device session revocation and JWT/offline limits remain P1-05/06. SDK session/verifier storage remains AsyncStorage until P1-05; preserve/migrate that verifier and the non-secret gate deliberately. Recovery can unmount an in-memory draft; durable drafts and enrolled offline access remain P3/P1-06. Pending queue records are preserved in tests, but no trading/device/restore guarantee is claimed. No live metadata, remote SQL, Auth provisioning, SMTP, hosted settings, cloud build or deployment changed.

## 2026-10-06 — P1-04 partial: staff approval and disabling

Owner chose dashboard-created confirmed email logins plus in-app cafe approval (ADR-14). No Auth-admin endpoint, new dependency, privileged Expo key or hosted configuration was introduced. Supabase/order-integrity skills informed the independent SQL authorization and whole-sale staff lock; the UI skill informed feature-based components, Electric Mango tokens, 48-dp actions, confirmations, scroll/keyboard/safe-area support and wrapped role controls.

- Additive `20261006010000_staff_access_lifecycle.sql` defaults **all** profiles inactive. The new-user trigger explicitly ignores role/approval metadata. The local seed bootstraps only its two published synthetic accounts. Hosted promotion must separately review/bootstrap the initial owner and approve existing staff individually; this migration intentionally does not silently grandfather signup-created cashiers.
- Role resolution checks approval plus confirmed email, anonymous status and current Auth ban. Nine restrictive authenticated operational policies close existing auth.uid()-only read paths. Own-profile reads remain for access-denied presentation; existing anonymous published catalog/image reads remain public. Disabled-owner Storage writes and report access are denied. Public images are not confidential staff data.
- Owner-only `approve_staff` atomically assigns role and approval; `set_staff_enabled` audits accepted access transitions with a bounded non-sensitive reason. Private tables/functions have no client grants. Protected-column grants and the invoker trigger defend against self-approval, including an accidental broad UPDATE grant. Role/approval changes share a serialization lock and count **active eligible** owners, not disabled admin profiles.
- Sale RPCs retain the staff profile SHARE lock until commit. Disabling cannot invalidate a half-committed sale. RLS/RPCs deny new requests from an already-issued disabled-user JWT; this does not remotely erase cached information, terminate every Auth session, or implement an offline grant. Queued-order retry/dead-letter behavior and replay defects are unchanged; a server-denied queue submission can still exhaust the current legacy retry policy. P1-06/P3 must handle revocation/recovery deliberately.
- Owner Settings lists minimal profile fields and provides approve/re-enable, role and disable controls for other accounts. Offline changes are not queued; there is no optimistic success. Missing/denied/malformed/lost acknowledgements clear stale staff data and require refresh. Account switches/demotion mask prior lists; double taps cannot duplicate the request. Acknowledged changes remain acknowledged even if the follow-up list fails, with a separate refresh error.

### Fresh verification

| Command/check | Result |
| --- | --- |
| `npx.cmd --no-install supabase db reset --local` | Replayed five migrations and the two synthetic accounts; no linked/remote target. Inspected `supabase_db_patanos-local` before each reset. Static source hashes preserve the original baseline/supplement and staging artifacts. Local redirect configuration is now applied through stack restart; no real recovery email was requested. |
| `npx.cmd --no-install supabase test db` | Final replay: five files, **190 assertions** (48 lifecycle plus 142 earlier checks), all pass/rollback. Includes injected metadata, confirmed-but-unapproved/unconfirmed/anonymous/banned identities, raw approval bypass, atomic approval rollback, last active owner, disabled reads/sales/payment/cancel/reports/Storage writes, accidental grants, private audits and unchanged anonymous public menu reads. |
| `node scripts/test-security-api.cjs` | **79 genuine local Auth/HTTP checks** pass using loopback-only public configuration and published synthetic staff. Existing JWT loses role/read/sale permissions after disable; confirmed API acknowledgement restores access. Concurrent self-disabling of two owners permits exactly one and leaves one active owner. Previous payment/cancellation/last-portion races remain passing. No privileged client credential or remote target used. |
| `npm.cmd test -- --runTestsByPath tests/config/projectContext.test.js tests/hooks/useStaffAdministration.test.js tests/components/StaffAdministration.test.jsx --silent` | Final three focused suites/**37 cases** pass: 32 staff hook/UI regressions plus five context/link checks. Includes stale approval/list results, failed follow-up refresh, double taps and unavailable states. Mocked transport/native rendering only. |
| `npm.cmd run test:ci -- --silent` | Final **26 suites/222 cases**: 215 ordinary assertions and seven known expected failures, still unfixed P2/P3 defects. Foundation six-file coverage unchanged: 83.71% statements, 73.05% branches, 75.36% functions, 87.11% lines; not whole-app/staff coverage. |
| `npm.cmd run lint`, `npm.cmd run db:check`, `git diff --check` | Pass: zero lint errors/12 existing warnings; deterministic provenance/artifacts and lifecycle-definition checks pass; tracked whitespace clean. db:check is static, unlike the SQL/API runs above. |
| `npm.cmd run export:android -- --output-dir dist/p1-staff-20261006-android` | Local Hermes export passed: **1,864 modules**, 63 assets, about 6.2 MB. Approved local execution, dotenv disabled, placeholder public config, recovery sending/Sentry uploads off. Not an APK, native/device qualification or EAS build; output remains ignored. |
| Inline Node affected-source/tracker validator; `npx.cmd --no-install supabase stop` | 16 affected files checked, including untracked code/SQL; 103 IDs/eight checked/P1-04 open; normalized cart/validator/queue match HEAD, no tested credential literals. Not a whole-history secret scan. Clean local stack stopped with backup retained; Docker Desktop not stopped. |

Changed application areas: Settings, `StaffAdministration`, `useStaffAdministration`; lifecycle migration, local seed, SQL 002/005, static checker and loopback API harness; two new regression files; existing tracker/ADR/full-scope/contributor/phase-evidence documents. No per-task evidence file. Cart, payload validator and queue source remain unchanged.

After API probes, read-only inspection found two synthetic users, four synthetic orders, eight order audits and four access audits; both fixture roles/approval were restored. Local reset removed those test records/sessions and replayed fixtures. Final inspection confirmed two approved synthetic identities and zero sales, role/access/order audits and Auth sessions; final rollback-only 190 SQL checks passed. No cafe history was removed. Stack backup is retained, not deleted.

P1-04 stays unchecked; P1 remains 3/9 (33.3%). No hosted metadata, migration, signup/redirect setting, Auth account, cloud build or deployment changed. Installed-phone/tablet layout, keyboard, TalkBack, Realtime, resume/disable/reconnect, actual email/error/quota delivery and owner bootstrap have **not** been qualified. The current remote schema does not have these P1 APIs/approval fields; updated owner tools require coordinated reviewed promotion, not blind db push. P1-05 credential storage/lock and P1-06 enrolled offline identity are the next local development steps while email/staging/device gates remain open.

## 2026-10-06 — P1-05 partial: lock and queue-preserving local logout

Owner declined adding `expo-secure-store` for now. No dependency, native protected-storage adapter, credential migration, SQL/RLS change or remote operation was introduced. Tokens and recovery verifiers remain AsyncStorage-backed; encrypted credential protection is still a release requirement (ADR-15).

- Added a memory-only session controller and opaque lock Modal. Cold restored sessions, manual register lock and AppState background/inactive transitions lock access. Foreground return cannot unlock; online same-account password and matching approved server profile are required. Back cannot dismiss the overlay; underlying accessibility is hidden while the real mounted cart remains. Password inputs clear on submission/background/identity changes. Recovery remains accessible through its independent gate. Electric Mango, feature folders, safe-area/keyboard scrolling and 48-dp actions are retained.
- Locking stops SDK automatic refresh and refuses new POS operations and owner staff-approval mutations. Tracked operations finish without financial-request cancellation. Explicit local logout waits for them, stays locked on timeout/failure, and never reports unconfirmed success. Double account actions are serialized. Logout preserves queue/dead-letter data, but warns that unsaved in-memory drafts may be lost. Not every legacy owner-content mutation or recovery/financial race is covered by leases.
- New queue entries include their original `staffUserId`. Sync checks a lock/account epoch between submissions and holds other-account or unknown-actor legacy records without retry/dead-letter penalties; visible nonsensitive held counts explain this. This client metadata is not server authorization. No legacy records are reassigned or removed. Durable queue concurrency, lost-acknowledgement idempotency, provenance and recovery remain P2/P3; seven existing expected-failure cases remain defects.
- SDK sign-out uses `scope: 'local'`. A genuine local Auth check confirms specific credential/verifier key removal, retention of unrelated synthetic order keys, denial of the signed-out refresh credential, survival of another SDK client's session and continued usability of an issued JWT until expiry. These are independent memory-storage clients, not multiple physical installations or native encrypted-storage tests. [Supabase sign-out semantics](https://supabase.com/docs/guides/auth/signout).

### Fresh verification

| Command/check | Result |
| --- | --- |
| `npm.cmd test -- --runTestsByPath tests/contexts/AuthContext.test.jsx tests/components/SessionLockOverlay.test.jsx tests/lib/sessionLock.test.js tests/lib/offlineQueue.test.js --silent` | Four suites/48 cases pass: lock epochs, stale/background unlock, operation drain/timeout, local logout failure, queue preservation, password clearing, offline state and pause/actor holds. Mocked transport/native primitives. |
| `npm.cmd test -- --runTestsByPath tests/hooks/useOrders.test.js tests/hooks/useStaffAdministration.test.js tests/components/SessionNavigator.test.jsx tests/components/OpenOrdersScreen.test.jsx --silent` | Four suites/62 cases pass: locked mutations, actor-specific queues, stale sync/approval and held warnings. Installed router harness proves the same mounted CartProvider retains its draft behind the lock. |
| `npm.cmd run test:ci -- --silent` | 28 suites/260 cases: 253 ordinary assertions plus seven known expected failures. Six-file foundation coverage: 84.27% statements, 74.5% branches, 76.05% functions, 87.3% lines; not whole-app/lock coverage. |
| `node scripts/test-session-auth.cjs` | 11 genuine loopback installed-SDK/Auth checks pass; published local fixtures/public key, no privileged key or environment target. Rerun after label clarification also passed. Added to the existing disposable-database CI job; hosted CI was not run. |
| `npm.cmd run lint`, `npm.cmd run db:check` | Final passes: zero lint errors/10 existing warnings; deterministic provenance, prior P1 boundary definitions and staging artifacts preserved. No new SQL test or remote metadata result is implied. |
| `npm.cmd test -- --runTestsByPath tests/config/projectContext.test.js tests/components/SessionNavigator.test.jsx --silent` | Final documentation/navigation check: two suites/23 cases pass after tracker/ADR and indentation updates. |
| `npm.cmd run export:android -- --output-dir dist/p1-lock-20261006-android` | Local Hermes export passed: 1,866 modules, 63 assets, about 6.22 MB. Dotenv disabled, placeholder public configuration, recovery sending/Sentry uploads off. Ignored bundle output only, not an APK, EAS build or phone qualification. |
| Inline Node source/tracker validator; `git diff --check` | 23 affected tracked/untracked files checked for trailing whitespace; 103 stable items/eight checked/P1-05 open; deferred package absent, AsyncStorage remains, normalized cart/validator match HEAD. Tracked diff clean apart from informational Windows line-ending warnings. Initial shell-quoted validator failed to parse; stdin-based retry passed. Not a whole-history secret scan. |
| `npx.cmd --no-install supabase stop` | Local stack stopped with backup retained after read-only fixture/session inspection; Docker Desktop and remote projects untouched. |

Changed areas: AuthContext, sessionLock controller, SessionLockOverlay/SessionNavigator, POS layout/open orders, useOrders/offlineQueue, useStaffAdministration, eight regression files and the loopback SDK harness/CI step. Existing tracker, ADR, contributor guide and this phase evidence updated; no per-task report. Cart and price validator were not modified.

Read-only local inspection after both Auth runs confirmed exactly two approved published fixture users, zero sales, zero Auth sessions and zero refresh-token rows. No reset or data deletion was needed. Final context/link test rerun passed five cases. Hosted metadata, SQL, Auth settings, accounts, cloud builds and deployments remain unchanged.

P1-05 remains unchecked; P1 stays 3/9 (33.3%). Native encrypted credential/verifier lifecycle, enrolled 72-hour offline grants, phone/tablet cold/background/resume/keyboard/TalkBack and staged disable/handover checks remain open. Android notification shade/window blur is intentionally not a trigger because app-owned Modals can blur the window; recents/screenshot privacy is unqualified. Permission outages can still unmount an in-memory draft; durable drafts are P3. Recovery/transaction and legacy owner-content operation interactions need further qualification. No complete offline cafe workflow or deployment readiness is claimed. Next unaffected local work is P1-07/08 while the dependency remains deferred.
