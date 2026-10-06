-- Synthetic order/payment/stock security tests; every mutation rolls back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();
CREATE TEMP TABLE initial_order_audit AS SELECT count(*)::integer AS count FROM patanos_private.order_mutation_audit;

SELECT ok(NOT has_table_privilege('authenticated', relation, 'INSERT,UPDATE,DELETE,TRUNCATE')
  AND NOT has_table_privilege('anon', relation, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'), 'no client business write grant: ' || relation)
  FROM unnest(ARRAY['public.orders', 'public.order_items', 'public.order_item_modifiers']) relation;
SELECT ok((SELECT bool_and(prosecdef AND proowner = 'postgres'::regrole AND proconfig = ARRAY['search_path=""']::text[])
  FROM pg_proc WHERE oid IN ('public.place_order(text,numeric,numeric,text,jsonb)'::regprocedure,
    'public.complete_order(bigint,text,numeric,text)'::regprocedure, 'public.cancel_order(bigint,text,boolean)'::regprocedure)),
  'only owner-controlled checked order RPCs use definer execution with empty search paths');
SELECT ok(NOT has_schema_privilege('authenticated', 'patanos_private', 'USAGE')
  AND NOT has_table_privilege('authenticated', 'patanos_private.order_mutation_audit', 'SELECT,INSERT,UPDATE,DELETE'), 'order audit stays private');
SELECT ok(NOT has_function_privilege('anon', signature, 'EXECUTE'), 'anonymous execution blocked: ' || signature)
  FROM unnest(ARRAY['public.place_order(text,numeric,numeric,text,jsonb)', 'public.complete_order(bigint,text,numeric,text)',
    'public.cancel_order(bigint,text,boolean)', 'public.restore_stock_on_cancel()', 'public.decrement_stock()', 'public.handle_new_user()']) signature;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
CREATE TEMP TABLE payload AS SELECT
  '[{"menu_item_id":101,"item_name":"Forged name","quantity":1,"unit_price":145,"modifiers":[{"id":202,"modifier_name":"Forged milk","extra_price":25}]}]'::jsonb AS items;
SELECT throws_ok($$UPDATE public.orders SET total_amount = 0$$, '42501', NULL, 'cashier direct total/status/actor edits rejected');
SELECT throws_ok($$INSERT INTO public.order_items (order_id, menu_item_id, item_name, quantity, unit_price) VALUES (1,101,'Bypass',1,0)$$,
  '42501', NULL, 'direct child insert rejected');
SELECT throws_ok($$DELETE FROM public.order_item_modifiers$$, '42501', NULL, 'direct modifier delete rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 0, 0, NULL, (SELECT items FROM payload))$$,
  '22023', 'Order totals do not match the menu', 'forged totals rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,unit_price}', '1'))$$,
  '22023', 'Item price changed; refresh the menu', 'forged catalog price rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,modifiers,0,extra_price}', '0'))$$,
  '22023', 'Modifier price changed; refresh the menu', 'forged modifier price rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,status}', '"completed"'))$$,
  '22023', 'Invalid order item fields', 'nested status injection rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,stock_count}', '999'))$$,
  '22023', 'Invalid order item fields', 'nested stock injection rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,created_by}', '"11111111-1111-4111-8111-111111111111"'))$$,
  '22023', 'Invalid order item fields', 'actor injection rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 'NaN', 145, NULL, (SELECT items FROM payload))$$,
  '22023', 'Invalid order type or amounts', 'non-finite totals rejected');
