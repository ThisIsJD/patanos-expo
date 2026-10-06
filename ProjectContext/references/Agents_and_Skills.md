# Codex Agents and Skills for Patanos POS

Status: **implemented after approval**  
Prepared: 2026-10-02

Implemented with a root `AGENTS.md`, three project-scoped custom agents, four repo-scoped skills, and the approved user-level `security-best-practices` skill. Application code and `.github-template` remain unchanged.

## Recommendation

Use a deliberately small Codex setup:

- One repository-level `AGENTS.md` for facts and rules that apply to nearly every task.
- Three optional, read-only custom agents for focused exploration and review.
- Four repo-scoped skills for repeatable workflows that require Patanos-specific knowledge.
- One curated security skill installed only if approved.
- Do not copy the entire `.github-template` pack. Much of it is Copilot-specific, generic behavior Codex already provides, or web/document tooling unrelated to this Expo application.

This follows the official OpenAI guidance that Codex reads repository `AGENTS.md` files as project instructions, while skills package reusable workflows and are selected from their name and description. Custom agents should be narrow and are most useful for isolated exploration or review work.

Official references:

- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Subagents and project-scoped custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Skills](https://developers.openai.com/plugins/concepts/skills)
- [Testing Agent Skills Systematically](https://developers.openai.com/blog/eval-skills)

## Project Findings That Drive the Design

| Area | Repository evidence | Implication for Codex setup |
|---|---|---|
| Application | Expo 54, React Native 0.81, React 19, Expo Router 6 | Guidance must target native/mobile patterns, not Next.js, browser CSS, Tailwind, or shadcn/ui. |
| Navigation | Route groups under `app/(auth)`, `app/(admin)`, and `app/(pos)` | Changes must preserve role-aware redirects and route-group boundaries. |
| State | `AuthContext`, `CartContext`, and feature hooks | Agents need to trace route → hook/context → Supabase flows before changing behavior. |
| Backend | Supabase Auth, Postgres tables/views/RPC, Realtime, and Storage | Database changes require RLS, role, RPC, realtime, and storage-policy review—not just client code changes. |
| Critical workflow | Cart → validation → online `place_order` RPC or offline queue → sync → payment/cancellation | Order totals, inventory effects, duplicate prevention, retries, and offline/online parity are business-critical invariants. |
| Offline behavior | AsyncStorage menu cache, queued orders, retry counts, and dead-letter queue | Ordinary UI or hook edits can cause data loss or duplicate orders unless offline behavior is checked explicitly. |
| UI system | Fixed “Electric Mango” dark theme in `src/constants/theme.js`; phone/tablet-responsive POS screens | A mobile UI skill should preserve brand tokens, touch ergonomics, safe areas, and layout behavior. |
| Verification | `npm run lint` exists; no test script or test dependency is configured | Do not claim tests pass. Use lint and task-specific Expo/manual checks, and defer a TDD skill until a test stack exists. |
| Releases | EAS profiles and Android package are configured | Release-specific automation could be added later, but it is not frequent enough yet to justify a skill. |

## Project Instructions

| File | Implemented action | Why it is needed |
|---|---|---|
| `AGENTS.md` | Created an adapted repository instruction file | Codex automatically loads it at the project root. It holds stable project facts, commands, architecture, safety rules, and routing to the four skills. |
| `.codex/config.toml` | Do not create initially | The custom agents work without project-wide model or concurrency overrides. Avoid hard-coding account-dependent models or increasing parallelism without a demonstrated need. |
| Nested `AGENTS.md` files | Do not create initially | The repository is compact and its current rules are consistent across `app/` and `src/`. Add nested overrides only if database or native-platform areas later need conflicting rules. |

The root `AGENTS.md` contains:

| Section | Adapted content |
|---|---|
| Stack and commands | npm, Expo Router, React Native, Supabase; `npm install`, `npm start`, `npm run android`, `npm run ios`, `npm run web`, and `npm run lint`. |
| Architecture map | Routes in `app/`; components grouped by feature in `src/components`; data behavior in hooks; shared state in contexts; Supabase/offline infrastructure in `src/lib`. |
| Code conventions | JavaScript/JSX, extensionless `@/` imports, single quotes, existing formatting, descriptive names, focused comments, and feature-based components. |
| UI rules | Reuse `COLORS`, `FONTS`, `SPACING`, and `RADIUS`; preserve safe-area, phone/tablet, loading, empty, error, and offline states. |
| Data safety | Never expose service-role keys; preserve auth/role checks; inspect RLS/RPC/storage implications; treat `queryresults.json` as a metadata snapshot that may be stale. |
| POS invariants | Server-side order creation remains atomic; validate online and offline payloads; preserve price/quantity rules, queue retries, dead-letter behavior, and cancellation/inventory effects. |
| Verification | Run fresh relevant checks; never report unavailable tests as passing; clearly state manual or device checks that remain. |
| Skill routing | Route only matching work to the four project skills. No generic “always use a skill” meta-rule. |
| Delegation | Use custom agents only when the user requests delegation or the task explicitly calls for their focused review; avoid parallel overlapping writes. |

## Custom Agents

These are project-scoped TOML definitions under `.codex/agents/`. They are not independent always-running bots. Codex may spawn them when explicitly requested or when approved project instructions call for their narrow role.

| Agent | File | Mode | Responsibility | Why this project needs it |
|---|---|---|---|---|
| `expo_mapper` | `.codex/agents/expo-mapper.toml` | Read-only | Trace an affected screen through Expo Router, contexts, hooks, components, and platform-specific behavior; return exact files and data flow without editing. | Route, auth, cart, and hook responsibilities are distributed. A focused map reduces changes made in the wrong layer. |
| `pos_data_reviewer` | `.codex/agents/pos-data-reviewer.toml` | Read-only | Review order, payment, inventory, offline sync, Supabase RPC/RLS, realtime, and storage changes for correctness and data-loss/duplication risks. | This POS handles business-critical monetary and inventory state across local and remote systems. |
| `mobile_ui_reviewer` | `.codex/agents/mobile-ui-reviewer.toml` | Read-only | Review changed React Native UI for phone/tablet layout, safe areas, keyboard and modal behavior, touch targets, accessibility, loading/error/offline states, and theme consistency. | Web-centric review misses native interaction and responsive issues present in this app. |

No custom implementation agent was created. Codex already includes general-purpose `default` and execution-focused `worker` agents; another project worker would duplicate them.

The agent files should inherit the parent model and reasoning settings rather than pinning a model. This makes the repository portable across accounts and future Codex versions.

## Repo-Scoped Skills

All project skills live under `.agents/skills/<skill-name>/SKILL.md`, the current official repo-scoped skill location. Their descriptions are narrow enough to avoid triggering for unrelated work.

| Skill | Source | Trigger and scope | Why this project needs it | Resources |
|---|---|---|---|---|
| `patanos-expo-ui` | Adapt `frontend-design`; absorb the useful intent of `atomic-design` | Creating or materially changing Patanos screens, React Native components, navigation UI, forms, modals, and responsive layouts | The old skill assumes web/CSS/Tailwind and the old Atomic Design hierarchy conflicts with the repository’s feature-based folders. This version enforces native ergonomics and the existing Electric Mango design system. | Instruction-only; references existing `src/constants/theme.js` and component folders instead of copying assets. |
| `patanos-supabase-change` | New, informed by the existing data-access code | Any change to Supabase queries, tables, views, functions/RPC, auth/profile roles, Realtime subscriptions, or Storage uploads | Client changes can silently conflict with RLS, security-definer functions, storage policies, realtime refresh behavior, or database schema. | `SKILL.md` plus `references/data-map.md`, with an explicit warning to refresh metadata before schema-sensitive work. |
| `patanos-order-integrity` | New, incorporating relevant debugging/TDD concerns | Cart, totals, validation, order placement, offline queue/sync, payment, cancellation, or inventory behavior | This is the highest-risk workflow. The skill preserves online/offline parity, atomic server order placement, retry/dead-letter semantics, and regression-focused verification. | `SKILL.md` plus `references/order-flow.md` documenting current boundaries and invariants. |
| `patanos-verify` | Adapt `verification-before-completion`; absorb the useful parts of `requesting-code-review` | Before reporting a Patanos code/config task complete, or when the user requests verification/review | The repo currently has lint but no automated test suite. A project-specific verification matrix prevents false “tests pass” claims and chooses checks based on the files changed. | Instruction-only. It uses `npm run lint` plus focused Expo/config/manual checks and reports unverified device behavior explicitly. |

### Skill boundaries

| Concern | Where it belongs | Reason |
|---|---|---|
| Stable paths, commands, formatting, and security rules | `AGENTS.md` | These affect most tasks and should be present without loading a skill. |
| React Native visual implementation | `patanos-expo-ui` | A recognizable, repeatable domain workflow with project-specific constraints. |
| Supabase schema/security/data access | `patanos-supabase-change` | Requires a specialized checklist and current data map. |
| POS transaction behavior | `patanos-order-integrity` | Contains non-obvious business invariants and failure modes. |
| Completion evidence | `patanos-verify` | Reusable task-dependent command/check selection. |
| Generic planning, brainstorming, or “use skills first” | Neither | Codex already handles these; always loading extra meta-process instructions adds ceremony and trigger noise. |

## Curated Skill Installation

The official curated catalog was checked with the bundled Skill Installer. Only the approved skill was installed.

| Curated skill | Recommendation | Why |
|---|---|---|
| `security-best-practices` | **Installed in the user Codex skills directory** | Relevant to Supabase Auth, RLS, RPC permissions, public storage URLs, environment variables, role boundaries, and POS/payment-adjacent data. Use for explicit security reviews or security-sensitive changes, not every edit. |
| `playwright` | Do not install now | It can test Expo web, but it does not validate native Android/iOS behavior and no browser E2E setup exists. Reconsider if web becomes a supported deployment target with E2E tests. |
| `screenshot` | Do not install now | Helpful for UI capture, but not necessary to encode the project workflow. Add only when screenshot-based review becomes routine. |
| `sentry` | Do not install now | The app does not currently include Sentry. Install together with an approved observability rollout. |
| `figma-*` | Do not install now | No Figma source or design-system workflow exists in the repository. |
| `migrate-to-codex` | Do not install | This conversion is a one-time repository setup, not an ongoing project capability. |
| `openai-docs` | No action | It is already available as a bundled system skill in this environment; a user-installed duplicate is unnecessary. |

## Legacy `.github-template` Disposition

| Legacy item | Decision | Adaptation or reason |
|---|---|---|
| `root-files/AGENTS.md` | Adapt | Replace Copilot routing and placeholders with actual Expo/Supabase/POS context, Codex skill paths, verification commands, and data-safety rules. |
| `root-files/CLAUDE.md` | Do not copy | Codex does not need a duplicate Claude instruction file. |
| `root-files/GEMINI.md` | Do not copy | Codex does not need a duplicate Gemini instruction file. |
| `instructions/code-style.instructions.md` | Absorb into `AGENTS.md` | Useful but too small and universal to justify a separate Codex skill. Preserve descriptive names, exact technical terms, sparse comments, and no unrelated cleanup. |
| `instructions/atomic-design.instructions.md` | Replace | The project uses feature folders (`common`, `menu`, `gallery`, `pos`), not atoms/molecules/organisms/templates. |
| `instructions/project-skills.instructions.md` | Replace | Codex discovers repo skills from `.agents/skills`; routing belongs in concise `AGENTS.md` guidance and skill descriptions. |
| `instructions/superpowers-workflow.instructions.md` | Drop | Duplicates generic agent behavior and would force process ceremony for ordinary work. |
| `instructions/caveman-always-on.instructions.md` | Drop | Response brevity is a user preference, not a Patanos engineering requirement. |
| `using-superpowers` | Drop | Meta-skill designed for Copilot. Codex already receives skill metadata and chooses matching skills. |
| `brainstorming` | Drop as a project skill | Generic capability; use normal collaboration when requirements are genuinely ambiguous. |
| `writing-plans` | Drop as a project skill | Generic capability; plans can be requested directly without a repository skill. |
| `executing-plans` | Drop as a project skill | Generic capability already covered by Codex task execution. |
| `subagent-driven-development` | Replace with narrow custom agents and one delegation rule | Avoids a broad instruction that encourages expensive or conflicting parallel writes. |
| `systematic-debugging` | Absorb selectively | Root-cause and reproduction requirements go into the two data/order skills and verification guidance where they become project-specific. |
| `test-driven-development` | Defer | No test runner or test script exists. Revisit after choosing and configuring a React Native-compatible test stack. |
| `verification-before-completion` | Adapt to `patanos-verify` | Keep the evidence gate but use the commands and limitations of this repository. |
| `requesting-code-review` | Absorb into `patanos-verify` and reviewer agents | Findings-first review is useful, but a separate skill would overlap with the custom review agents. |
| `frontend-design` | Adapt to `patanos-expo-ui` | Remove web-only typography/CSS/motion guidance; use React Native, Expo, platform behavior, and the established brand tokens. |
| `atomic-design` | Merge into `patanos-expo-ui` as feature-architecture guidance | Preserve component extraction principles without imposing a folder hierarchy the repository does not use. |
| `theme-factory` | Drop | Patanos already has a fixed theme and brand assets. Generating unrelated themes would create inconsistency. |
| `web-artifacts-builder` | Drop | Its Vite/Tailwind/shadcn/single-HTML workflow is unrelated to the Expo application. |
| `docx` | Drop | Word-document production is not part of the application workflow. |
| `caveman` | Drop | Not project-specific; users can request concise replies directly. |

## Deferred Test Skill

A project testing skill is intentionally not proposed yet. Before one can be useful, the project needs an explicit testing decision and working commands. A later setup could add Jest with React Native Testing Library, or another Expo-compatible choice, followed by a `patanos-testing` skill that documents:

- pure unit tests for `validateOrder`, price formatting, menu grouping, and offline queue transitions;
- reducer tests for cart identity, modifiers, quantities, and totals;
- hook/integration tests for online/offline order placement and sync;
- navigation/auth tests for cashier and admin route protection;
- device or E2E coverage for payment and image-picker flows.

Until then, `patanos-verify` must state that automated tests are unavailable rather than pretending TDD is enforceable.

## Implemented File Tree

```text
AGENTS.md
.codex/
`-- agents/
    |-- expo-mapper.toml
    |-- mobile-ui-reviewer.toml
    `-- pos-data-reviewer.toml
.agents/
`-- skills/
    |-- patanos-expo-ui/
    |   |-- SKILL.md
    |   `-- agents/openai.yaml
    |-- patanos-order-integrity/
    |   |-- SKILL.md
    |   |-- agents/openai.yaml
    |   `-- references/
    |       `-- order-flow.md
    |-- patanos-supabase-change/
    |   |-- SKILL.md
    |   |-- agents/openai.yaml
    |   `-- references/
    |       `-- data-map.md
    `-- patanos-verify/
        |-- SKILL.md
        `-- agents/openai.yaml
```

The approved curated `security-best-practices` skill is installed in the user Codex skills directory by Skill Installer; it is not copied into this repository.

## Implementation and Validation Record

The approved implementation:

1. Created the root `AGENTS.md`, project-scoped `.codex/agents`, and repo-scoped `.agents/skills` files listed above.
2. Adapted content to the current repository rather than mechanically copying `.github-template`.
3. Validated all four skills with Skill Creator’s `quick_validate.py`.
4. Parsed all three agent TOML files and confirmed the required fields and `sandbox_mode = "read-only"`.
5. Ran `npm.cmd run lint` successfully. The `.cmd` launcher was used because the local PowerShell execution policy blocks `npm.ps1`.
6. Installed `security-best-practices` in the user Codex skills directory.
7. Left `.github-template` untouched as historical/source material.

## Implemented Approval Boundary

The approved implementation covered only the proposed Codex setup files and installation of the curated `security-best-practices` skill. It did not authorize:

- application feature changes;
- database migrations or Supabase mutations;
- dependency or test-framework installation;
- deletion of `.github-template`;
- EAS builds, submissions, or deployments.

Approval received for the following scope:

> Approved: create the proposed `AGENTS.md`, three custom agents, four repo-scoped skills, and install `security-best-practices`. Do not change application code or delete `.github-template`.
