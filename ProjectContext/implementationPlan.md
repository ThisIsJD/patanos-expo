# Patanos POS Implementation Plan

Created: 2026-10-04 · Updated: 2026-10-06 · Version: 1.18

**Current:** hardening MVP; P0 55.6% (5/9), P1 33.3% (3/9). Eight of 103 stable items checked. Not deployment/cafe-ready. P1-01/02/03 are verified locally; P1-04 lifecycle/recovery and P1-05 locking/safe logout are locally implemented in part. Owner deferred encrypted native credential storage; AsyncStorage remains. Recovery sending stays off; offline/email/remote/device gates remain open.

## How to use this tracker

- This is the single status/checklist source. Read each linked [full task scope](specifications/releaseRequirements.md) before implementation; labels below are summaries, not reduced requirements.
- Check an item only after full scope and required verification pass. Partial implementation and pending native/staging acceptance remain unchecked. Update progress in the same change; regressions reopen tasks/gates.
- Progress = checked items / phase items, including GATE. A phase is **100% — Complete** only with every item/gate/dependency satisfied and dated phase evidence. Documentation maintenance earns no application completion credit.
- Routine work: checkbox plus one short dated entry with task ID, command/result and remaining checks. Use Git history, tests and commit/PR descriptions for ordinary implementation details; do not create per-task evidence files.
- Maintain one [phase evidence document](evidence) per major phase or release gate. Append dated entries for security/authorization, migrations/RLS, payment/order/inventory/offline invariants, staging/device/release acceptance or complex incidents only. A separate dated incident file requires a real need to preserve a complex reproduction; default to the phase document.
- Keep raw [database provenance](database/snapshots) unchanged. Temporary logs go under ignored `dist/` or outside the repository; retain in version control only unusual failures or release-gate proof. Never record credentials/customer/payment evidence unnecessarily.
- Consequential decisions: [architectureDecisions.md](architectureDecisions.md). Reference locations and reading policy: [ProjectContext index](README.md). Do not load historical evidence/snapshots unless needed for the task.

## Dependencies and development sequence

| Phase | Outcome | Depends on | Progress | Status |
| --- | --- | --- | --- | --- |
| P0 | Revalidated baseline, test/staging foundation, agreed UX blueprint | None | 55.6% (5/9) | Foundation available; remaining staging/install/catalog acceptance deferred, not complete |
| P1 | Secure staff and data boundaries | P0-01/02/03/05/07 and verified local replay | 33.3% (3/9) | Database authorization and partial lifecycle/locking verified locally; encrypted storage, offline and hosted/device gates open |
| P2 | Atomic, replay-safe order and payment contract | Completed P0 foundation; P1 security contracts for integration | 0% | Not started; local design/tests may precede deferred staging gates |
| P3 | Complete offline cash operation and recovery | P1, P2 | 0% | Not started |
| P4 | Reliable product/portion inventory | P2, P3 | 0% | Not started |
| P5 | POS-first Android UI/UX redesign | P0 design; P1–P4 for integration | 0% | Not started |
| P6 | Shifts, refunds, reconciliation, and usable reports | P2–P5 | 0% | Not started |
| P7 | Integrated reliability and release-candidate verification | P0–P6 | 0% | Not started |
| P8 | Controlled cafe pilot and production handoff | P7 | 0% | Not started |
| P9 | Optional thermal printing | P8 | 0% | Deferred |
| P10 | Ingredient and recipe inventory | P4, P8 | 0% | Deferred |
| P11 | Additional payments, platforms, and business expansion | Relevant completed foundations | 0% | Deferred |
| P12 | Optional hosted error/crash monitoring | Verified staging/build foundation; separate owner approval | 0% (0/3) | Deferred by owner; not an Android release gate |

Owner-approved 2026-10-05 sequence: develop/test P1/P2 locally now; integrate P3 offline cash sales with P5 screens, testing native behavior when introduced. Keep staging. At the integrated cash-sale/offline milestone, obtain separate promotion/build authorization and finish P0-04/P0-06/P0-GATE; all must pass before P7. Finish P0-08 catalog/performance targets before related P2/P5 acceptance. Build earlier only when native/configuration changes or a specific device check requires it. P7 verifies the exact candidate; P8 pilots/releases. Sentry is optional P12.