SELECT throws_ok($$SELECT public.place_order(NULL, 145, 145, NULL, (SELECT items FROM payload))$$,
  '22023', NULL, 'null order type rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, '{}'::jsonb)$$,
  '22023', 'Order items must be an array', 'malformed array rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,quantity}', '1.5'))$$,
  '22023', 'Invalid order item fields', 'fractional portion rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 120, 120, NULL, jsonb_set((SELECT items FROM payload), '{0,modifiers}', '[]'))$$,
  '22023', 'Modifier selection limits not satisfied', 'missing required choice rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,modifiers}', '[{"id":201,"extra_price":0},{"id":202,"extra_price":25}]'))$$,
  '22023', 'Modifier selection limits not satisfied', 'maximum selection count enforced');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,menu_item_id}', 'null'))$$,
  '22023', NULL, 'missing catalog identity rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,quantity}', '101'))$$,
  '22023', NULL, 'oversized portion quantity rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 145, 145, NULL, jsonb_set((SELECT items FROM payload), '{0,unit_price}', '"NaN"'))$$,
  '22023', NULL, 'non-numeric unit price rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 175, 175, NULL, jsonb_set((SELECT items FROM payload), '{0,modifiers}', '[{"id":202,"extra_price":25},{"id":203,"extra_price":30}]'))$$,
  '22023', NULL, 'unavailable modifier rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 170, 170, NULL, jsonb_set((SELECT items FROM payload), '{0,modifiers}', '[{"id":202,"extra_price":25},{"id":202,"extra_price":25}]'))$$,
  '22023', NULL, 'duplicate modifier rejected');
SELECT throws_ok($$SELECT public.place_order('takeout', 205, 205, NULL, '[{"menu_item_id":103,"quantity":1,"unit_price":205,"modifiers":[{"id":202,"extra_price":25}]}]')$$,
  '22023', NULL, 'modifier cannot cross category boundaries');
SELECT throws_ok($$SELECT public.place_order('takeout', 160, 160, NULL, '[{"menu_item_id":104,"quantity":1,"unit_price":160}]')$$,
  '22023', 'Menu item is unavailable', 'sold-out catalog item rejected');
CREATE TEMP TABLE test_sale AS SELECT public.place_order('takeout', 144, 146, 'Synthetic tolerance check', (SELECT items FROM payload)) AS result;
SELECT is((SELECT (result->>'total_amount')::numeric FROM test_sale), 145::numeric, 'one-peso tolerance stores authoritative total, not submitted amount');
SELECT is((SELECT result->>'created_by' FROM test_sale), '22222222-2222-4222-8222-222222222222', 'server records signed actor');
SELECT is((SELECT item_name FROM public.order_items WHERE order_id = (SELECT (result->>'id')::bigint FROM test_sale)),
  'Test Iced Latte', 'server snapshots catalog item name');
SELECT is((SELECT modifier_name FROM public.order_item_modifiers), 'Oat milk', 'server snapshots catalog modifier name');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 101), 19, 'stock consumed exactly once');
SELECT throws_ok($$SELECT public.complete_order((SELECT (result->>'id')::bigint FROM test_sale), 'cash', 100)$$,
  '22023', NULL, 'insufficient tender rejected');
SELECT throws_ok($$SELECT public.complete_order((SELECT (result->>'id')::bigint FROM test_sale), 'cash', 'NaN')$$,
  '22023', NULL, 'non-finite tender rejected');
SELECT throws_ok($$SELECT public.complete_order((SELECT (result->>'id')::bigint FROM test_sale), 'cash', 200.001)$$,
  '22023', NULL, 'fractional centavo tender rejected');
SELECT is(public.complete_order((SELECT (result->>'id')::bigint FROM test_sale), 'cash', 200)->>'change_amount', '55.00', 'server derives cash change');
SELECT throws_ok($$SELECT public.complete_order((SELECT (result->>'id')::bigint FROM test_sale), 'cash', 200)$$,
  '55000', 'Order is not open', 'repeated payment cannot overwrite settlement');
SELECT throws_ok($$SELECT public.cancel_order((SELECT (result->>'id')::bigint FROM test_sale), 'Paid cancellation')$$,
  '55000', NULL, 'cashier cannot cancel a paid sale');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 101), 19, 'paid cancellation rejection cannot restore consumed stock');
