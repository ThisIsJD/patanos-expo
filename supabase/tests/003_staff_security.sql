-- Local synthetic authorization regressions. Every mutation rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();
CREATE TEMP TABLE initial_role_audit AS
SELECT count(*)::int AS row_count, coalesce(max(id), 0) AS last_id FROM patanos_private.staff_role_audit;

SELECT ok(NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), 'no broad profile UPDATE grant');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
  AND has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE'), 'safe profile fields remain editable');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'), 'identity and role columns are protected');
SELECT ok(NOT has_schema_privilege('authenticated', 'patanos_private', 'USAGE')
  AND NOT has_schema_privilege('anon', 'patanos_private', 'USAGE'), 'private audit schema is not accessible to API roles');
SELECT ok(NOT has_table_privilege('authenticated', 'patanos_private.staff_role_audit', 'SELECT,INSERT,UPDATE,DELETE'), 'no client audit grants');
SELECT ok(NOT has_function_privilege('anon', 'public.set_staff_role(uuid,public.user_role)', 'EXECUTE'), 'anonymous cannot execute role helper');
SELECT ok((SELECT bool_and(prosecdef AND proconfig = ARRAY['search_path=""']::text[]) FROM pg_proc
  WHERE oid IN ('public.set_staff_role(uuid,public.user_role)'::regprocedure,
    'public.owner_daily_sales(date,date)'::regprocedure, 'public.owner_category_sales(date,date)'::regprocedure)),
  'owner RPCs use fixed empty search paths and trusted execution');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.guard_profile_identity_and_role()'::regprocedure), 'guard checks invoking SQL identity');

-- User-editable metadata cannot select a privileged role.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('55555555-5555-4555-8555-555555555555', 'metadata-probe@patanos.test', '{"role":"admin","full_name":"Synthetic metadata probe"}');
SELECT is((SELECT role::text FROM public.profiles WHERE id = '55555555-5555-4555-8555-555555555555'), 'cashier', 'signup metadata cannot inject admin');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT throws_ok($$UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()$$, '42501', NULL, 'direct self-promotion rejected');
SELECT lives_ok($$UPDATE public.profiles SET full_name = 'Synthetic edited cashier', avatar_url = NULL WHERE id = auth.uid()$$, 'own safe fields still work through RLS');
SELECT is((SELECT role::text FROM public.profiles WHERE id = auth.uid()), 'cashier', 'denied update did not mutate role');
WITH changed AS (UPDATE public.profiles SET full_name = 'Forbidden other profile'
  WHERE id = '11111111-1111-4111-8111-111111111111' RETURNING id)
SELECT is(count(*)::int, 0, 'cashier cannot edit another profile') FROM changed;
SELECT throws_ok($$SELECT public.set_staff_role(auth.uid(), 'admin')$$, '42501', 'Only an owner can assign staff roles', 'cashier cannot use trusted role helper');
SELECT throws_ok($$SELECT * FROM public.daily_sales$$, '42501', NULL, 'cashier cannot read daily view');
SELECT throws_ok($$SELECT * FROM public.category_sales$$, '42501', NULL, 'cashier cannot read category view');
SELECT throws_ok($$SELECT * FROM public.owner_daily_sales('2000-01-01', '2100-01-01')$$, '42501', 'Only an owner can read sales reports', 'cashier daily RPC denied');
SELECT throws_ok($$SELECT * FROM public.owner_category_sales('2000-01-01', '2100-01-01')$$, '42501', 'Only an owner can read sales reports', 'cashier category RPC denied');
RESET ROLE;

-- Defense in depth if a future migration accidentally re-grants table UPDATE.
GRANT UPDATE ON public.profiles TO authenticated;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()$$, '42501',
  'Profile identity and role require a trusted server operation', 'invoker trigger blocks promotion even after accidental broad grant');
