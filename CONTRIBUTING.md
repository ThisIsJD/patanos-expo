# Development foundations

Use Node 22 LTS or the verified Node 24 environment and install with `npm ci`.
Preserve the Expo Router feature structure and Electric Mango theme. See
[repository guidance](AGENTS.md) and the [living plan](ProjectContext/implementationPlan.md).

## Project context and completion notes

Use the [context index](ProjectContext/README.md) and the linked full task scope.
`implementationPlan.md` is the only checklist/status tracker; use
`architectureDecisions.md` only for consequential choices. Routine changes need
one compact task/date/command/result entry, not a separate Markdown report.
Tests, Git history and commit/PR descriptions carry ordinary implementation detail.
Append exceptional security, migration/RLS, POS-integrity, staging/device/release
or complex incident evidence to the existing phase document under `evidence/`.
Only split out dated incident evidence when its reproduction genuinely needs it.
Keep raw database snapshots unchanged. Put temporary logs in ignored `dist/` or
outside the repository unless they demonstrate a release gate or unusual failure.

## Checks

- `npm run lint`: checks application, configuration, scripts and tests.
- `npm test`: Jest/Expo unit and React Native component checks, no real backend.
- `npm run test:ci`: same checks with coverage output under ignored `coverage/`.
- `npm run test:known-defects`: known P2/P3 failures, explicitly marked `test.failing`.
- `npm run db:check`: verifies reconstruction provenance, P1 boundary definitions and synthetic fixtures; does not execute SQL.
- `npm run db:test:api`: real anonymous/cashier/owner HTTP checks against `127.0.0.1:54321` only, using published local accounts and the local public key. Never targets an environment variable or linked project.
- `node scripts/test-session-auth.cjs`: installed-SDK login/local-logout checks on that same disposable stack. Uses synthetic accounts and memory storage; not native encryption/device proof.
- `npm run export:android`: Android bundle check, not an installed/signed APK.

Tests use `tests/<feature>/*.test.js` or `.test.jsx`. Ordinary assertions must pass.
`test.failing` cases assert a desired invariant that the current app violates: their
successful runner result means the defect was reproduced, not fixed. Remove the
marker with its maintained regression when the corresponding fix lands. Do not
turn unexpected failures into expected failures to make CI green. No repository-wide
coverage percentage is claimed; P7 expands integration/device coverage. The six
explicitly measured foundation files have coverage floors of 80% statements/lines
and 70% branches/functions; these are not whole-application readiness targets.

## Local database and synthetic staff

Start Docker Desktop first. `npm run db:start` creates this repository's local
Supabase stack. **Only for that disposable stack**, `npm run db:reset:local` destroys
its local data, replays migrations and loads `supabase/seed.sql`; then run
`npm run db:test` and `npm run db:test:api`. Never append `--linked` or a remote database URL to reset commands.

The migration chain is a reconstruction for an empty local database, not an approved
remote deployment. The original baseline stays unchanged; the 2026-10-05 correction
uses the owner-confirmed development supplement for `numeric(10,2)`, ALWAYS identities,
seven Realtime tables, relation grants and application-owner default grants. Both
renderers enforce source hashes. Stable fixture IDs use `OVERRIDING SYSTEM VALUE`
only in local seed data; normal application inserts still use server-generated IDs.

