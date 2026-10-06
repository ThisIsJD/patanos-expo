-- Transactional SQL-role smoke tests, NOT actual login/JWT/PostgREST/device acceptance.
-- All temporary grants, synthetic probe account/orders and mutations are rolled back.
BEGIN;
SET LOCAL search_path = public, extensions;
DO $preflight$
BEGIN
  IF (SELECT count(*) FROM patanos_staging.staff_access) <> 2
     OR (SELECT count(*) FROM public.profiles p JOIN patanos_staging.staff_access a ON a.user_id = p.id AND a.fixture_role = p.role) <> 2
     OR (SELECT count(*) FROM patanos_staging.bootstrap WHERE client_access_enabled) <> 1 THEN
    RAISE EXCEPTION 'Controlled staff fixture/precondition failed';
  END IF;
END;
$preflight$;

SET LOCAL ROLE anon;
DO $anonymous_denied$
BEGIN
  BEGIN
    PERFORM * FROM public.daily_sales;
    RAISE EXCEPTION 'Anonymous report query unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.place_order('dine-in', 120, 120, NULL, '[]'::jsonb);
    RAISE EXCEPTION 'Anonymous RPC unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$anonymous_denied$;
RESET ROLE;

-- Unapproved account has a real profile so denial is not merely a missing-FK failure.
INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'unapproved-probe@patanos.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $unapproved_denied$
BEGIN
  IF public.p0_staging_staff_allowed() OR EXISTS (SELECT 1 FROM public.menu_items)
     OR EXISTS (SELECT 1 FROM public.profiles) OR EXISTS (SELECT 1 FROM public.daily_sales) THEN
    RAISE EXCEPTION 'Unapproved staff escaped staging allowlist';
  END IF;
  BEGIN
    PERFORM public.place_order('dine-in', 120, 120, NULL, '[{"menu_item_id":101,"item_name":"Test Iced Latte","size_label":"Regular","quantity":1,"unit_price":120}]'::jsonb);
    RAISE EXCEPTION 'Unapproved staff RPC unexpectedly allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Staging staff access not approved' THEN RAISE; END IF;
  END;
END;
$unapproved_denied$;

SELECT set_config('request.jwt.claim.sub', '62b5c877-4051-4e2a-8659-163dec9a71bc', true);
DO $cashier_smoke$
DECLARE
  sale jsonb;
  affected_rows integer;
BEGIN
  IF NOT public.p0_staging_staff_allowed() OR public.get_user_role() <> 'cashier'
     OR (SELECT count(*) FROM public.menu_items) <> 4 THEN
    RAISE EXCEPTION 'Cashier role/catalog resolution failed';
  END IF;
  UPDATE public.inventory SET stock_count = stock_count + 1 WHERE menu_item_id = 101;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN RAISE EXCEPTION 'Cashier direct stock update unexpectedly allowed'; END IF;
  sale := public.place_order('takeout', 145, 145, 'Synthetic staging smoke',
    '[{"menu_item_id":101,"item_name":"Test Iced Latte","size_label":"Regular","quantity":1,"unit_price":145,"notes":"Less ice","modifiers":[{"id":202,"modifier_name":"Oat milk","extra_price":25}]}]'::jsonb);
  IF (SELECT stock_count FROM public.inventory WHERE menu_item_id = 101) <> 19
     OR (SELECT subtotal FROM public.orders WHERE id = (sale->>'id')::bigint) <> 145
     OR (SELECT subtotal FROM public.order_items WHERE order_id = (sale->>'id')::bigint) <> 145 THEN
    RAISE EXCEPTION 'Cashier synthetic order/stock/modifier total failed';
  END IF;
  UPDATE public.orders SET status = 'completed', payment_method = 'cash', amount_tendered = 200, change_amount = 55 WHERE id = (sale->>'id')::bigint;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN RAISE EXCEPTION 'Cashier basic payment update failed'; END IF;
END;
$cashier_smoke$;

SELECT set_config('request.jwt.claim.sub', '0fb1197e-dc56-4529-bbb4-44b58cc55f70', true);
DO $owner_smoke$
BEGIN
  IF NOT public.p0_staging_staff_allowed() OR public.get_user_role() <> 'admin'
     OR (SELECT count(*) FROM public.profiles WHERE id IN ('0fb1197e-dc56-4529-bbb4-44b58cc55f70', '62b5c877-4051-4e2a-8659-163dec9a71bc')) <> 2
     OR (SELECT coalesce(sum(total_revenue), 0) FROM public.daily_sales) <> 145 THEN
    RAISE EXCEPTION 'Owner role/report smoke failed';
  END IF;
END;
$owner_smoke$;
RESET ROLE;
SELECT 'passed: anonymous denied; unapproved account blocked; cashier role/catalog/order/payment/stock smoke; owner role/report. SQL claims simulated, not HTTP login.' AS controlled_access_verification;
ROLLBACK;