P1 database-authorization development acceptance requires rollback-only SQL plus genuine anonymous/cashier/owner local Auth/API tests; staging repetition remains P1-GATE. All other stated device/remote criteria remain required. No plan entry authorizes remote SQL, provisioning, deployment or cloud builds.

## Checklist

## P0 — Revalidate the baseline and build the development foundation


### P0.1 — Baseline and decision records

- [x] **P0-01** Capture baseline/toolchain findings. [Scope](specifications/releaseRequirements.md#p0-01).
- [x] **P0-02** Review database/Auth provenance. [Scope](specifications/releaseRequirements.md#p0-02).
- [x] **P0-03** Record consequential architecture decisions. [Scope](specifications/releaseRequirements.md#p0-03).

### P0.2 — Safe environments and automated checks

- [ ] **P0-04** Reproducible local and isolated staging setup. [Scope](specifications/releaseRequirements.md#p0-04).
- [x] **P0-05** Automated tests, CI and lint foundation. [Scope](specifications/releaseRequirements.md#p0-05).
- [ ] **P0-06** Verify distinct Android build/install targets. [Scope](specifications/releaseRequirements.md#p0-06).

### P0.3 — UX blueprint and acceptance scenarios

- [x] **P0-07** Owner-approved phone/tablet UX blueprint. [Scope](specifications/releaseRequirements.md#p0-07).
- [ ] **P0-08** Real menu scenarios and measured device targets. [Scope](specifications/releaseRequirements.md#p0-08).
- [ ] **P0-GATE** Deferred staging/client isolation and reproducible install before P7. [Scope](specifications/releaseRequirements.md#p0-gate).

## P1 — Close security gaps and establish safe staff access


### P1.1 — Database authorization

- [x] **P1-01** Prevent self-promotion; audited owner role changes. [Scope](specifications/releaseRequirements.md#p1-01).
- [x] **P1-02** Owner-only reports; real Auth/API role tests. [Scope](specifications/releaseRequirements.md#p1-02).
- [x] **P1-03** Close order/RPC write bypasses and cancellation permissions. [Scope](specifications/releaseRequirements.md#p1-03).

### P1.2 — Account lifecycle and device security

- [ ] **P1-04** Owner staff lifecycle, recovery and POS-first authorization. [Scope](specifications/releaseRequirements.md#p1-04).

  Partial: navigation/recovery plus owner Settings approval, roles and disabling pass local checks. Dashboard-created confirmed logins require explicit cafe approval; new/existing profiles default inactive in the local migration. RLS/RPCs reject disabled/unapproved staff even with an existing JWT; last active owner protected. Recovery sending stays off. Initial-owner bootstrap, actual email qualification, reconnect/offline and native/staging acceptance remain open (ADR-13/14).

- [ ] **P1-05** Native credential storage, locking and safe sign-out. [Scope](specifications/releaseRequirements.md#p1-05).

  Partial: cold/manual/background lock preserves the mounted cart; foreground return requires same-account online password/profile verification. Local logout drains tracked POS/staff operations and preserves queues; other-account/unknown-actor records are held, not reassigned. Owner deferred `expo-secure-store` on 2026-10-06: tokens/verifiers still use AsyncStorage. Native credential protection, bounded offline unlock and device/privacy qualification remain open (ADR-15).

- [ ] **P1-06** Bounded enrolled offline identities and reconnect checks. [Scope](specifications/releaseRequirements.md#p1-06).

### P1.3 — Secrets, storage, and audit boundaries

- [ ] **P1-07** Review secrets/history; safe configuration templates. [Scope](specifications/releaseRequirements.md#p1-07).
- [ ] **P1-08** Harden uploads, audit access and retention. [Scope](specifications/releaseRequirements.md#p1-08).
- [ ] **P1-GATE** Staging negative tests plus Android disable/logout/offline-lock acceptance. [Scope](specifications/releaseRequirements.md#p1-gate).

## P2 — Make orders, payments, and stock effects transactional


### P2.1 — Domain validation and immutable history

- [ ] **P2-01** Finite centavo/quantity validation on client and server. [Scope](specifications/releaseRequirements.md#p2-01).
- [ ] **P2-02** Correct variants/modifiers/cart identity and three-pizza bundle. [Scope](specifications/releaseRequirements.md#p2-02).
- [ ] **P2-03** Immutable sale/payment/catalog/actor/time/bundle snapshots. [Scope](specifications/releaseRequirements.md#p2-03).

### P2.2 — Replay-safe server operations

- [ ] **P2-04** Unique operation IDs and replay/payload-conflict handling. [Scope](specifications/releaseRequirements.md#p2-04).
- [ ] **P2-05** Atomic guarded creation, payment and cancellation. [Scope](specifications/releaseRequirements.md#p2-05).
- [ ] **P2-06** Exactly-once stock effects and explicit cancellation disposition. [Scope](specifications/releaseRequirements.md#p2-06).

### P2.3 — Offline compatibility and reporting semantics

- [ ] **P2-07** Authorized offline ingestion and paid-sale conflict handling. [Scope](specifications/releaseRequirements.md#p2-07).
- [ ] **P2-08** Asia/Manila recognition, delayed sync and legacy dates. [Scope](specifications/releaseRequirements.md#p2-08).
- [ ] **P2-GATE** Atomic rollback, replay, transitions, stock/time and staging migration recovery. [Scope](specifications/releaseRequirements.md#p2-gate).

## P3 — Deliver complete offline cash sales and reliable synchronization


### P3.1 — Durable local transaction storage

- [ ] **P3-01** Transactional local storage and durable sale/outbox writes. [Scope](specifications/releaseRequirements.md#p3-01).
- [ ] **P3-02** Recoverable migration of active/dead-letter legacy queues. [Scope](specifications/releaseRequirements.md#p3-02).
- [ ] **P3-03** Persist drafts, catalog and authorized offline cold start. [Scope](specifications/releaseRequirements.md#p3-03).

### P3.2 — Cashier-visible offline behavior

- [ ] **P3-04** Offline cash sale, unpaid payment/cancellation and lookup. [Scope](specifications/releaseRequirements.md#p3-04).
- [ ] **P3-05** Visible pending/failed records and safe recovery. [Scope](specifications/releaseRequirements.md#p3-05).
- [ ] **P3-06** Preserve staff/shift identity and controlled device handover. [Scope](specifications/releaseRequirements.md#p3-06).

### P3.3 — Synchronization and reconciliation

- [ ] **P3-07** Per-operation acknowledgment and restart/race recovery. [Scope](specifications/releaseRequirements.md#p3-07).
- [ ] **P3-08** Connectivity/resume/manual sync with bounded retry. [Scope](specifications/releaseRequirements.md#p3-08).
- [ ] **P3-09** Identity-based reconciliation and dependent event ordering. [Scope](specifications/releaseRequirements.md#p3-09).
- [ ] **P3-GATE** Phone/tablet offline trading, restart/reconnect and failure/recovery acceptance. [Scope](specifications/releaseRequirements.md#p3-gate).

## P4 — Make product and portion tracking dependable


### P4.1 — Product setup and operational visibility

- [ ] **P4-01** Reachable stock tools and truthful POS availability. [Scope](specifications/releaseRequirements.md#p4-01).
- [ ] **P4-02** Reliable stock records and real size/portion setup. [Scope](specifications/releaseRequirements.md#p4-02).
- [ ] **P4-03** Atomic product relationships, archival and bundle portions. [Scope](specifications/releaseRequirements.md#p4-03).

### P4.2 — Auditable stock movements

- [ ] **P4-04** Audited replay-safe stock movements. [Scope](specifications/releaseRequirements.md#p4-04).
- [ ] **P4-05** Version-aware cycle counts and configuration edits. [Scope](specifications/releaseRequirements.md#p4-05).
- [ ] **P4-06** Unsynced-aware sellable stock and discrepancy recovery. [Scope](specifications/releaseRequirements.md#p4-06).

### P4.3 — Cancellation, refund, and sale verification

- [ ] **P4-07** Correct cancellation restoration versus prepared-food waste. [Scope](specifications/releaseRequirements.md#p4-07).
- [ ] **P4-08** Stock history, adjustments and no duplicate consumption. [Scope](specifications/releaseRequirements.md#p4-08).
- [ ] **P4-GATE** Independent portions ledger across online/offline, replay and adjustments. [Scope](specifications/releaseRequirements.md#p4-gate).

## P5 — Redesign the Android POS experience


### P5.1 — Navigation, theme, and responsive shell

- [ ] **P5-01** POS-first routes and secondary protected owner tools. [Scope](specifications/releaseRequirements.md#p5-01).
- [ ] **P5-02** Responsive phone/tablet layouts and landscape state retention. [Scope](specifications/releaseRequirements.md#p5-02).
- [ ] **P5-03** Refine Electric Mango typography, contrast and state clarity. [Scope](specifications/releaseRequirements.md#p5-03).

### P5.2 — Menu discovery and accurate cart editing

- [ ] **P5-04** Fast local menu/variant search and categories. [Scope](specifications/releaseRequirements.md#p5-04).
- [ ] **P5-05** One-tap simple items; required choices and bundle flavor sheet. [Scope](specifications/releaseRequirements.md#p5-05).
- [ ] **P5-06** Accurate editable cart, notes and large touch controls. [Scope](specifications/releaseRequirements.md#p5-06).

### P5.3 — Fast checkout and saved orders

- [ ] **P5-07** Fast Pay & Complete/Save Unpaid and service-type selection. [Scope](specifications/releaseRequirements.md#p5-07).
- [ ] **P5-08** Keyboard-safe cash/GCash checkout, tender/change and recovery. [Scope](specifications/releaseRequirements.md#p5-08).
- [ ] **P5-09** Truthful confirmation and searchable cross-date unpaid/history. [Scope](specifications/releaseRequirements.md#p5-09).

### P5.4 — Accessibility and feedback

- [ ] **P5-10** 48-dp controls, TalkBack, scaling and predictable focus. [Scope](specifications/releaseRequirements.md#p5-10).
- [ ] **P5-11** Loading/error/offline/stale states and startup/subscription recovery. [Scope](specifications/releaseRequirements.md#p5-11).
- [ ] **P5-12** Measured owner/cashier usability on phone and landscape tablet. [Scope](specifications/releaseRequirements.md#p5-12).
- [ ] **P5-GATE** Unguided owner/cashier flows on both device classes and failure states. [Scope](specifications/releaseRequirements.md#p5-gate).

## P6 — Add daily cafe controls and trustworthy reporting


### P6.1 — Shift opening, handover, and close

- [ ] **P6-01** Single-register shifts, opening float and named handover. [Scope](specifications/releaseRequirements.md#p6-01).
- [ ] **P6-02** Authorized cash movements and correct drawer formula. [Scope](specifications/releaseRequirements.md#p6-02).
- [ ] **P6-03** Offline-capable closing count, variance and immutable handover. [Scope](specifications/releaseRequirements.md#p6-03).

### P6.2 — Payment correction, refunds, and GCash

- [ ] **P6-04** Bounded owner refunds, whole-bundle units and stock disposition. [Scope](specifications/releaseRequirements.md#p6-04).
- [ ] **P6-05** Safe durable offline owner refunds for verifiable local sales. [Scope](specifications/releaseRequirements.md#p6-05).
- [ ] **P6-06** Manual GCash confirmation, references and merchant reconciliation. [Scope](specifications/releaseRequirements.md#p6-06).

### P6.3 — Reports and minimum owner administration

- [ ] **P6-07** Business-date gross/refund/net/unpaid/pending reports. [Scope](specifications/releaseRequirements.md#p6-07).
- [ ] **P6-08** Paginated history, detail/export and freshness warnings. [Scope](specifications/releaseRequirements.md#p6-08).
- [ ] **P6-09** Minimum operational owner tools and audited feedback. [Scope](specifications/releaseRequirements.md#p6-09).
- [ ] **P6-GATE** Independent full-day cash/GCash/shift/refund/stock reconciliation. [Scope](specifications/releaseRequirements.md#p6-gate).

## P7 — Prove reliability and prepare a release candidate


### P7.1 — Automated regression and security coverage

- [ ] **P7-01** Critical domain/UI regression assertions in CI. [Scope](specifications/releaseRequirements.md#p7-01).
- [ ] **P7-02** Real staging authorization/integrity and failure injection. [Scope](specifications/releaseRequirements.md#p7-02).
- [ ] **P7-03** Android journeys with outages, kills and ambiguous commit responses. [Scope](specifications/releaseRequirements.md#p7-03).

### P7.2 — Device, performance, and local operational checks

- [ ] **P7-04** Signed candidate on actual phone/tablet; accessibility/performance. [Scope](specifications/releaseRequirements.md#p7-04).
- [ ] **P7-05** Visible operational warnings and privacy-safe owner response. [Scope](specifications/releaseRequirements.md#p7-05).
- [ ] **P7-06** Release-lockfile dependency/security and Expo qualification. [Scope](specifications/releaseRequirements.md#p7-06).

### P7.3 — Recovery and safe releases

- [ ] **P7-07** Rehearse backend/local recovery; state offline data-loss limits. [Scope](specifications/releaseRequirements.md#p7-07).
- [ ] **P7-08** Non-empty-queue upgrades and safe rollback/forward recovery. [Scope](specifications/releaseRequirements.md#p7-08).
- [ ] **P7-09** Signing/version/environment/distribution and operating runbooks. [Scope](specifications/releaseRequirements.md#p7-09).
- [ ] **P7-GATE** Exact release candidate passes CI, staging, device and restore/upgrade gates. [Scope](specifications/releaseRequirements.md#p7-gate).

## P8 — Run a controlled cafe pilot and hand over production


### P8.1 — Pilot preparation

- [ ] **P8-01** Owner-approved pilot, obligations, real configuration and devices. [Scope](specifications/releaseRequirements.md#p8-01).
- [ ] **P8-02** Train staff and rehearse uniquely referenced manual fallback. [Scope](specifications/releaseRequirements.md#p8-02).
- [ ] **P8-03** Agree pilot period and measurable reconciliation criteria. [Scope](specifications/releaseRequirements.md#p8-03).

### P8.2 — Supervised operation and final release

- [ ] **P8-04** Supervised pilot, independent reconciliation and regression recovery. [Scope](specifications/releaseRequirements.md#p8-04).
- [ ] **P8-05** Owner go/no-go and separately authorized production promotion. [Scope](specifications/releaseRequirements.md#p8-05).
- [ ] **P8-06** Hand over custody, backups, support and daily-close procedures. [Scope](specifications/releaseRequirements.md#p8-06).
- [ ] **P8-GATE** Successful pilot, production smoke, recovery/support and owner sign-off. [Scope](specifications/releaseRequirements.md#p8-gate).

## P9 — Optional receipt and thermal printing


### P9.1 — Hardware and receipt requirements

- [ ] **P9-01** Qualify actual printer hardware/protocol/connectivity. [Scope](specifications/releaseRequirements.md#p9-01).
- [ ] **P9-02** Confirm receipt requirements, formatting and reprint labels. [Scope](specifications/releaseRequirements.md#p9-02).

### P9.2 — Printing integration and recovery

- [ ] **P9-03** Optional durable print jobs and non-blocking failure/retry. [Scope](specifications/releaseRequirements.md#p9-03).
- [ ] **P9-GATE** Actual printer interruption/reconnect/reprint on supported hardware. [Scope](specifications/releaseRequirements.md#p9-gate).

## P10 — Ingredient and recipe inventory


### P10.1 — Recipes, units, and receiving

- [ ] **P10-01** Real ingredient units, conversions and receiving precision. [Scope](specifications/releaseRequirements.md#p10-01).
- [ ] **P10-02** Versioned recipes/modifiers and portion-ledger migration. [Scope](specifications/releaseRequirements.md#p10-02).

### P10.2 — Consumption and reconciliation

- [ ] **P10-03** Atomic replay-safe consumption, waste/returns and offline recovery. [Scope](specifications/releaseRequirements.md#p10-03).
- [ ] **P10-04** Verified ingredient counts, variance, thresholds and costing. [Scope](specifications/releaseRequirements.md#p10-04).
- [ ] **P10-GATE** Measured real-recipe pilot and preserved portion/ingredient integrity. [Scope](specifications/releaseRequirements.md#p10-gate).

## P11 — Expanded payments, platforms, and administration


### P11.1 — Additional payment and pricing features

- [ ] **P11-01** Separately approved split payments, discounts and tax rules. [Scope](specifications/releaseRequirements.md#p11-01).
- [ ] **P11-02** Authenticated gateway settlement/callbacks and reconciliation. [Scope](specifications/releaseRequirements.md#p11-02).

### P11.2 — Web, iOS, and broader business workflows

- [ ] **P11-03** Independently qualify web offline/SSR and signed iOS. [Scope](specifications/releaseRequirements.md#p11-03).
- [ ] **P11-04** Requested secondary CMS/preparation/delivery/location expansion. [Scope](specifications/releaseRequirements.md#p11-04).
- [ ] **P11-GATE** Approved adopted scope delivered with independent acceptance. [Scope](specifications/releaseRequirements.md#p11-gate).

## P12 — Optional hosted error and crash monitoring


### P12.1 — Authorized service setup

- [ ] **P12-01** Separately authorized opt-in Sentry setup and privacy. [Scope](specifications/releaseRequirements.md#p12-01).

### P12.2 — Delivery and diagnostics qualification

- [ ] **P12-02** Actual staging delivery, source maps, alerts and native privacy. [Scope](specifications/releaseRequirements.md#p12-02).
- [ ] **P12-GATE** Actual hosted diagnostics/alerts; monitoring loss cannot block checkout. [Scope](specifications/releaseRequirements.md#p12-gate).

## Current gaps and next work

- Next unaffected local work: P1-07 secrets/configuration audit, then P1-08 upload/audit boundaries. P1-05 encrypted storage is deferred by owner, not waived for release; P1-06 enrolled offline identity remains open. P1-04 needs hosted initial-owner bootstrap and actual redirect/email/native checks with separate authorization. Recovery sending stays off (`EXPO_PUBLIC_PASSWORD_RECOVERY_ENABLED=false`); P1-GATE remains required.
- New locks pause order mutations/retries and hold other/unknown staff queue records without retry penalties. Actor metadata is not server authorization; legacy recovery, concurrent queue writes and lost-acknowledgement replay remain P2/P3. Logout warns that unsaved in-memory drafts are not durable. Local logout does not instantly invalidate an issued JWT.
- Profile lookup failure now blocks protected screens with Retry/Sign out. No cached offline permission grant is implemented: an outage during startup or permission revalidation can stop POS access and unmount its in-memory draft. Persisted queued records are not deleted; bounded offline identity/durable drafts remain P1-06/P3, not a completed offline cafe workflow.
- Updated reports/orders/staff administration need the additive P1 migrations. Remote backends are unchanged; these tools may be unavailable until separately authorized coordinated promotion. Staff approval defaults inactive, so promotion must explicitly bootstrap the reviewed initial owner and review existing staff; never bulk-enable profiles or blindly push the local reconstruction.
- Cashier cancellation now restores aggregated portions only for explicitly unprepared orders; prepared/unknown portions stay consumed. Seven known expected-failure client/offline tests remain P2/P3 defects. Replay-safe sale/payment/stock ledgers, mixed-line waste disposition and offline cash acceptance are not implemented by P1-03.
- Current phone: SM-A156E/DSN, Android 16 (owner-reported). Tablet qualification remains open. Catalog price/portion confirmation exists; unprinted fries/siomai units and measured performance targets remain pending.
- Owner-approved [UX blueprint](design/pos-ux-blueprint.md) and [acceptance scenarios](specifications/cafe-acceptance.md) are specifications, not implemented flows. Printing, ingredient inventory and content polish are not the next priority.

## Compact completion entries

| Date | Task/work | Command/result and remaining checks |
| --- | --- | --- |
| 2026-10-04 | P0-01/02/03 | Baseline `npm.cmd run lint`: 81 errors/14 warnings; audit: 53 affected packages; Android export/debug build passed. Reviewed SQL/Auth and recorded decisions, not fixes. [P0 evidence](evidence/P0-foundation.md). |
| 2026-10-04 | P0-05 | `npm.cmd run test:ci -- --silent`: 8 suites/41 cases; `npm.cmd run lint`: 0 errors/14 warnings; local replay/10 SQL checks passed. Seven expected failures remain defects. Later counts are below. |
| 2026-10-05 | P0-07 | Owner explicitly approved eight phone/tablet blueprint flows. Scenario arithmetic/configuration tests passed; application UI/device acceptance not implied. |
| 2026-10-05 | P0-04/06/08 partial | Authorized staging containment/SQL-role smoke passed; supplied EAS build FINISHED but reported `.dev`. Password-client isolation/install and measured targets remain open. [P0 evidence](evidence/P0-foundation.md). |
| 2026-10-06 | P1-01/02 | `npx.cmd --no-install supabase test db`: 77 checks; `node scripts/test-security-api.cjs`: 28 local HTTP/Auth checks; `npm.cmd run test:ci -- --silent`: 14 suites/82 cases (7 expected failures); lint: 0 errors/14 warnings; db:check and Android export passed. Remote/device gates open. [P1 evidence](evidence/P1-security.md). |
| 2026-10-06 | Documentation consolidation | `npm.cmd run test:ci -- --silent`: 15 suites/87 cases (7 known expected failures); `npm.cmd run lint`: 0 errors/14 warnings; `npm.cmd run db:check` and `git diff --check`: pass. 103 IDs/states/full scopes and 20 raw/SQL hashes preserved; no application progress credit. |
| 2026-10-06 | P1-03 | `npx.cmd --no-install supabase test db`: 142 checks; `node scripts/test-security-api.cjs`: 57 local Auth/API checks, including terminal/stock races; `npm.cmd run test:ci -- --silent`: 18 suites/104 cases (7 known expected failures); lint: 0 errors/14 existing warnings; db:check/diff: pass. Synthetic probes cleaned; remote/native gates open. [P1 evidence](evidence/P1-security.md). |
| 2026-10-06 | P1-04 partial | Auth/router regressions: 26 pass; `npm.cmd run test:ci -- --silent`: 20 suites/130 cases (7 known expected failures); lint: 0 errors/12 existing warnings; db:check and local Android export pass. Profile races/POS-first/cart-return fixed; staff lifecycle/recovery/offline/native gates open. [P1 evidence](evidence/P1-security.md). |
| 2026-10-06 | P1-04 recovery partial | Focused recovery/router: 71 pass; `npm.cmd run test:ci -- --silent`: 24 suites/190 cases (7 known expected failures); lint: 0 errors/12 existing warnings; db:check and local Android export pass. Approved `expo-crypto` added; recovery sending default-off. Staff administration and actual email/device gates open. [P1 evidence](evidence/P1-security.md). |
| 2026-10-06 | P1-04 staff lifecycle partial | `npx.cmd --no-install supabase test db`: 190 checks; `node scripts/test-security-api.cjs`: 79 local Auth/API checks; `npm.cmd run test:ci -- --silent`: 26 suites/222 cases (7 known expected failures). Lint: 0 errors/12 existing warnings; db:check/Android export pass. Approval/roles/disable/signup boundary implemented locally; probes cleaned. Hosted bootstrap/email/device gates open. [P1 evidence](evidence/P1-security.md). |
| 2026-10-06 | P1-05 locking/logout partial | `npm.cmd run test:ci -- --silent`: 28 suites/260 cases (7 known expected failures); `node scripts/test-session-auth.cjs`: 11 local SDK/Auth checks; lint: 0 errors/10 existing warnings; Android export pass. Mounted-cart lock and queue actor holds implemented; encrypted storage deferred, native/offline gates open. [P1 evidence](evidence/P1-security.md). |

Keep entries short: `YYYY-MM-DD | task ID | command → result; remaining check`. Merge routine detail into commit/PR descriptions; collapse closed-phase entries to a concise phase result/evidence link. Do not duplicate a chronological change log or raw command output here.
