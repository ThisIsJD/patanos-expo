# Project context

Start with [implementationPlan.md](implementationPlan.md), the single compact status/checklist tracker. Read the linked task scope, then only the decisions/references needed for that work. Do not load this entire folder into context by default.

```text
ProjectContext/
  implementationPlan.md       Single tracker and short completion entries
  architectureDecisions.md    Consequential technical choices and unresolved decisions
  specifications/             Full task scope and cafe acceptance requirements
  design/                     Approved POS layouts and menu capture
  evidence/                   One maintained document per major phase/release gate
    artifacts/                Necessary raw security/incident/acceptance captures
  database/
    snapshots/                Immutable schema/Auth provenance inputs
    queries/                  Supplemental read-only metadata query
  assessments/                Dated initial codebase/readiness assessment
  references/                 On-demand tooling/contributor reference
  assets/                     Owner-supplied menu poster
```

## Reading map

- Planned task: [tracker](implementationPlan.md) → its anchor in [full requirements](specifications/releaseRequirements.md); no second checklist exists there.
- Technical choice: relevant section of [architecture decisions](architectureDecisions.md).
- UI/catalog work: [approved UX](design/pos-ux-blueprint.md), [menu capture](design/menu-capture.md) and [acceptance scenarios](specifications/cafe-acceptance.md).
- Critical boundary or acceptance proof: [P0 foundation evidence](evidence/P0-foundation.md) or [P1 security evidence](evidence/P1-security.md), selecting the relevant section/date only.
- Schema provenance: [reviewed export](database/snapshots/P0.02-database-review.json), [supplement](database/snapshots/P0.2-schema-supplement.json) and [context-only schema](database/snapshots/CurrentSchema.sql). Root `queryresults.json` remains legacy evidence, not fresh production metadata.
- Initial findings: [dated assessment](assessments/currentImplementation.md); current status is in the tracker.

## Writing policy

For routine work, update the affected checkbox and append one short `date | task | command → result; remaining check` entry to the tracker. Use tests, Git history and commit/PR descriptions for ordinary implementation history; do not create a separate evidence file.

Maintain one evidence document per major phase or release gate. Append dated evidence only for security/authorization, migrations/RLS, payment/order/inventory/offline invariants, staging/device/release acceptance, or complex incidents/reproductions. Split a dated incident file only when necessary to preserve a complex reproduction; default to the phase document. Do not create empty future-phase evidence files.

Temporary logs/backups stay outside version control (`dist/` is ignored). Raw security captures, unusual failures or release-gate proof may be retained under `evidence/artifacts/`. Preserve snapshot bytes and captured timestamps; historical embedded paths describe their original capture location. Moving a file never refreshes its evidence.

2026-10-06 consolidation preserved 103 task IDs, seven completed items and all complete task scopes. Eight overlapping P0 records/worksheets were summarized into one phase record; the old files and routine lint log are recoverable from the ignored local backup under `dist/context-backups/`. No application phase was advanced by this cleanup.
