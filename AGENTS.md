# Patanos POS Repository Guidance

## Project

Patanos POS is an Expo Router application for Android, iOS, and web. It uses React Native, Supabase Auth/Postgres/Realtime/Storage, AsyncStorage caching, and an offline order queue.

## Commands

- Install dependencies: `npm install`
- Start Expo: `npm start`
- Run Android: `npm run android`
- Run iOS: `npm run ios`
- Run web: `npm run web`
- Lint: `npm run lint`
- Unit/component tests: `npm test`; CI coverage: `npm run test:ci`
- Database provenance checks: `npm run db:check`; disposable local replay: `npm run db:reset:local`

Jest/Expo and React Native component tests now exist under `tests/`. Run the actual command before reporting its result. Seven `test.failing` cases reproduce known P2/P3 defects; their runner success is not a fixed POS invariant. State which SQL, remote, manual, or device checks remain. See `CONTRIBUTING.md` for setup and safe local reset rules.

## Architecture

- `app/`: Expo Router routes and route-group layouts.
  - `app/(auth)`: login.
  - `app/(admin)`: menu, modifiers, inventory, gallery, reports, and settings.
  - `app/(pos)`: order entry and open/completed orders.
- `src/components/`: reusable UI grouped by feature (`common`, `gallery`, `menu`, `pos`). Preserve this feature-based structure; do not impose Atomic Design folders.
- `src/contexts/`: authentication and cart state.
- `src/hooks/`: feature data access and realtime subscriptions.
- `src/lib/`: Supabase client and offline queue infrastructure.
- `src/utils/`: pure or narrowly scoped helpers.
- `src/constants/theme.js`: Electric Mango colors, fonts, spacing, and radii.
- `database-review.sql`: read-only database metadata query.
- `queryresults.json`: database metadata snapshot; it can become stale.

## Code Conventions

- Match the existing JavaScript/JSX style, single quotes, and extensionless `@/` imports.
- Use descriptive names. Avoid new single-letter variables except established coordinate/math notation.
- Add comments only for non-obvious intent, invariants, or failure handling.
- Keep route files focused on screen orchestration. Extract reusable UI to the matching feature folder.
- Do not rewrite unrelated legacy code for style consistency.
- Do not add a production dependency unless the task requires it and the user has authorized it.

## UI Rules

- Reuse `COLORS`, `FONTS`, `SPACING`, and `RADIUS`; do not introduce a parallel theme system.
- Design for touch and for both phone and tablet layouts. Preserve safe-area, keyboard, modal, and scrolling behavior.
- Preserve loading, empty, error, disabled, and offline states when changing a flow.
- Prefer React Native and Expo primitives already used by the project. Do not introduce Tailwind, shadcn/ui, browser-only CSS, or Next.js patterns.
- Use the `patanos-expo-ui` skill for material UI or navigation work.

## Auth and Supabase Safety

- The client uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never expose or introduce a Supabase service-role key in client code.
- UI redirects are not an authorization boundary. Preserve and review RLS policies, RPC permissions, and storage policies for data-sensitive changes.
- Treat `queryresults.json` as a snapshot. For schema-sensitive work, refresh it with `database-review.sql` or explicitly disclose that current production metadata was not verified.
- Multi-table business operations should remain atomic on the server when practical.
- Review Realtime subscriptions, cache refreshes, optimistic updates, and cleanup together with the underlying mutation.
- Do not execute remote SQL, migrations, deployments, or destructive Supabase operations without explicit user authorization.
- Use the `patanos-supabase-change` skill for Supabase queries, auth, schema, RPC, RLS, Realtime, or Storage changes.

## Order and Inventory Invariants

