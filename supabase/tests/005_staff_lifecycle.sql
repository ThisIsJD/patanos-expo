-- Synthetic lifecycle regressions. No Auth passwords, email delivery, or remote target.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();
CREATE TEMP TABLE initial_access_audit AS SELECT count(*)::int AS row_count FROM patanos_private.staff_access_audit;

SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'is_enabled', 'UPDATE'), 'approval column has no client write grant');
SELECT ok(NOT has_table_privilege('authenticated', 'patanos_private.staff_access_audit', 'SELECT,INSERT,UPDATE,DELETE'), 'access audit is private');
SELECT ok(NOT has_function_privilege('anon', 'public.set_staff_enabled(uuid,boolean,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.approve_staff(uuid,public.user_role,text)', 'EXECUTE'), 'anonymous cannot call lifecycle RPCs');
SELECT ok((SELECT bool_and(prosecdef AND proconfig = ARRAY['search_path=""']::text[]) FROM pg_proc
  WHERE oid IN ('public.set_staff_enabled(uuid,boolean,text)'::regprocedure,
    'public.approve_staff(uuid,public.user_role,text)'::regprocedure, 'public.get_user_role()'::regprocedure)),
  'lifecycle authorization uses trusted execution and fixed search paths');
SELECT is((SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public'
  AND policyname = 'Enabled staff access' AND permissive = 'RESTRICTIVE'), 9, 'nine operational tables require active staff');

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('55555555-5555-4555-8555-555555555555', 'pending@patanos.test', now(), '{"role":"admin","is_enabled":true}'),
  ('66666666-6666-4666-8666-666666666666', 'unconfirmed@patanos.test', NULL, '{"role":"admin","is_enabled":true}');
INSERT INTO auth.users (id, email, email_confirmed_at, is_anonymous, banned_until) VALUES
  ('77777777-7777-4777-8777-777777777777', 'anonymous@patanos.test', now(), true, NULL),
  ('88888888-8888-4888-8888-888888888888', 'banned@patanos.test', now(), false, now() + interval '1 day');
