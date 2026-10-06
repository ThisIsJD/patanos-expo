# P0 foundation evidence

Maintained phase record. Evidence dates: 2026-10-04/05; consolidated 2026-10-06.
Current P0 status: **55.6% (5/9)**, P0.1 complete, P0.2/P0.3 acceptance incomplete.
The [tracker](../implementationPlan.md) is authoritative. This document replaces eight
overlapping P0 reports/worksheets, not their raw provenance or unresolved checks.

## Baseline checks

2026-10-04, P0-01/P0-03: recorded dirty worktree and preserved existing changes.
`npm.cmd run lint` reported 81 errors/14 warnings; `npm.cmd audit --json` reported
53 affected packages (2 critical/32 high/18 moderate/1 low). These are dependency
findings, not proven native exploits. Expo SDK 54 checks identified eight patch
mismatches; no forced downgrade or `audit fix --force` was used.

Android dummy-config Hermes export and native `:app:assembleDebug` passed after
Windows execution-access restrictions were resolved. The development/debug APK
SHA-256 was `B6FA5DFB1A5BFD3353B8A521130E0293AC98591B890E758F33848C7BCDFDDD79`.
It was not a qualified production install or a working-backend test. The
[native completion capture](artifacts/P0.1-20261004-native-build-completion.txt)
preserves unusual build evidence; the ordinary lint log was moved outside version control.

Source diagnostics with memory-only AsyncStorage reproduced enqueue-during-sync
loss and acceptance of NaN/fractional/missing-ID payloads. They were defect
reproductions, not real-device durability checks. Their later seven Jest
`test.failing` regressions still represent defects.

## Database and Auth review

P0-02, 2026-10-04: owner-supplied [export version 2](../database/snapshots/P0.02-database-review.json),
captured 13:35:43 UTC, PostgreSQL 17.6, exporting role postgres, database timezone UTC.
Reviewed all expected sections/seven complete functions, effective grants, RLS,
triggers/views and Storage configuration. This was snapshot analysis, not a remote
authorization test. The owner confirmed development/testing use without real cafe sales.
Root `queryresults.json` remains unchanged legacy metadata.

Before P1, review confirmed:

- Own-profile UPDATE permitted role escalation despite owner-only UI.
- Postgres-owned report views and anonymous grants exposed sensitive summaries.
- Broad order UPDATE/direct child insertion bypassed guarded payment/cancellation
  semantics, amounts and parent lifecycle.
- `place_order` was atomic and required `auth.uid()`, but lacked replay identity,
  robust finite/catalog/modifier/total validation and immutable history contracts.
- Stock decrement clamped insufficient stock; cancellation restoration was an
  invoker trigger. Category/date reports used mutable/current joins and creation date.
- Signup profile creation ignored supplied role metadata but defaulted to cashier.
  Enabled public signup therefore granted staff access without owner approval.
- Public Storage buckets and upload/auth/size/format boundaries needed P1 review.

These baseline findings map to P1/P2/P4/P6 requirements; current local role/report
fixes are recorded separately in [P1 evidence](P1-security.md). No baseline task
completion meant the vulnerabilities were fixed.

Owner-confirmed Auth configuration (not independently fetched): signup on,
anonymous off, Email only with confirmation on; localhost:3000 Site URL/no redirect
URLs; no hooks/CAPTCHA, one-hour JWT expiry, no single-session/time-box/inactivity
rules; email quota 2/hour, SMS 30/hour, refresh 150/5 minutes, verification 30/5
minutes, anonymous 30/hour, sign-in/signup and Web3 30/5 minutes. Four development
test accounts, none disabled; no established provisioning/role/disable/recovery
procedure. [Non-secret configuration record](../database/snapshots/P0.02-auth-configuration.json)
and [review summary](artifacts/P0.02-review-summary.json) preserve captured details.

## Automated foundation

P0-05, 2026-10-04: installed compatible Jest/Expo, React Native Testing Library,
matching React renderer, pinned Supabase CLI and CI checks. Fixed lint alias/JSX
defects without disabling rules. A component test exposed an unstable default
modifier-group array causing a render loop/heap exhaustion; a stable empty array
fixed that narrow defect, not the required-choice/cart/domain issues.

