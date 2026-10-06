# P0.3 Cafe Acceptance Scenarios

Date: 2026-10-05. P0-08: **Prepared; owner/catalog/device targets pending**. Scenario data lives in [cafeAcceptance.json](../../tests/fixtures/cafeAcceptance.json). Its Jest checks validate arithmetic/references only, not app behavior. String product IDs here are scenario identifiers, not current Supabase IDs.

## Representative runs

Each run starts from a known catalog, independently reset synthetic stock, authorized staff and a fixture shift. Reset only disposable local data; on staging use approved fixture operations and retain evidence. Never use customer data or real money during foundation testing.

| ID | Target scenario | Money / main expectation | Acceptance phases |
| --- | --- | --- | --- |
| AC-01 | Blue Lemonade 16 oz, cash | 39; tender 50; change 11; one durable sale | P2/P3/P5 |
| AC-02 | Okinawa 16 oz + pearl, less ice | 49; tender 100; change 51; extra counted once | P2/P5 |
| AC-03 | Pepperoni pizza | 39; one meal portion consumed | P2/P4/P5 |
| AC-04 | Modified drink + pizza | 88; tender 100; change 12; atomic lines | P2/P4/P5 |
| AC-05 | Dutch Milk float takeout | 59; packing note preserved | P2/P5 |
| AC-06 | Delivery pizza | 39; type/note preserved, no dispatch dependency | P2/P5 |
| AC-07 | Sold-out pizza | New sale blocked without collecting money | P2/P4/P5 |
| AC-08 | Save unpaid then pay | Reserve once; no unpaid revenue or second stock deduction | P2/P3/P4/P5 |
| AC-09 | Manual GCash drink | 49; explicit manual check; no cash drawer effect | P2/P5/P6 |
| AC-10 | Unprepared unpaid cancellation | Cashier-authorized operation releases exactly once | P1/P2/P4 |
| AC-11 | Prepared/unknown cancellation | No sellable restock by default; reason/disposition retained | P2/P4 |
| AC-12 | Owner cash refund | Original sale retained; refund 39 once; cashier denied | P1/P2/P4/P6 |
| AC-13 | Two offline modified drinks, restart | 98; tender 100; change 2; restart and sync exactly once | P1/P2/P3/P4 |
| AC-14 | Lost RPC response / fifth failure | Replay deduplicated; queued during sync retained; failures visible | P2/P3 |
| AC-15 | Same-device staff handover | Float 500 + cash sale 88 = drawer 588; original actor retained | P1/P3/P6 |
| AC-16 | Mixed/same three-pizza bundle | 99; two Hawaiian + one Pepperoni, or three of one flavor | P2/P4/P5 |
| AC-17 | Two bundles, restart/replay | 198; four Hawaiian + two Pepperoni consumed once | P2/P3/P4 |
| AC-18 | Bundle shortage/bad composition | No partial sale, silent flavor change or partial deduction | P2/P4/P5 |
| AC-19 | Whole-bundle refund | Linked 99 refund; no arbitrary per-pizza refund | P1/P2/P4/P6 |
| AC-20 | Failed local save / repeated tap | Cart retained, no false success or duplicate payment | P2/P3/P5 |

Prepared scenarios are future acceptance targets. Existing seven `test.failing` cases and the separate cashier-cancellation SQL defect remain open; these specification tests do not fix them.

## Phone/tablet and accessibility matrix

Record actual phone `SM-A156E/DSN`, owner-reported Android 16, available dp width/height, RAM/free storage, APK/version/backend and font scale. Owner confirmed current testing is phone-only; no tablet information is required for this P0.2 phone APK run. Retain ADR-10's tablet-portrait/landscape design and later P5/P7 hardware qualification; a phone run does not qualify those layouts. Include system bars, keyboard, rotation, resume, TalkBack and large text.

Run checkout, modifiers, bundle selection, unpaid lookup and sync recovery on each actual device class. Include loading, empty, offline cached, fetch error, insufficient stock, failed saving and disabled-role states. A desktop export or responsive wireframe does not qualify an Android installation.

## Performance and interaction targets

Do not invent response-time results. Current small four-variant fixtures are insufficient for menu load/search performance. [Poster capture](../design/menu-capture.md) estimates 94 candidate choices plus the bundle; owner confirms prices/portions unchanged, while unprinted variant/unit details and actual catalog configuration remain pending.

Before closing P0-08, agree target values from on-device measurement using the confirmed full catalog. Collect at least ten repeated runs per measured flow after recording cold versus warm/cache state; report median and slowest or p95 only with sample size stated. Log product/variant counts and image mode so measurements are comparable. These runs establish a baseline/target agreement, not release acceptance before P1-P6 are implemented.

| Measure | Proposed workflow requirement | Actual measurement / approved limit |
| --- | --- | --- |
| Login / role resolution | Both roles enter POS, no admin-first detour or role flash | Pending |
| Warm/cold usable catalog | Offline enrolled device loads usable approved menu, not a network spinner forever | Pending |
| Search response | Matching products remain usable while typing; clear/no-results feedback | Pending |
| Simple item -> cash success | Direct add only with no unresolved choice; checkout doesn't require Orders | Pending |
| Modified item -> cash success | One combined size/extras surface; no lost edits | Pending |
| Bundle selection -> cash success | Three visible slots; fixed 99 total; no manual discount steps | Pending |
| Tap count | Record actual steps; one final financial confirmation, no mandatory print/success modal | Pending |
| Restart recovery | Paid/unpaid records and pending count match persisted identities | Pending |
| Long session / large catalog | No clipped actions, runaway re-renders or progressively unusable list | Pending |

## Evidence worksheet

```text
Date / tester / scenario ID:
Fixture revision / catalog version / initial portions:
Device model / Android / available dp / font scale / RAM / free storage:
Build ID / APK version / package / verified backend:
Connectivity / cold or warm start / enrolled staff and fixture shift:
Actions / tap count / duration / sample count:
Observed totals / tender / change / order and payment identities:
Observed stock movements / original staff / drawer effects:
Restart / retry / role-denial results:
Pass, fail or not run / issue link / screenshots without customer data:
```

Owner reviewed and approved [wireframes](../design/pos-ux-blueprint.md) on 2026-10-05; P0-07 is complete for design/review. P0-08 remains unchecked until current menu/portion details and actual-device targets are agreed. P0-GATE also requires an isolated working staging client connection and verified Android installation.
