---
name: patanos-supabase-change
description: Safely design, implement, or review Patanos changes involving Supabase queries, Auth and roles, Postgres schema or RPCs, RLS, Realtime subscriptions, or Storage. Use for data-boundary changes; do not use for purely local UI edits.
---

# Patanos Supabase Change

Protect the agreement between the Expo client and Supabase rather than changing one side in isolation.

## Establish current truth

1. Read [references/data-map.md](references/data-map.md) for the known client and database boundaries.
2. Inspect the affected hooks, contexts, utilities, and SQL artifacts directly.
3. Treat `queryresults.json` as a snapshot. For schema-sensitive work, refresh it with the read-only `database-review.sql` query or clearly state that live metadata was not verified.
4. Do not read or expose `.env` values. The client may use the public Supabase URL and anon key; never add a service-role key to Expo code.

## Review the whole data boundary

- Check select/insert/update/delete behavior against RLS policies and the authenticated roles `admin` and `cashier`.
- Treat route guards as user experience only; database authorization must stand independently.
- For RPC or trigger changes, inspect transaction boundaries, function privileges, security-definer behavior, search-path safety, and all downstream triggers.
- For Realtime changes, check subscription filters, stable channel ownership, cleanup, refetch behavior, and duplicate refreshes.
- For optimistic updates, define rollback and error feedback.
- For cached data, define what happens when remote reads fail, data is stale, or connectivity returns.
- For Storage, review the target bucket, object naming, MIME handling, public-read exposure, and upload/update/delete policies.
- For reports, preserve the meaning of the `daily_sales` and `category_sales` views or document the intentional change.

Prefer a server-side RPC for business operations that must update multiple tables atomically. Avoid duplicating authorization or financial calculations only in the client.

## Authorization boundary

Creating migration files or client code is allowed when requested. Running remote SQL, changing live policies, deploying functions, or deleting remote data requires explicit user authorization for that external mutation.

## Verification

- Re-check every affected table, view, RPC, trigger, policy, and client caller.
- Run `$patanos-verify` for repository checks.
- Report whether validation used the metadata snapshot or freshly queried Supabase metadata.