The correction rejects databases containing sales before recreating the generated
subtotal and its two dependent report views. It is not an upgrade for real history;
the recreated subtotal's physical column position changes, not its named semantics.
The additive P1 migrations protect profile identity/roles and replace direct reports
and order/payment/cancellation writes with checked RPCs. Cancellation returns stock
only after explicit unprepared confirmation; prepared/unknown portions stay consumed.
The staff lifecycle migration defaults all profiles inactive, including existing
ones; the local seed explicitly approves only its two synthetic fixtures. New Auth
users never become approved cashiers through signup or editable metadata. Active
staff checks protect operational reads and sale/report/owner mutations; disabling
does not remove an already committed sale or unsynced queue. Replay/offline defects
and device credential/locking work remain tracked in P1/P2/P3.
Run SQL checks before `db:test:api`: the HTTP suite persists synthetic orders/audits
and test sessions. After inspecting that the stack still contains synthetic data only,
use `db:reset:local` before rerunning the empty-fixture SQL suite or finishing the session.
Local email-provider support stays enabled so existing staff can sign in; global
`auth.enable_signup=false` blocks registration (also checked through real HTTP).
Supabase manages
Auth/Storage and protected `supabase_admin` defaults; do not elevate that role to copy
metadata. The supplement's sequence maximum is rounded and needs a string-safe export
for exact verification. Review missing/current definitions and staging-specific grants
before authorized promotion. See [reconciliation evidence](ProjectContext/evidence/P0-foundation.md#migration-reconciliation-and-stock-incident).

Local fixtures: `admin@patanos.test` and `cashier@patanos.test`, password
`Local-test-only-123!`. These are published synthetic credentials, never reuse them
in staging or production. Fixture bootstrap by postgres is local-only, not an
approved hosted initial-owner setup. No customer data or original test-user identifiers are copied.

## Session locking and account handover (partial P1-05)

Restored sessions, manual register lock and background/inactive transitions require
same-account online password/profile verification; foreground return never unlocks
automatically. The opaque lock keeps the mounted cart, but logout can lose unsaved
drafts. Local logout waits for tracked POS/staff operations and preserves queued
and dead-letter records. Other-account and legacy unknown-actor queue entries are
held, never submitted as the current cashier. Do not delete app data or reinstall
to clear those records; controlled recovery remains P3 work.

Owner deferred `expo-secure-store`: tokens and recovery verifiers still use
AsyncStorage. This is a development limitation, not release acceptance. Offline
unlocking, native credential protection and phone/privacy checks remain open.
Local logout does not revoke other sessions or immediately invalidate issued JWTs.
Run session Auth checks after local replay/SQL checks; never substitute real staff
credentials or a hosted target.

## Staff accounts (local implementation; hosted promotion pending)

Create and confirm each separate email login in Supabase's Authentication → Users
dashboard. Keep public and anonymous signup disabled. New profiles start without
cafe access; changing Auth metadata cannot approve them. An already approved owner
opens Patanos's owner tools → Settings → Staff access, refreshes the account list,
chooses Cashier or Owner, enters a non-sensitive reason and confirms approval.
The same controls change roles or disable/re-enable another account. No passwords
or privileged key are entered in the app. Staff changes require connectivity and
are never queued; after an uncertain response, refresh before retrying.

Before separately authorized hosted promotion, verify the target/project and
current schema, coordinate the additive migrations/client, and explicitly bootstrap
one reviewed confirmed owner using trusted server/SQL access. The approval migration
does **not** preserve automatic access for historical profiles. Review existing
staff individually; never bulk-enable everyone or apply the empty-local baseline
to a database with sales. Another active owner is required to remove owner access.
The app disallows self-management to prevent accidental lockout. Dashboard bans
are checked on new database requests too, but revoking sessions, local cached access,
Realtime and bounded offline recovery still need P1-05/06 and device qualification.

For local app configuration, use the shape in `.env.example` in an ignored `.env.local`.
Use `10.0.2.2` instead of `127.0.0.1` on an Android emulator; phones need the development
host's LAN address. Obtain the local public key from your local Supabase dashboard.
Never put a service-role key in Expo configuration, fixtures, or CI client variables.

## Development sequencing

Develop and run automated checks now; a fresh staging APK is not a prerequisite
for each increment. Use a development app for relevant native checks during work.
Keep staging; at the integrated cash-sale/offline milestone, obtain authorization
to promote reviewed changes and install a correctly targeted staging APK. Repeat
security/device acceptance before P7 passes. Native dependency/config changes may
require an earlier build. Deferred P0 acceptance is still open, not passed.

## Build variants and staging

Set `EXPO_PUBLIC_APP_ENV` to `development`, `staging`, or `production`.
Development uses `com.patanos.pos.dev` / `[DEV]`, staging uses
`com.patanos.pos.staging` / `[STAGING]`, production retains `com.patanos.pos`.
Variants have separate native storage. Environment names do **not** verify backend
isolation: configure the matching public Supabase URL/key independently and prove it.

After switching variants or native dependencies, regenerate native configuration
with `npx expo prebuild --platform android --no-install` after preserving custom native
edits. Never blindly use `--clean` on an existing native project. Build/install with
`npm run android`; verify the installed package and launcher label. EAS development
and preview/staging profiles produce internal APKs; preview and staging explicitly
select `EXPO_PUBLIC_APP_ENV=staging`. No EAS build,
deployment, signing setup, or remote provisioning is performed by repository CI.

Staging remains a separately authorized project with synthetic data only. At the
integrated test milestone, after
schema replay/role tests pass locally, review migration scope and missing metadata,
provision/configure staging with owner approval, establish distinct credentials,
and verify actual anonymous/cashier/admin access. Do not use the vulnerable local
baseline as a public cafe backend.

Use the [staging/device acceptance checklist](ProjectContext/evidence/P0-foundation.md#pending-staging-and-device-acceptance)
for remaining P0.2 checks. A build queued before the staging flag was fixed retains
its uploaded configuration; inspect its actual installed package/backend rather than
assuming the current local profile changed that existing build. Protect old app data.

### Closed staging bootstrap

`supabase/staging/closed-bootstrap.sql` is a separately reviewed artifact for the
owner-authorized empty staging ref `omxoyujlteqcolqcdzxp`, not a general `db push`.
It combines source-hash-checked schema corrections and catalog-only fixtures in one
transaction, rejects existing accounts/data, and closes `anon`/`authenticated`
table/sequence/function grants. No published local passwords or Auth rows are copied.
`npm run db:check` verifies its deterministic renderer. Read-only verification is
`supabase/staging/verify-closed-bootstrap.sql` (initial closed state only); current results and CLI commands are
in [continuation evidence](ProjectContext/evidence/P0-foundation.md#controlled-staging).

After owner-confirmed signup/anonymous off and two newly created confirmed staff
users, `supabase/staging/controlled-access.sql` enabled access only for their supplied
IDs. It adds staging-only allowlist fences across tables/RPC/views/Storage and assigns
fixture roles. `verify-controlled-access.sql` runs rollback-only SQL-role smoke;
actual password login/JWT/client/device checks remain pending. Known baseline
policy/RPC defects remain P1/P2 work; containment is not production hardening.
Never restore broad grants merely to suppress a permission error. Never rerun/reset
remote setup. Use controlled test mailboxes and keep passwords private.

The nested `supabase/staging/local-replay/supabase/config.toml` has no migrations and
exists only to rehearse on the verified disposable `patanos-local` container. Its
local reset destroys fixture data; verify synthetic-only contents first and restore
root migrations/seed afterward. Do not use it against a linked project or DB URL.

### Cafe acceptance specification

Review [phone/tablet wireframes](ProjectContext/design/pos-ux-blueprint.md) and the
[menu capture](ProjectContext/design/menu-capture.md). `tests/fixtures/cafeAcceptance.json`
defines 20 synthetic future acceptance scenarios; its tests validate expected money
and references, not working checkout/offline functionality. Required scope includes
the owner-approved three-pizza PHP 99 bundle; general discounts remain deferred.

## Android password recovery (P1-04, local implementation)

Keep `EXPO_PUBLIC_PASSWORD_RECOVERY_ENABLED=false` until the exact redirect and native
target are prepared for controlled testing. The default-off form explains that
recovery is unavailable; it does not send emails to the unchanged hosted localhost
destination. Remote Auth changes and cloud builds still need separate authorization.

Approved redirects are `patanosexpo-development://reset-password`,
`patanosexpo-staging://reset-password`, and production `patanosexpo://reset-password`.
Allow only the matching destination in each backend. Local CLI configuration now
lists the development/staging URLs, but no local stack was restarted for this change.
For authorized synthetic tests, enable the flag in the matching local environment
and use its Mailpit inbox. Later qualify real staging delivery and the installed
phone before enabling staff recovery. Never log or share a recovery link or tokens.

Request and open the newest email in the same Android installation. `expo-crypto`
requires a native build containing that module; a JavaScript export/old APK cannot
qualify it. Crypto-unavailable builds refuse email requests; Expo Go is not the chosen
link destination. The client reserves at most two requests/hour with one-minute
spacing across restarts, including ambiguous failures. Shared server quotas can be
stricter. SDK PKCE verifier/session storage is still AsyncStorage; native secret
migration is P1-05. Recovery gates are non-secret UI state, not server authorization.
Actual delivery, expiry/resend, app-link/background/restart and other-device session
revocation checks remain required. No new APK or remote setting is applied here.

## Optional Sentry preparation and privacy

Hosted Sentry was deferred by the owner on 2026-10-05 to optional P12. It is not
required to run Patanos or complete P0.2/the initial Android release. Preserve the
inactive skeleton; local sync warnings and recovery procedures remain required.

Sentry is inactive while `EXPO_PUBLIC_SENTRY_DSN` is blank. Configure the matching
environment's DSN only after its project is approved. `SENTRY_ORG`/`SENTRY_PROJECT`
enable the Expo build plugin; keep the build-only `SENTRY_AUTH_TOKEN` in secret
CI/EAS storage, never an `EXPO_PUBLIC_` variable or tracked file.

The initial JS event allowlist removes free-text error details, user/request/context
data and breadcrumbs; preserves source location and release/environment fields;
disables tracing/session collection and native crash collection. Native crash privacy
and full source-map resolution still require optional P12 qualification. Restrictive filename
redaction may reduce symbolication fidelity and must be tested with real sourcemaps.

Once authorized, use a staging build and invoke `captureMonitoringProbe()` from
`src/lib/monitoring.js` in a controlled development harness. Record event ID,
redacted payload, correct release/environment, resolved stack, and actual dashboard
receipt. A mocked test or `flush()` result is not that evidence. No test button or
probe is exposed to cashiers. Dependency installer policies currently block Sentry CLI
postinstall; approve/install it through your dependency policy before source-map upload.

Official references: [Expo tests](https://docs.expo.dev/develop/unit-testing/),
[local Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started),
[app variants](https://docs.expo.dev/build-reference/variants/),
[Sentry setup](https://docs.expo.dev/guides/using-sentry/).
