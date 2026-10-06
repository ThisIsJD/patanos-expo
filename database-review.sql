-- Read-only metadata export. Run the entire statement in Supabase SQL Editor.
-- Export version 2: includes function bodies, effective grants, and bucket settings.
-- Does not read orders, customer records, auth.users rows, or stored objects.
-- Auth dashboard configuration is reviewed separately; it is not inferred here.
-- Review exported function bodies for embedded secrets before sharing or committing.
select jsonb_build_object(
  'export_version', 2,
  'exported_at', statement_timestamp(),
  'server_version', current_setting('server_version'),
  'export_role', current_user,
  'policies', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname in ('public', 'storage')
    order by schemaname, tablename, policyname
  ) x),
  'relations', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select n.nspname as schema_name, c.relname as name, c.relkind as kind,
      pg_get_userbyid(c.relowner) as owner,
      c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
      c.reloptions as options, c.relacl::text as grants
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage') and c.relkind in ('r', 'p', 'v', 'm')
    order by n.nspname, c.relname
  ) x),
  'columns', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select table_name, column_name, data_type, udt_name, is_nullable,
      column_default, is_identity, is_generated, generation_expression
    from information_schema.columns where table_schema = 'public'
    order by table_name, ordinal_position
  ) x),
  'column_permissions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select n.nspname as schema_name, c.relname as table_name,
      a.attname as column_name, a.attacl::text as explicit_grants,
      has_column_privilege('anon', c.oid, a.attnum, 'SELECT') as anon_can_select,
      has_column_privilege('anon', c.oid, a.attnum, 'INSERT') as anon_can_insert,
      has_column_privilege('anon', c.oid, a.attnum, 'UPDATE') as anon_can_update,
      has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT') as authenticated_can_select,
      has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT') as authenticated_can_insert,
      has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE') as authenticated_can_update
    from pg_attribute a join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum
  ) x),
  'relation_permissions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select n.nspname as schema_name, c.relname as name,
      has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
      has_table_privilege('anon', c.oid, 'INSERT') as anon_can_insert,
      has_table_privilege('anon', c.oid, 'UPDATE') as anon_can_update,
      has_table_privilege('anon', c.oid, 'DELETE') as anon_can_delete,
      has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select,
      has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_can_insert,
      has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_can_update,
      has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_can_delete
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage') and c.relkind in ('r', 'p', 'v', 'm')
    order by n.nspname, c.relname
  ) x),
  'schema_permissions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select n.nspname as schema_name, n.nspacl::text as grants,
      has_schema_privilege('anon', n.oid, 'USAGE') as anon_can_use,
      has_schema_privilege('anon', n.oid, 'CREATE') as anon_can_create,
      has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_can_use,
      has_schema_privilege('authenticated', n.oid, 'CREATE') as authenticated_can_create
    from pg_namespace n where n.nspname in ('public', 'storage', 'auth')
    order by n.nspname
  ) x),
  'default_privileges', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select pg_get_userbyid(d.defaclrole) as owner,
      coalesce(n.nspname, '(all schemas)') as schema_name,
      d.defaclobjtype as object_type, d.defaclacl::text as grants
    from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
    where d.defaclnamespace = 0 or n.nspname in ('public', 'storage', 'auth')
    order by owner, schema_name, object_type
  ) x),
  'constraints', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select c.relname as table_name, k.conname as name,
      pg_get_constraintdef(k.oid, true) as definition
    from pg_constraint k join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' order by c.relname, k.conname
  ) x),
  'indexes', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select tablename, indexname, indexdef from pg_indexes
    where schemaname = 'public' order by tablename, indexname
  ) x),
  'triggers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select n.nspname as schema_name, c.relname as table_name,
      t.tgname as name, t.tgenabled as enabled,
      pg_get_triggerdef(t.oid, true) as definition
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
    order by n.nspname, c.relname, t.tgname
  ) x),
  'function_permissions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select n.nspname as schema_name, p.proname as name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
      p.proconfig as settings, p.proacl::text as grants,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
    order by p.proname, p.oid
  ) x),
  'functions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select n.nspname as schema_name, p.proname as name,
      pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_userbyid(p.proowner) as owner, l.lanname as language,
      p.prosecdef as security_definer, p.proconfig as settings,
      p.proacl::text as grants,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
      pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where p.prokind = 'f' and (
      n.nspname = 'public' or exists (
        select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
        join pg_namespace tn on tn.oid = c.relnamespace
        where t.tgfoid = p.oid and not t.tgisinternal
          and (tn.nspname = 'public' or (tn.nspname = 'auth' and c.relname = 'users'))
      )
    )
    order by n.nspname, p.proname, p.oid
  ) x),
  'views', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select c.relname as name, pg_get_viewdef(c.oid, true) as definition
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm') order by c.relname
  ) x),
  'enum_values', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select t.typname as type_name, e.enumlabel as value
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' order by t.typname, e.enumsortorder
  ) x),
  'storage_buckets', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select id, name, public, file_size_limit, allowed_mime_types
    from storage.buckets order by id
  ) x),
  'auth_configuration', jsonb_build_object(
    'source', 'Supabase Auth dashboard; separate manual review required',
    'verified', false
  ),
  'database_timezone', current_setting('TimeZone')
) as database_review;