- The order path spans `CartContext`, `validateOrder`, `useOrders`, `offlineQueue`, the `place_order` RPC, and database triggers. Trace the full path before changing behavior.
- Validate the same payload before online submission and offline enqueue.
- `unit_price` already includes modifier prices. The subtotal is the sum of `unit_price * quantity`, with the existing one-peso validation tolerance unless requirements change.
- Keep server-side order creation atomic. Order-item insertion decrements stock; cancellation restores stock through database triggers in the current metadata snapshot.
- Preserve queue persistence, retry counts, the five-attempt dead-letter transition, sync locking, and visible queued-order state.
- Do not assume queued order submission is idempotent; explicitly analyze duplicate risk when changing retries or sync timing.
- Payment methods currently supported by the schema are `cash` and `gcash`; order types are `dine-in`, `takeout`, and `delivery`.
- Use the `patanos-order-integrity` skill for cart, totals, modifiers, order placement, offline sync, payment, cancellation, or inventory behavior.

## Implementation Plan Tracking

- Use `ProjectContext/implementationPlan.md` as the living development tracker. Read the relevant phase and its dependencies before starting planned work.
- Keep it compact: task labels/status live only in the tracker; complete task scope is linked in `ProjectContext/specifications/releaseRequirements.md`. Read the relevant scope, not every context document.
- Update affected task checkboxes, phase status/progress, and completion records in the same change that implements or verifies the work. Preserve stable task IDs and document scope changes.
- Check a task only when its full implementation and required verification are complete. Keep partial work or work awaiting staging/device checks unchecked and record what remains.
- Mark a phase `100% — Complete` only when every task and its acceptance gate are complete, dependencies are satisfied, and dated evidence is recorded. Use the plan's checklist-based progress formula; do not infer completion from existing screens or a successful build alone.
- Record exact checks and outcomes, changed files or commit, and remaining risks. Documentation updates are not application implementation progress.
- Reopen tasks and gates when regressions invalidate them; update phase progress and affected downstream verification requirements.
- Keep optional future phases separate from required Android release scope. Obtain explicit approval for material scope changes; the plan does not authorize remote SQL, service provisioning, or deployment.

## Context and Evidence Discipline

- Do not create a Markdown/evidence file for every task. For routine work, update the checkbox and add one short dated completion entry: task ID, exact command/result, and remaining checks. Git history, tests and commit/PR descriptions preserve ordinary implementation detail; do not invent a commit that does not exist.
- Maintain one evidence document per major phase or release gate under `ProjectContext/evidence/`, appending dated exceptional records instead of creating per-increment files.
- Detailed/dedicated dated evidence is justified only for security/authorization boundaries, migrations/RLS, payment/order/inventory/offline invariants, staging/device/release acceptance, or complex incidents/reproductions. Default to the existing phase document; split an incident only when necessary to preserve its reproduction.
- Keep consequential choices in `architectureDecisions.md`; static requirements/designs are references, not duplicate trackers. Preserve raw schema provenance bytes under `ProjectContext/database/snapshots/`.
- Temporary build/lint/debug logs belong in ignored `dist/` or outside version control. Retain tracked logs only for a release gate or unusual failure; never include secrets.
- Start with `ProjectContext/README.md` for locations. Load only the relevant task/decision/specification; historical evidence and raw snapshots are on-demand, not automatic context.

## Verification

- Use the `patanos-verify` skill before claiming repository work is complete.
- Run the smallest relevant checks first, then `npm run lint` for JavaScript/JSX changes.
- Validate every new or changed skill with Skill Creator's `quick_validate.py`.
- Report exact commands and outcomes. Separate verified facts from device checks or remote database behavior that were not run.

## Custom Agents

Project-scoped agents live in `.codex/agents/`:

- `expo_mapper`: read-only route, component, context, hook, and platform flow mapping.
- `pos_data_reviewer`: read-only review of POS, Supabase, offline, payment, and inventory risks.
- `mobile_ui_reviewer`: read-only native UI, accessibility, responsive, and theme review.

Do not spawn custom agents by default. Use them when the user asks for delegation or explicitly requests the corresponding focused review. Do not delegate overlapping write tasks in parallel.

## Scope Discipline

- Preserve user changes and unrelated untracked files.
- Keep edits limited to the requested outcome.
- Never delete `.github-template`, database metadata, or other project material unless the user separately requests it.
