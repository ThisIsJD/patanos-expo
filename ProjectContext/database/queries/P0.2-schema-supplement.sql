-- P0.2 read-only metadata supplement for the EXISTING DEVELOPMENT project.
-- Run in its Supabase SQL Editor; no staging mutations or customer/account rows.
-- Also refresh database-review.sql into a NEW dated evidence file, not the old one.
-- Export to a NEW dated evidence file. Do not overwrite the reviewed
-- ProjectContext/P0.2-schema-supplement.json used by the reconciliation renderer.
WITH column_details AS (
  SELECT namespace.nspname AS schema_name, relation.relname AS table_name,
         attribute.attname AS column_name, attribute.attnum AS ordinal_position,
         pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS formatted_type,
         attribute.attnotnull AS not_null,
         CASE attribute.attidentity WHEN 'a' THEN 'ALWAYS'
              WHEN 'd' THEN 'BY DEFAULT' ELSE NULL END AS identity_generation,
         attribute.attgenerated AS generated_mode,
         pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid) AS default_or_generation_expression,
         pg_catalog.pg_get_serial_sequence(
           format('%I.%I', namespace.nspname, relation.relname), attribute.attname
         ) AS owned_sequence
  FROM pg_catalog.pg_attribute attribute
  JOIN pg_catalog.pg_class relation ON relation.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef default_value
    ON default_value.adrelid = relation.oid AND default_value.adnum = attribute.attnum
  WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p')
    AND attribute.attnum > 0 AND NOT attribute.attisdropped
), relation_grants AS (
  SELECT namespace.nspname AS schema_name, relation.relname AS relation_name,
         pg_catalog.pg_get_userbyid(relation.relowner) AS owner,
         CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(permission.grantee) END AS grantee,
         permission.privilege_type, permission.is_grantable
  FROM pg_catalog.pg_class relation
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
  ) permission
  WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p', 'v', 'm')
), column_grants AS (
  SELECT relation.relname AS table_name, attribute.attname AS column_name,
         CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(permission.grantee) END AS grantee,
         permission.privilege_type, permission.is_grantable
  FROM pg_catalog.pg_attribute attribute
  JOIN pg_catalog.pg_class relation ON relation.oid = attribute.attrelid
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(attribute.attacl) permission
  WHERE namespace.nspname = 'public' AND attribute.attnum > 0 AND NOT attribute.attisdropped
), default_grants AS (
  SELECT pg_catalog.pg_get_userbyid(default_acl.defaclrole) AS owner,
         namespace.nspname AS schema_name, default_acl.defaclobjtype AS object_type,
         CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(permission.grantee) END AS grantee,
         permission.privilege_type, permission.is_grantable
  FROM pg_catalog.pg_default_acl default_acl
  LEFT JOIN pg_catalog.pg_namespace namespace ON namespace.oid = default_acl.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(default_acl.defaclacl) permission
  WHERE namespace.nspname = 'public' OR default_acl.defaclnamespace = 0
), schema_grants AS (
  SELECT namespace.nspname AS schema_name,
         CASE WHEN permission.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(permission.grantee) END AS grantee,
         permission.privilege_type, permission.is_grantable
  FROM pg_catalog.pg_namespace namespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
  ) permission
  WHERE namespace.nspname = 'public'
), sequences AS (
  SELECT schemaname, sequencename, sequenceowner, data_type::text,
         start_value::text, min_value::text, max_value::text, increment_by::text, cycle, cache_size::text
  FROM pg_catalog.pg_sequences WHERE schemaname = 'public'
)
SELECT jsonb_build_object(
  'captured_at', now(),
  'database_version', version(),
  'columns', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY table_name, ordinal_position) FROM column_details entry), '[]'::jsonb),
  'relation_grants', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY relation_name, grantee, privilege_type) FROM relation_grants entry), '[]'::jsonb),
  'column_grants', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY table_name, column_name, grantee, privilege_type) FROM column_grants entry), '[]'::jsonb),
  'default_grants', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY owner, schema_name, object_type, grantee, privilege_type) FROM default_grants entry), '[]'::jsonb),
  'schema_grants', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY schema_name, grantee, privilege_type) FROM schema_grants entry), '[]'::jsonb),
  'sequences', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY sequencename) FROM sequences entry), '[]'::jsonb),
  'publications', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY pubname) FROM (
    SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
    FROM pg_catalog.pg_publication
  ) entry), '[]'::jsonb),
  'realtime_tables', COALESCE((SELECT jsonb_agg(to_jsonb(entry) ORDER BY schemaname, tablename) FROM (
    SELECT pubname, schemaname, tablename FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  ) entry), '[]'::jsonb)
) AS schema_supplement;