RESET ROLE;
REVOKE UPDATE ON public.profiles FROM authenticated;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT throws_ok($$SELECT * FROM public.daily_sales$$, '42501', NULL, 'anonymous daily view denied');
SELECT throws_ok($$SELECT * FROM public.category_sales$$, '42501', NULL, 'anonymous category view denied');
SELECT throws_ok($$SELECT public.set_staff_role('22222222-2222-4222-8222-222222222222', 'admin')$$, '42501', NULL, 'anonymous role helper denied');
SELECT throws_ok($$SELECT * FROM public.owner_daily_sales('2000-01-01', '2100-01-01')$$, '42501', NULL, 'anonymous daily RPC denied');
SELECT throws_ok($$SELECT * FROM public.owner_category_sales('2000-01-01', '2100-01-01')$$, '42501', NULL, 'anonymous category RPC denied');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
SELECT throws_ok($$SELECT * FROM public.owner_daily_sales('2000-01-01', '2100-01-01')$$, '42501', 'Only an owner can read sales reports', 'identity without a staff profile is denied');
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT throws_ok($$UPDATE public.profiles SET role = 'admin' WHERE id = '22222222-2222-4222-8222-222222222222'$$, '42501', NULL, 'owner must also use the role helper');
SELECT throws_ok($$SELECT public.set_staff_role(auth.uid(), 'cashier')$$, '42501', 'The last owner cannot be demoted', 'last owner protected');
SELECT throws_ok($$SELECT public.set_staff_role(NULL, 'cashier')$$, '22023', 'Staff identity and role are required', 'null staff identity rejected');
SELECT throws_ok($$SELECT public.set_staff_role('66666666-6666-4666-8666-666666666666', 'cashier')$$, '22023', 'Staff profile not found', 'missing target rejected');
SELECT is(public.set_staff_role('22222222-2222-4222-8222-222222222222', 'admin')->>'role', 'admin', 'owner can promote staff through trusted path');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT is(public.get_user_role()::text, 'admin', 'role helper resolves the new server-stored role');
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT is(public.set_staff_role('22222222-2222-4222-8222-222222222222', 'cashier')->>'role', 'cashier', 'owner can demote another owner when one remains');
SELECT lives_ok($$SELECT public.set_staff_role('22222222-2222-4222-8222-222222222222', 'cashier')$$, 'same-role request is a no-op');
SELECT throws_ok($$SELECT * FROM public.daily_sales$$, '42501', NULL, 'even owner reads reports through the checked RPC');
SELECT throws_ok($$SELECT * FROM public.owner_daily_sales('2026-10-06', '2026-10-05')$$, '22023', 'A valid inclusive report date range is required', 'reversed daily range rejected');
SELECT throws_ok($$SELECT * FROM public.owner_category_sales(NULL, '2026-10-05')$$, '22023', 'A valid inclusive report date range is required', 'null category range rejected');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM patanos_private.staff_role_audit)
  - (SELECT row_count FROM initial_role_audit), 2, 'both role changes audited, no-op and rejected changes excluded');
SELECT ok((SELECT bool_and(actor_id = '11111111-1111-4111-8111-111111111111'
  AND staff_id = '22222222-2222-4222-8222-222222222222' AND previous_role <> new_role)
  FROM patanos_private.staff_role_audit WHERE id > (SELECT last_id FROM initial_role_audit)), 'audit records authoritative actor, target and transition');

-- Non-empty reports verify owner visibility and exact date filtering, not just empty-query success.
INSERT INTO public.orders (created_by, order_type, subtotal, total_amount, status, payment_method, created_at)
VALUES ('22222222-2222-4222-8222-222222222222', 'takeout', 120, 120, 'completed', 'cash', '2026-10-05 04:00:00+00');
INSERT INTO public.order_items (order_id, menu_item_id, item_name, quantity, unit_price)
SELECT id, 101, 'Test Iced Latte', 1, 120 FROM public.orders;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT is((SELECT sum(total_revenue) FROM public.owner_daily_sales('2026-10-05', '2026-10-05')), 120::numeric, 'owner sees completed cashier sale');
SELECT is((SELECT sum(revenue) FROM public.owner_category_sales('2026-10-05', '2026-10-05')), 120::numeric, 'owner sees underlying category revenue');
SELECT is((SELECT count(*)::int FROM public.owner_daily_sales('2026-10-06', '2026-10-06')), 0, 'report excludes dates outside range');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT throws_ok($$SELECT * FROM public.owner_daily_sales('2026-10-05', '2026-10-05')$$, '42501', 'Only an owner can read sales reports', 'demoted staff cannot see non-empty report');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