SELECT ok((SELECT bool_and(NOT is_enabled AND role = 'cashier') FROM public.profiles
  WHERE id NOT IN ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')),
  'confirmed signup and injected metadata never automatically grant staff access');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
SELECT is(public.get_user_role()::text, NULL, 'confirmed but unapproved account has no staff role');
SELECT is((SELECT count(*)::int FROM public.inventory), 0, 'unapproved signed-in identity cannot read stock');
SELECT is((SELECT count(*)::int FROM public.menu_items), 0, 'unapproved signed-in identity cannot read operational catalog');
SELECT is((SELECT count(*)::int FROM public.profiles), 1, 'unapproved account can read only its own profile');
SELECT throws_ok($$SELECT public.place_order('takeout',120,120,NULL,'[{"menu_item_id":101,"quantity":1,"unit_price":120,"modifiers":[{"id":201,"extra_price":0}]}]')$$,
  '42501', 'An authenticated staff profile is required', 'unapproved account cannot place a sale');
SELECT throws_ok($$SELECT public.approve_staff(auth.uid(), 'admin', 'Self approval')$$,
  '42501', NULL, 'unapproved account cannot approve itself');
SELECT throws_ok($$UPDATE public.profiles SET is_enabled = true WHERE id = auth.uid()$$, '42501', NULL, 'raw self-approval denied');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT throws_ok($$SELECT public.set_staff_enabled(auth.uid(), false, 'Unauthorized disabling')$$,
  '42501', NULL, 'cashier cannot change staff access');
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT throws_ok($$SELECT public.set_staff_enabled(auth.uid(), false, 'Disable last owner')$$,
  '42501', 'The last active owner cannot be disabled', 'last active owner protected');
SELECT throws_ok($$SELECT public.set_staff_enabled(NULL, false, 'Missing staff')$$, '22023', NULL, 'null target rejected');
SELECT throws_ok($$SELECT public.set_staff_enabled('99999999-9999-4999-8999-999999999999', true, 'Missing staff')$$,
  '22023', 'Staff profile not found', 'unknown target rejected');
SELECT throws_ok($$SELECT public.set_staff_enabled('22222222-2222-4222-8222-222222222222', NULL, 'Missing state')$$,
  '22023', NULL, 'null state rejected');
SELECT throws_ok($$SELECT public.set_staff_enabled('22222222-2222-4222-8222-222222222222', false, ' ')$$,
  '22023', NULL, 'blank audit reason rejected');
SELECT throws_ok($$SELECT public.set_staff_enabled('22222222-2222-4222-8222-222222222222', false, repeat('x',241))$$,
  '22023', NULL, 'oversized audit reason rejected');
SELECT throws_ok($$SELECT public.approve_staff('66666666-6666-4666-8666-666666666666', 'admin', 'Cannot approve unconfirmed')$$,
  '22023', NULL, 'unconfirmed approval rejected atomically');
SELECT is((SELECT role::text FROM public.profiles WHERE id = '66666666-6666-4666-8666-666666666666'), 'cashier', 'failed approval rolls back role change');
SELECT throws_ok($$SELECT public.approve_staff('77777777-7777-4777-8777-777777777777', 'admin', 'Anonymous approval')$$,
  '22023', NULL, 'anonymous account cannot be approved');
SELECT throws_ok($$SELECT public.approve_staff('88888888-8888-4888-8888-888888888888', 'cashier', 'Banned approval')$$,
  '22023', NULL, 'banned account cannot be approved');
SELECT is(public.approve_staff('55555555-5555-4555-8555-555555555555', 'cashier', 'Reviewed dashboard account')->>'is_enabled', 'true', 'owner can approve confirmed dashboard account');
SELECT is(public.set_staff_enabled('22222222-2222-4222-8222-222222222222', false, 'Shift access removed')->>'is_enabled', 'false', 'owner can disable cashier');
SELECT lives_ok($$SELECT public.set_staff_enabled('22222222-2222-4222-8222-222222222222', false, 'Repeated request')$$, 'same-state request is a no-op');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT is(public.get_user_role()::text, NULL, 'existing JWT immediately loses server role after disabling');
SELECT is((SELECT count(*)::int FROM public.inventory), 0, 'disabled cashier cannot read inventory');
SELECT is((SELECT count(*)::int FROM public.orders), 0, 'disabled cashier cannot read orders');
SELECT is((SELECT count(*)::int FROM public.order_items), 0, 'disabled cashier cannot read order lines');
SELECT is((SELECT count(*)::int FROM public.order_item_modifiers), 0, 'disabled cashier cannot read order modifiers');
SELECT is((SELECT is_enabled FROM public.profiles WHERE id = auth.uid()), false, 'own profile exposes disabled state without private staff listing');
WITH changed AS (UPDATE public.profiles SET full_name = 'Disabled edit' WHERE id = auth.uid() RETURNING id)
SELECT is(count(*)::int, 0, 'disabled profile edits rejected by restrictive RLS') FROM changed;
SELECT throws_ok($$SELECT public.complete_order(1,'cash',200)$$, '42501', NULL, 'disabled staff cannot complete payment');
SELECT throws_ok($$SELECT public.cancel_order(1,'Disabled cancellation')$$, '42501', NULL, 'disabled staff cannot cancel');
RESET ROLE;

-- An inactive owner does not count toward last-owner protection.
UPDATE public.profiles SET role = 'admin' WHERE id = '22222222-2222-4222-8222-222222222222';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT throws_ok($$SELECT public.set_staff_role(auth.uid(),'cashier')$$, '42501', 'The last owner cannot be demoted', 'disabled owner cannot justify last active owner demotion');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT throws_ok($$SELECT * FROM public.owner_daily_sales('2000-01-01','2100-01-01')$$, '42501', NULL, 'disabled owner cannot read reports');
SELECT throws_ok($$SELECT public.set_staff_role(auth.uid(),'admin')$$, '42501', NULL, 'disabled owner cannot assign roles');
SELECT throws_ok($$INSERT INTO public.categories (name,slug) VALUES ('Forbidden disabled write','forbidden-disabled')$$,
  '42501', NULL, 'disabled owner cannot create menu categories');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id,name) VALUES ('menu-images','disabled-upload.jpg')$$,
  '42501', NULL, 'disabled owner cannot upload public menu images');
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT ok((SELECT count(*) FROM public.menu_items) > 0, 'anonymous published menu access is unchanged');
SELECT is(public.get_user_role()::text, NULL, 'anonymous reader has no staff role');
RESET ROLE;

-- Protect approval even if a later migration accidentally adds broad profile UPDATE.
GRANT UPDATE ON public.profiles TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT throws_ok($$UPDATE public.profiles SET is_enabled = true WHERE id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', 'Profile identity and role require a trusted server operation', 'invoker trigger protects approval after accidental grant');
RESET ROLE;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- Auth bans are also checked for already-issued JWTs, not just at login.
UPDATE auth.users SET banned_until = now() + interval '1 day' WHERE id = '11111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT is(public.get_user_role()::text, NULL, 'banned approved owner loses server role');
SELECT is((SELECT count(*)::int FROM public.inventory), 0, 'banned existing JWT cannot read stock');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM patanos_private.staff_access_audit) - (SELECT row_count FROM initial_access_audit), 2, 'only accepted approval and disable transitions are audited');
SELECT ok((SELECT bool_and(actor_id = '11111111-1111-4111-8111-111111111111' AND previous_enabled <> new_enabled)
  FROM patanos_private.staff_access_audit), 'access audit contains authoritative actor and transition');
SELECT * FROM finish();
ROLLBACK;