| Dated check | Observed outcome |
| --- | --- |
| `npm.cmd run test:ci -- --silent`, 2026-10-04 | Exit 0; 8 suites/41 cases (34 ordinary, 7 expected failures). Six-file coverage 83.71% statements/72.53% branches/75.36% functions/87.11% lines; not whole-app coverage. |
| `npm.cmd run lint`, 2026-10-04 | Exit 0; 0 errors/14 retained warnings. |
| `npx.cmd --no-install expo install --check`, dotenv disabled | Exit 0 after authorized online retry; SDK-compatible dependencies up to date. |
| `npm.cmd run db:start`; `npm.cmd run db:reset:local`; `npm.cmd run db:test` | Verified synthetic-only local stack; original replay and repeated 10 pgTAP checks passed. No linked/remote reset. |
| `npm.cmd run db:check` | Exit 0; source hash/deterministic migration/fixture checks, no SQL execution. |
| `npx.cmd --no-install expo export --platform android --output-dir dist/p02-20261004-android-final` | Exit 0; 1,848 modules/63 assets/~6.13 MB Hermes; placeholder public config, dotenv/upload disabled. No installed APK inferred. |
| `npm.cmd update shell-quote --no-fund`; `npm.cmd audit --json` | Compatible 1.8.3 → 1.12.0 patch; audit still exit 1, 69 affected packages (0 critical/52 high/16 moderate/1 low). [Final audit](artifacts/P0.2-20261004-audit.json). |

Initial audit capture: [P0.1 security audit](artifacts/P0.1-20261004-audit.json).
Hosted CI was configured/static-checked, not observed running. Temporary exports
remain under ignored `dist/`. Development/staging/production app variants and
inactive opt-in Sentry skeleton were prepared; compilation/mocked flush did not
prove installed environment isolation or event delivery.

## Environment and scope decisions

2026-10-05: owner created staging `omxoyujlteqcolqcdzxp`, explicitly deferred Sentry
to optional P12 and confirmed phone SM-A156E/DSN, Android 16. Phone-only initial
testing does not waive later tablet/landscape release qualification. The supplied
[CurrentSchema.sql](../database/snapshots/CurrentSchema.sql) is preserved context-only
SQL with unresolved types, not executable migration authority. Owner confirmed
the supplement came from the original development database.

Owner reviewed and approved eight [phone/tablet workflow wireframes](../design/pos-ux-blueprint.md),
completing P0-07 on 2026-10-05. [Menu capture](../design/menu-capture.md) records
38 named poster entries/nine sections/94 candidate choices, some provisional;
20 [acceptance scenarios](../specifications/cafe-acceptance.md) check specification
arithmetic, not implemented checkout/offline behavior. Owner confirmed unchanged
menu prices/portions and the PHP 99 three-mini-pizza mixed/same-flavor first-release
bundle. Unprinted units/labels and measured device targets remain P0-08 work.

2026-10-05/06 owner-approved sequencing: continue local P1/P2 development now;
retain staging but defer the next corrected APK/client acceptance to an integrated
cash-sale/offline milestone, before P7. Native checks are still required when
native security/storage behavior is introduced. No new build/provisioning authority
is implied; no unresolved checkbox was checked by this resequencing.

## Migration reconciliation and stock incident

2026-10-05: additive local reconciliation uses the hash-protected
[development supplement](../database/snapshots/P0.2-schema-supplement.json):
94 public table columns, 10 numeric(10,2) money columns, eight ALWAYS identities,
seven Realtime members, 384 relation grants and 48 postgres-owned public defaults.
Original baseline remained unchanged; managed Auth/Storage and protected
supabase_admin defaults were not recreated/elevated.

The migration rejects any existing sales before recreating generated subtotal and
dependent views. It is an empty-local reconstruction, **not** a real-history upgrade.
The JSON sequence maximum `9223372036854776000` was rounded; it was excluded from
SQL bounds. The read-only supplemental query casts large bounds to strings and
was successfully exercised locally, not rerun remotely.