CREATE TEMP TABLE cancel_sale AS SELECT public.place_order('dine-in', 265, 265, NULL,
  '[{"menu_item_id":101,"quantity":1,"unit_price":120,"modifiers":[{"id":201,"extra_price":0}]},{"menu_item_id":101,"quantity":1,"unit_price":145,"modifiers":[{"id":202,"extra_price":25}]}]') AS result;
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 101), 17, 'separate modifier lines consume same variant portions');
SELECT throws_ok($$SELECT public.cancel_order((SELECT (result->>'id')::bigint FROM cancel_sale), ' ')$$,
  '22023', NULL, 'cancellation requires reason');
SELECT is(public.cancel_order((SELECT (result->>'id')::bigint FROM cancel_sale), 'Not prepared', true)->>'status', 'cancelled', 'cashier can release an explicitly unprepared order through trusted RPC');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 101), 19, 'cashier cancellation aggregates both lines and restores all portions');
SELECT throws_ok($$SELECT public.cancel_order((SELECT (result->>'id')::bigint FROM cancel_sale), 'Repeat')$$,
  '55000', NULL, 'repeated cancellation rejected');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 101), 19, 'retry does not restore stock twice');
WITH changed AS (UPDATE public.inventory SET stock_count = 999 WHERE menu_item_id = 101 RETURNING id)
SELECT is(count(*)::integer, 0, 'cashier still cannot edit inventory directly') FROM changed;
CREATE TEMP TABLE gcash_sale AS SELECT public.place_order('delivery', 180, 180, NULL,
  '[{"menu_item_id":103,"quantity":1,"unit_price":180}]') AS result;
SELECT is(public.complete_order((SELECT (result->>'id')::bigint FROM gcash_sale), 'gcash', NULL, NULL)->>'payment_method',
  'gcash', 'manual GCash remains supported with optional reference');
SELECT throws_ok($$SELECT public.place_order('takeout', 3600, 3600, NULL,
  '[{"menu_item_id":103,"quantity":20,"unit_price":180}]')$$, '23514', NULL, 'insufficient stock rejects atomic order instead of clamping stock');
SELECT is((SELECT count(*)::integer FROM public.orders), 3, 'failed placement leaves no partial order');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 103), 11, 'failed placement rolls back stock effect');
CREATE TEMP TABLE prepared_sale AS SELECT public.place_order('takeout', 180, 180, NULL,
  '[{"menu_item_id":103,"quantity":1,"unit_price":180}]') AS result;
SELECT is(public.cancel_order((SELECT (result->>'id')::bigint FROM prepared_sale), 'Preparation unknown')->>'status',
  'cancelled', 'default unknown disposition allows cancellation without stock return');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 103), 10, 'prepared or unknown portions stay consumed');
SELECT throws_ok($$SELECT public.complete_order(9999999, 'cash', 200)$$, '22023', 'Order not found', 'missing row cannot report payment success');
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT throws_ok($$SELECT public.complete_order(1, 'cash', 200)$$, '42501', NULL, 'missing signed identity rejected inside definer');
SELECT set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
SELECT throws_ok($$SELECT public.cancel_order(1, 'No profile')$$, '42501', NULL, 'identity without staff profile rejected');
RESET ROLE;

GRANT UPDATE ON public.orders TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT throws_ok($$UPDATE public.orders SET total_amount = 0$$, '42501', 'Orders require a trusted server operation',
  'invoker guard blocks accidental future raw write grant');
RESET ROLE;
REVOKE UPDATE ON public.orders FROM authenticated;
SELECT is((SELECT count(*)::integer FROM patanos_private.order_mutation_audit) - (SELECT count FROM initial_order_audit),
  8, 'only successful place/payment/cancel operations are audited');
SELECT is((SELECT count(*)::integer FROM patanos_private.order_mutation_audit WHERE operation = 'cancel' AND release_stock),
  1, 'audit records only the explicit unprepared stock release');
SELECT ok((SELECT bool_and(actor_id = '22222222-2222-4222-8222-222222222222') FROM patanos_private.order_mutation_audit), 'audit actor comes from signed identity');
SELECT * FROM finish();
ROLLBACK;
