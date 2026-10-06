---
name: patanos-verify
description: Verify Patanos repository changes with fresh evidence and report remaining risk. Use before claiming implementation, fixes, configuration, agent setup, or skills are complete, and for explicit code-review or validation requests.
---

# Patanos Verify

Match each completion claim to an observable check. Do not substitute a generic command for behavior it cannot prove.

## Baseline checks

- Inspect the final diff and changed-file list for scope, accidental files, secrets, and unfinished placeholders.
- Run `git diff --check` for tracked changes. Inspect untracked files directly because that command does not cover them.
- Run `npm run lint` for JavaScript/JSX changes and before broad repository completion claims.
- The repository has no automated test script. Never say tests pass unless a test framework is later added and its actual command succeeds.

## Change-specific checks

| Change | Minimum evidence |
|---|---|
| Skill | Run Skill Creator's `quick_validate.py` on every changed skill; inspect its description, referenced files, and generated `agents/openai.yaml`. |
| Custom agent | Parse or otherwise validate TOML; confirm `name`, `description`, and `developer_instructions`; confirm reviewers are read-only. |
| `AGENTS.md` or docs | Inspect rendered structure, links/paths, commands, and consistency with the current repository. |
| JavaScript/JSX | Focused reproduction or behavior check plus `npm run lint`. |
| Expo config/navigation | Validate configuration and start/export the relevant platform when proportionate; report platforms not run. |
| UI | Exercise relevant loading, empty, error, disabled, keyboard/modal, offline, phone, and tablet states, or list the unperformed device checks. |
| Supabase | Verify client callers plus affected RLS/RPC/trigger/storage boundaries; say whether metadata is fresh or from `queryresults.json`. |
| Orders/offline sync | Cover the affected online, offline, retry, reconnection, payment, cancellation, and inventory scenarios from `$patanos-order-integrity`. |

## Review mode

When the user asks for review, lead with concrete findings ordered by severity. Include file references and failure scenarios. Do not inflate style preferences into defects. If no findings are established, say so and identify untested or externally unverified areas.

## Completion report

State:

1. what was checked;
2. the exact commands and their outcomes;
3. which behavior was manually exercised;
4. what remains unverified and why.

Do not claim a device flow, remote Supabase behavior, build, test suite, or deployment succeeded unless it was actually run and observed.