Initial replay failed SQLSTATE 42501 attempting protected managed defaults; the
transaction rolled back. Omitting managed-role changes restored successful replay.
Fixture ALWAYS identities require explicit seed-only overrides. Final local reset
and `npx.cmd --no-install supabase test db` passed 35 checks; deterministic renderer
checks passed. [Reconciliation capture](artifacts/P0.2-20261005-reconciliation.json)
preserves the failure reproduction and source facts.

**Unfixed cashier cancellation incident:** start stock 20; unpaid one-portion
placement leaves 19; authenticated cashier cancels; order status changes but stock
remains 19, expected 20. Inventory UPDATE requires admin, while the invoker restore
trigger runs under cashier permissions and silently affects no inventory rows.
Two-portion smoke similarly left 18 rather than 20. Owner restoration passed, but
does not qualify cashier behavior. All probes rolled back; no failed business
assertion was hidden as a runner success. P1-03/P2-06/P4-07 must fix authorized
atomic restoration without granting broad cashier inventory writes.

## Controlled staging

2026-10-05, explicit staging-only owner authorization: authenticated CLI verified
ACTIVE_HEALTHY project `omxoyujlteqcolqcdzxp`, PostgreSQL 17.11, initially zero public
tables/functions, Auth users, buckets/objects. Rehearsed separate
`p0-closed-bootstrap-20261005-v1` transaction/empty-project guard locally, then
applied it only to staging. No original development/production writes, linked
reset, copied local passwords or real cafe transactions.

Closed bootstrap created 10 tables/two views, reconciled columns/identities/money,
seven Realtime members, four synthetic menu variants, test modifiers/portions and
two private buckets. Client table/sequence/function grants initially closed.
After owner-confirmed signup/anonymous off, Email-only and creation of two
confirmed private-credential test users, controlled access assigned intended
owner/admin and cashier profiles, a private allowlist, ten restrictive table
policies, staging RPC membership guard, invoker report views and Storage fence.
Account IDs remain in the reviewed staging SQL; credentials were not recorded.

| Exact staging/local check | Observed outcome |
| --- | --- |
| `npx.cmd --no-install supabase projects list --output json`, filtered authorized ref | Initial missing-token failure; after owner local CLI login, exit 0. |
| `npx.cmd --no-install supabase db query --linked --project-ref omxoyujlteqcolqcdzxp <read-only preflight> --output json` | Exit 0; empty target verified. Explicit ref without `--linked` failed before execution. |
| Local rehearsal via `Get-Content <SQL file> -Raw \| docker exec -i supabase_db_patanos-local psql -U postgres -d postgres -v ON_ERROR_STOP=1` | Bootstrap/verification/synthetic staff/controlled access/smoke passed; second bootstrap correctly rejected non-empty state. Local CLI multi-command prepared-query path was unsuitable. |
| `npx.cmd --no-install supabase db query --linked --project-ref omxoyujlteqcolqcdzxp --file supabase/staging/closed-bootstrap.sql --output json` | Exit 0; authorized closed transaction applied. Same explicit-ref command with verify-closed-bootstrap.sql passed initial-state checks. |
| Same explicit-ref command with `supabase/staging/controlled-access.sql` and `verify-controlled-access.sql` | Exit 0; anonymous/unapproved denial plus cashier/owner catalog/basic sale/payment/stock/report SQL-role smoke passed; probe rows rolled back. |
| Final read-only staging query | Two intended staff roles, 10 restrictive policies/two invoker views, no anonymous report/RPC access, zero sales/children, latte stock 20. |
| `npm.cmd run test:ci -- --silent`; lint; db:check | Exit 0; 12 suites/73 cases (66 ordinary + 7 known failures), 0 lint errors/14 warnings, unchanged provenance/deterministic SQL. |

SQL-role smoke used `SET LOCAL ROLE` and simulated claim IDs, **not password Auth,
PostgREST or Android**. Realtime membership is not WebSocket delivery. Synthetic
rollback probes can leave harmless identity sequence gaps. Local replay restored
normal fixtures and stopped with backup retained; Docker Desktop stayed running.
Structured results: [staging continuation capture](artifacts/P0-20261005-continuation.json).

## Build variant incident

