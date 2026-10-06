-- Local reconstruction/ordinary transaction smoke checks, NOT P1/P2 acceptance.
-- All sale/payment/stock mutations below are synthetic and rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(25);

SELECT is((SELECT count(*)::int FROM pg_attribute attribute
  JOIN pg_class relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public' AND relation.relkind = 'r'
    AND attribute.attnum > 0 AND NOT attribute.attisdropped), 96, '94 reconstructed public columns plus P1 cancellation disposition and staff approval');
SELECT is((SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public'
  AND data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2
  AND table_name NOT IN ('daily_sales', 'category_sales')), 10, 'ten money columns use numeric(10,2)');
SELECT is((SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.columns
  WHERE table_schema = 'public' AND identity_generation = 'ALWAYS'),
  'gallery_photos,inventory,menu_items,modifier_groups,modifiers,order_item_modifiers,order_items,orders', 'all eight identities use ALWAYS');
SELECT is((SELECT is_generated FROM information_schema.columns WHERE table_schema = 'public'
  AND table_name = 'order_items' AND column_name = 'subtotal'), 'ALWAYS', 'item subtotal remains a generated column');
SELECT is((SELECT count(*)::int FROM pg_sequences WHERE schemaname = 'public'), 8, 'eight owned bigint sequences');
SELECT ok((SELECT bool_and(data_type = 'bigint'::regtype AND start_value = 1 AND min_value = 1
  AND increment_by = 1 AND cache_size = 1 AND NOT cycle) FROM pg_sequences WHERE schemaname = 'public'),
  'sequence settings match safely represented metadata; rounded JSON max excluded');
SELECT is((SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname = 'public'),
  'gallery_photos,inventory,menu_items,modifier_groups,modifiers,order_items,orders', 'seven exact public Realtime members');
SELECT ok((SELECT pubinsert AND pubupdate AND pubdelete AND pubtruncate AND NOT puballtables
  FROM pg_publication WHERE pubname = 'supabase_realtime'), 'captured publication operation flags');
SELECT is((SELECT count(*)::int FROM pg_class WHERE oid IN ('public.daily_sales'::regclass,
  'public.category_sales'::regclass) AND relowner = 'postgres'::regrole), 2, 'original report owner retained, not security hardening');
SELECT ok(NOT has_table_privilege('anon', 'public.daily_sales', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.category_sales', 'SELECT'), 'P1 removes anonymous reporting grants in the latest migration chain');
SELECT ok(NOT has_schema_privilege('anon', 'public', 'CREATE')
  AND NOT has_schema_privilege('authenticated', 'public', 'CREATE'), 'client schema creation remains unavailable');
SELECT is((SELECT count(*)::int FROM pg_default_acl defaults
  JOIN pg_namespace namespace ON namespace.oid = defaults.defaclnamespace
  CROSS JOIN LATERAL aclexplode(defaults.defaclacl) permissions
  WHERE namespace.nspname = 'public' AND defaults.defaclrole = 'postgres'::regrole),
  48, 'captured application-owner public default grants; managed-role defaults not changed');
SELECT is((SELECT count(*)::int FROM pg_attribute attribute
  JOIN pg_class relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public' AND attribute.attnum > 0 AND NOT attribute.attisdropped
    AND attribute.attacl IS NOT NULL), 2, 'P1 allows only the two safe profile update columns');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
CREATE TEMP TABLE smoke_sale AS
SELECT public.place_order('takeout', 290, 290, 'Synthetic local regression',
  '[{"menu_item_id":101,"item_name":"Test Iced Latte","size_label":"Regular","quantity":2,"unit_price":145,"modifiers":[{"id":202,"modifier_name":"Oat milk","extra_price":25}]}]'::jsonb) AS result;
SELECT is((SELECT unit_price FROM public.order_items WHERE order_id = (SELECT (result->>'id')::bigint FROM smoke_sale)),
  145::numeric, 'modifier-inclusive unit price is not charged twice');
SELECT is((SELECT subtotal FROM public.order_items WHERE order_id = (SELECT (result->>'id')::bigint FROM smoke_sale)),
  290::numeric, 'generated line subtotal survives precision correction');
SELECT is((SELECT count(*)::int FROM public.order_item_modifiers), 1, 'RPC inserts the modifier child with generated IDs');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 101), 18, 'ordinary placement consumes two portions once');
SELECT throws_ok($existing_sales$DO $local_only$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders)
     OR EXISTS (SELECT 1 FROM public.order_items)
     OR EXISTS (SELECT 1 FROM public.order_item_modifiers) THEN
    RAISE EXCEPTION 'P0.2 local reconciliation requires an empty sales database; no history upgrade is authorized';
  END IF;
END;
$local_only$;$existing_sales$, 'P0001',
  'P0.2 local reconciliation requires an empty sales database; no history upgrade is authorized',
  'actual migration guard rejects existing sales before schema recreation');
SELECT public.complete_order((SELECT (result->>'id')::bigint FROM smoke_sale), 'cash', 300, NULL);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT is((SELECT sum(total_revenue) FROM public.owner_daily_sales('2000-01-01', '2100-01-01')), 290::numeric, 'owner RPC reads completed synthetic cash sale');
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT throws_ok($invalid_child$
  SELECT public.place_order('takeout', 120, 120, NULL,
    '[{"menu_item_id":101,"item_name":"Test Iced Latte","quantity":1,"unit_price":120,"modifiers":[{"id":999999,"modifier_name":"Missing synthetic modifier","extra_price":0}]}]'::jsonb)
  $invalid_child$, '22023', NULL, 'invalid modifier rejects the whole RPC');
SELECT is((SELECT count(*)::int FROM public.orders), 1, 'failed child insertion leaves no partial order');
SELECT is((SELECT stock_count FROM public.inventory WHERE menu_item_id = 101), 18, 'failed RPC rolls back its stock decrement');
-- P1 forbids cancelling a paid sale; refunds require a separate future owner workflow.
SELECT throws_ok($$SELECT public.cancel_order((SELECT (result->>'id')::bigint FROM smoke_sale), 'Synthetic rollback check')$$,
  '55000', 'Only an open unpaid order can be cancelled', 'paid cancellation is rejected rather than silently refunding stock');
RESET ROLE;
SELECT is((SELECT confdeltype::text FROM pg_constraint WHERE conname = 'order_items_order_id_fkey'),
  'c', 'order children retain captured CASCADE behavior');
SELECT is((SELECT confdeltype::text FROM pg_constraint WHERE conname = 'order_items_menu_item_id_fkey'),
  'r', 'catalog references retain captured RESTRICT behavior');
SELECT * FROM finish();
ROLLBACK;
