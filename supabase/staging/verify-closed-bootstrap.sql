-- Read-only verification. Target only omxoyujlteqcolqcdzxp or disposable local replay.
BEGIN READ ONLY;
DO $verify$
BEGIN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r') <> 10
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'v') <> 2
     OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name NOT IN ('daily_sales', 'category_sales')) <> 94
     OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND identity_generation = 'ALWAYS') <> 8
     OR (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2) <> 10
     OR (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public') <> 7
     OR (SELECT count(*) FROM public.categories) <> 2
     OR (SELECT count(*) FROM public.menu_items) <> 4
     OR (SELECT count(*) FROM public.modifier_groups) <> 1
     OR (SELECT count(*) FROM public.modifiers) <> 3
     OR (SELECT count(*) FROM public.inventory) <> 4
     OR (SELECT stock_count FROM public.inventory WHERE menu_item_id = 101) IS DISTINCT FROM 20
     OR (SELECT stock_count FROM public.inventory WHERE menu_item_id = 104) IS DISTINCT FROM 0
     OR (SELECT count(*) FROM public.orders) <> 0
     OR (SELECT count(*) FROM public.order_items) <> 0
     OR (SELECT count(*) FROM public.order_item_modifiers) <> 0
     OR (SELECT count(*) FROM auth.users) <> 0
     OR (SELECT count(*) FROM public.profiles) <> 0
     OR (SELECT count(*) FROM storage.buckets WHERE id IN ('menu-images', 'gallery-images') AND NOT public) <> 2
     OR (SELECT count(*) FROM storage.objects) <> 0 THEN
    RAISE EXCEPTION 'Closed staging bootstrap schema/fixture verification failed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN (VALUES ('anon'), ('authenticated')) api(role_name)
             WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
               AND has_table_privilege(api.role_name, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
     OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN (VALUES ('anon'), ('authenticated')) api(role_name)
                WHERE n.nspname = 'public' AND c.relkind = 'S' AND has_sequence_privilege(api.role_name, c.oid, 'USAGE,SELECT,UPDATE'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace CROSS JOIN (VALUES ('anon'), ('authenticated')) api(role_name)
                WHERE n.nspname = 'public' AND has_function_privilege(api.role_name, p.oid, 'EXECUTE'))
     OR (SELECT count(*) FROM patanos_staging.bootstrap WHERE revision = 'p0-closed-bootstrap-20261005-v1' AND intended_project_ref = 'omxoyujlteqcolqcdzxp' AND NOT client_access_enabled) <> 1 THEN
    RAISE EXCEPTION 'Staging API containment/provenance verification failed';
  END IF;
END;
$verify$;
SELECT jsonb_build_object('revision', revision, 'intended_project_ref', intended_project_ref,
                         'client_access_enabled', client_access_enabled, 'schema_fixture_checks', 'passed',
                         'api_grant_checks', 'passed', 'auth_users', (SELECT count(*) FROM auth.users),
                         'menu_variants', (SELECT count(*) FROM public.menu_items),
                         'orders', (SELECT count(*) FROM public.orders)) AS verification
FROM patanos_staging.bootstrap;
COMMIT;