2026-10-05: read-only authenticated
`eas.cmd build:view f679be56-850f-4f1c-8ab6-4c480f10d4e4 --json`, dotenv disabled
and non-secret fields filtered, returned FINISHED/ANDROID/INTERNAL, profile staging,
version 1.1.0/build 1/SDK 54.0.0. It reported **com.patanos.pos.dev**, not intended
com.patanos.pos.staging. Created 13:36:34 UTC, completed 15:09:42 UTC; associated
commit metadata `7b365e887d72a9ebf4ba1900b172bfeef7392ad3`. Uncommitted uploaded
source is not established by commit metadata. APK was not downloaded/inspected.

Expo project ID `0f37074f-f838-4cfa-9379-6d755a024a7a` matched local configuration.
Sandboxed EAS user lookup failed ENOMEM; permitted read-only retry succeeded.
Current profile resolves staging flag via the preview environment, but local edits
cannot change a finished artifact. The mismatch is consistent with upload before
the flag correction; it does not independently prove the APK backend.

Owner reported unchanged normal phone operation/menu prices. Read-only staging
showed both approved accounts' login timestamps null and zero completed sales.
Thus staging login/isolation/install was not evidenced. Focused app-config/cafe
fixture tests passed 27 cases; no Android flow was observed. Capture:
[build review metadata](artifacts/P0-20261005-build-review.json).

The later approved schedule defers a corrected build until useful integrated
cash-sale/offline testing. Do not repeatedly rebuild or clear old unsynced app data.

## Provenance

| Preserved artifact | SHA-256 |
| --- | --- |
| Reviewed database JSON | `845638c64e5a5f0c4bc3d81343a44d9eec591f2ad4f8aa279ec540b117a6ead2` |
| Development supplement JSON | `2176652529ebb7e7f6d9718421e67998656f109b61258cee3f4a529b7e8f8f9a` |
| Context-only CurrentSchema.sql | `43e5280055ca4a1927ce5ac4d335f8b87a4450934a1fd44949bada28479d35e3` |
| `supabase/staging/closed-bootstrap.sql` | `70e762d1db8bb8656a961bc9eeedb4dd7062cb2b0af3784784611a37eeb7a677` |
| `supabase/staging/verify-closed-bootstrap.sql` | `680dd4949d06c50c4e8a95ce6f2ae0892db3edc4e45a05b2fc0889a3919919d5` |
| `supabase/staging/controlled-access.sql` | `102fadcaf9c6a064027e7c46830db7ae1b42d12d292f90d692b0179a9d3a32fa` |
| `supabase/staging/verify-controlled-access.sql` | `84cfb99f90b36d42d33b05a86511248fd1e8c68989a5717d9d687159fec9cecd` |
| Owner menu poster | `1023817277699fd61ea271963cd777b5afe17a50994fbf2488b03d107dced42d` |

Raw captures keep their original embedded paths/timestamps. Current resolvers use
the organized snapshot locations with unchanged expected hashes. No raw metadata,
original/reconciled/P1 migration or staging SQL was rewritten during consolidation.

## Pending staging and device acceptance

This is a pending acceptance list, not a second progress checklist. P0-04/P0-06/
P0-08/P0-GATE remain unchecked in the tracker.

- At the approved integrated milestone: review fresh staging definitions/fences,
  separately authorize promotion, record migration revision/recovery plan, and
  repeat actual anonymous/cashier/owner password/API tests with private staging accounts.
- Configure intended staging public URL/key in EAS preview without exposing keys;
  build a correctly identified `.staging` APK only when separately authorized.
  Confirm installed package/label/backend side-by-side without deleting old POS data.
- Verify synthetic writes exist only in staging, real login/role resolution, menu
  and payment/error/offline flows; record phone model, Android/build versions and
  scenario outcomes. Compilation/profile labels are insufficient.
- Finish catalog unit/label rules and measured phone targets; qualify actual tablet
  landscape before corresponding P5/P7 acceptance. Scenario math/approved drawings
  do not establish runtime usability, complete offline cash sales or bundles.
- Reconcile sequence bounds with string-safe metadata if exact remote parity is
  required. Never run the guarded empty-local reconstruction over real history.
- Full production security, transactional/offline integrity, recovery and cafe
  release gates remain P1–P8. Hosted Sentry stays optional P12.
