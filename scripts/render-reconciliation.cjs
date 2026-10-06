const fs = require('node:fs')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')

const SUPPLEMENT = 'ProjectContext/database/snapshots/P0.2-schema-supplement.json'
const SUPPLEMENT_HASH = '2176652529ebb7e7f6d9718421e67998656f109b61258cee3f4a529b7e8f8f9a'
const BASELINE = 'ProjectContext/database/snapshots/P0.02-database-review.json'
const BASELINE_HASH = '845638c64e5a5f0c4bc3d81343a44d9eec591f2ad4f8aa279ec540b117a6ead2'
const quote = identifier => '"' + identifier.replaceAll('"', '""') + '"'
const literal = value => "'" + value.replaceAll("'", "''") + "'"

function readReviewedFile(file, expectedHash) {
  const raw = fs.readFileSync(file)
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), expectedHash, file + ' changed; review before regenerating')
  return JSON.parse(raw.toString())
}

function readReconciliationSources() {
  const supplement = readReviewedFile(SUPPLEMENT, SUPPLEMENT_HASH)[0].schema_supplement
  const baseline = readReviewedFile(BASELINE, BASELINE_HASH)[0].database_review
  const tableNames = baseline.relations.filter(relation => relation.schema_name === 'public' && relation.kind === 'r').map(relation => relation.name)
  assert.equal(supplement.columns.length, 94)
  assert.equal(supplement.columns.filter(column => column.identity_generation === 'ALWAYS').length, 8)
  for (const column of supplement.columns) {
    assert(tableNames.includes(column.table_name))
    const previous = baseline.columns.find(entry => entry.table_name === column.table_name && entry.column_name === column.column_name)
    assert(previous, 'Unknown column ' + column.table_name + '.' + column.column_name)
    assert.equal(column.not_null, previous.is_nullable === 'NO')
    assert.equal(column.generated_mode, previous.is_generated === 'ALWAYS' ? 's' : '')
    assert.equal(column.default_or_generation_expression, previous.generation_expression || previous.column_default || null)
  }
  assert.equal(supplement.column_grants.length, 0)
  assert.equal(supplement.realtime_tables.length, 7)
  return { supplement, baseline }
}

function renderReconciliation() {
  const { supplement, baseline } = readReconciliationSources()
  const statements = [
    '-- LOCAL/CI reconstruction correction only; NOT approved for remote deployment.',
    '-- Supplement: owner-confirmed development export 2026-10-05; SHA-256 ' + SUPPLEMENT_HASH,
    '-- Original baseline stays unchanged. Known authorization/transaction defects remain.',
    '-- Requires no sales; recreates the generated subtotal and dependent report views.',
    '-- Sequence max_value was rounded in the JSON export; do not use it as a SQL bound.',
    'BEGIN;',
    'SET LOCAL search_path = public, extensions;',
    `DO $local_only$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders)
     OR EXISTS (SELECT 1 FROM public.order_items)
     OR EXISTS (SELECT 1 FROM public.order_item_modifiers) THEN
    RAISE EXCEPTION 'P0.2 local reconciliation requires an empty sales database; no history upgrade is authorized';
  END IF;
END;
$local_only$;`,
  ]
  // PostgreSQL cannot change a referenced price type while its generated column
  // and report views depend on it. The empty-sales guard makes recreation safe.
  for (const view of baseline.views) statements.push(`DROP VIEW public.${quote(view.name)};`)
  statements.push('ALTER TABLE public."order_items" DROP COLUMN "subtotal";')
  const moneyColumns = supplement.columns.filter(column => column.formatted_type.startsWith('numeric'))
  assert.equal(moneyColumns.length, 10)
  for (const column of moneyColumns.filter(entry => entry.generated_mode !== 's')) {
    assert.equal(column.formatted_type, 'numeric(10,2)')
    statements.push(`ALTER TABLE public.${quote(column.table_name)} ALTER COLUMN ${quote(column.column_name)} TYPE numeric(10,2);`)
  }
  const subtotal = supplement.columns.find(column => column.table_name === 'order_items' && column.column_name === 'subtotal')
  assert.equal(subtotal.generated_mode, 's')
  statements.push(`ALTER TABLE public."order_items" ADD COLUMN "subtotal" numeric(10,2) GENERATED ALWAYS AS (${subtotal.default_or_generation_expression}) STORED;`)
  for (const column of supplement.columns.filter(entry => entry.identity_generation)) {
    assert.equal(column.identity_generation, 'ALWAYS')
    statements.push(`ALTER TABLE public.${quote(column.table_name)} ALTER COLUMN ${quote(column.column_name)} SET GENERATED ALWAYS;`)
  }
  for (const view of baseline.views) statements.push(`CREATE VIEW public.${quote(view.name)} AS\n${view.definition}`)
  // Reapply the captured grants after view recreation. This intentionally
  // reproduces the weak baseline; it is not the separate P1 hardening work.
  const grants = Map.groupBy(supplement.relation_grants, entry => entry.relation_name + ':' + entry.grantee)
  for (const entries of grants.values()) {
    assert(entries.every(entry => entry.schema_name === 'public' && entry.owner === 'postgres' && !entry.is_grantable))
    assert(['anon', 'authenticated', 'postgres', 'service_role'].includes(entries[0].grantee))
    const privileges = entries.map(entry => entry.privilege_type).sort().join(', ')
    statements.push(`GRANT ${privileges} ON TABLE public.${quote(entries[0].relation_name)} TO ${quote(entries[0].grantee)};`)
  }
  // Supabase protects supabase_admin defaults. Never elevate or change that
  // managed role to reproduce a snapshot; reconcile only our postgres defaults.
  statements.push('-- Captured supabase_admin default privileges remain managed by Supabase, not altered here.')
  const defaultGrants = Map.groupBy(supplement.default_grants.filter(entry => entry.owner === 'postgres'), entry => entry.object_type + ':' + entry.grantee)
  const objectTypes = { S: 'SEQUENCES', f: 'FUNCTIONS', r: 'TABLES' }
  for (const entries of defaultGrants.values()) {
    const first = entries[0]
    assert.equal(first.owner, 'postgres')
    assert(['anon', 'authenticated', 'postgres', 'service_role'].includes(first.grantee))
    assert(entries.every(entry => entry.schema_name === 'public' && !entry.is_grantable))
    assert(objectTypes[first.object_type])
    const privileges = entries.map(entry => entry.privilege_type).sort().join(', ')
    statements.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${quote(first.owner)} IN SCHEMA public GRANT ${privileges} ON ${objectTypes[first.object_type]} TO ${quote(first.grantee)};`)
  }
  statements.push(`DO $publication$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$publication$;`)
  statements.push(`ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete, truncate');`)
  for (const table of supplement.realtime_tables) {
    assert.equal(table.pubname, 'supabase_realtime')
    assert.equal(table.schemaname, 'public')
    statements.push(`DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = ${literal(table.tablename)}) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.${quote(table.tablename)};
  END IF;
END;
$membership$;`)
  }
  statements.push('COMMIT;')
  return (statements.join('\n\n') + '\n').replaceAll('\r\n', '\n')
}

module.exports = { renderReconciliation, readReconciliationSources, SUPPLEMENT_HASH }
if (require.main === module) process.stdout.write(renderReconciliation())
