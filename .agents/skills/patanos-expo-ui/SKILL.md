---
name: patanos-expo-ui
description: Build or materially change Patanos Expo Router screens and React Native components while preserving its feature architecture, Electric Mango theme, native ergonomics, and phone/tablet behavior. Use for UI, navigation presentation, forms, modals, or responsive layout work; do not use for data-only or Supabase-only changes.
---

# Patanos Expo UI

Implement UI that belongs in the existing application rather than a generic web mockup.

## Start from the existing flow

1. Locate the route under `app/` and the feature components it composes.
2. Inspect `src/constants/theme.js` and nearby components before choosing styles or interaction patterns.
3. Trace state into contexts or hooks when the UI changes behavior; do not move data access into presentation components merely for convenience.
4. Identify the required loading, empty, error, disabled, saving, and offline states before editing.

## Architecture

- Keep route files responsible for screen orchestration and navigation.
- Put reusable elements in the matching `src/components/<feature>/` folder. Use `common/` only for genuinely cross-feature components.
- Preserve the repository's feature-based organization. Do not create atoms/molecules/organisms/templates folders.
- Reuse existing components and patterns before adding a new abstraction.

## Native UI requirements

- Use React Native and Expo primitives already present in the project.
- Reuse `COLORS`, `FONTS`, `SPACING`, and `RADIUS`; extend the central theme only when a reusable token is genuinely missing.
- Preserve the Electric Mango dark visual identity and the configured Permanent Marker/DM Sans typography.
- Account for safe-area insets, keyboard visibility, scrolling, orientation constraints, and modal/sheet dismissal.
- Make primary actions easy to reach and touch. Add accessibility labels or roles where the visible text or control semantics are insufficient.
- Check both compact phone and wider tablet layouts. Prefer `useWindowDimensions` and layout measurements over fixed screen assumptions.
- Keep offline and sync status visible in workflows that depend on network state.

## Boundaries

- Do not add Tailwind, shadcn/ui, browser-only CSS, or Next.js patterns.
- Do not introduce a UI dependency unless the user has authorized it and the existing stack cannot reasonably satisfy the requirement.
- Do not redesign unrelated screens or replace the established theme as part of a focused feature.
- When a task changes order, auth, or Supabase behavior, also use the matching domain skill rather than treating it as visual-only work.

## Completion

Use `$patanos-verify` to choose the relevant static and manual checks. UI completion normally requires stating which phone/tablet and native/web interactions were actually exercised.
