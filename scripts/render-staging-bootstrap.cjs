const fs = require('node:fs')
const assert = require('node:assert/strict')
const { renderBaseline, EXPECTED_HASH } = require('./render-baseline.cjs')
const { renderReconciliation, SUPPLEMENT_HASH } = require('./render-reconciliation.cjs')

const STAGING_REF = 'omxoyujlteqcolqcdzxp'
const REVISION = 'p0-closed-bootstrap-20261005-v1'

function transactionBody(sql) {
  const normalized = sql.replaceAll('\r\n', '\n')
  assert.equal((normalized.match(/^BEGIN;$/gm) || []).length, 1)
  assert.equal((normalized.match(/^COMMIT;$/gm) || []).length, 1)
  return normalized.slice(normalized.indexOf('\nBEGIN;') + 8, normalized.lastIndexOf('\nCOMMIT;')).trim()
}

function renderStagingBootstrap() {
  const seed = fs.readFileSync('supabase/seed.sql', 'utf8').replaceAll('\r\n', '\n')
  // Only catalog/portion fixtures cross this boundary. Local Auth credentials never do.
  const catalog = seed.slice(seed.indexOf('INSERT INTO public.categories'), seed.lastIndexOf('\nCOMMIT;'))
  assert(catalog.startsWith('INSERT INTO public.categories'))
  assert(!/auth\.|password|Local-test-only/i.test(catalog))
  return [
    '-- Reviewed P0 staging-only bootstrap. Authorized target: ' + STAGING_REF,
    '-- Revision: ' + REVISION,
    '-- CLOSED to anon/authenticated API access; not a production migration or P1 fix.',
    '-- Execute only with the CLI explicit --linked --project-ref target. Never db push/reset --linked.',
    '-- Source baseline SHA-256: ' + EXPECTED_HASH,
    '-- Source supplement SHA-256: ' + SUPPLEMENT_HASH,
    'BEGIN;',
    `DO $empty_staging$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'p'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public')
     OR EXISTS (SELECT 1 FROM auth.users)
     OR EXISTS (SELECT 1 FROM storage.buckets)
     OR EXISTS (SELECT 1 FROM storage.objects)
     OR to_regnamespace('patanos_staging') IS NOT NULL THEN
    RAISE EXCEPTION 'P0 staging bootstrap requires an empty project; no reset or upgrade is authorized';
  END IF;
END;
$empty_staging$;`,
    transactionBody(renderBaseline()),
    transactionBody(renderReconciliation()),
    catalog,
    '-- Containment, not production security: preserve reviewed policy/RPC debt behind closed API grants.',
    'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;',
    'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;',
    'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;',
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;',
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;',
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;',
    "UPDATE storage.buckets SET public = false WHERE id IN ('menu-images', 'gallery-images');",
    'CREATE SCHEMA patanos_staging;',
    'REVOKE ALL ON SCHEMA patanos_staging FROM PUBLIC, anon, authenticated;',
    'CREATE TABLE patanos_staging.bootstrap (revision text PRIMARY KEY, intended_project_ref text NOT NULL, baseline_sha256 text NOT NULL, supplement_sha256 text NOT NULL, installed_at timestamptz NOT NULL DEFAULT now(), client_access_enabled boolean NOT NULL DEFAULT false);',
    'REVOKE ALL ON ALL TABLES IN SCHEMA patanos_staging FROM PUBLIC, anon, authenticated;',
    `INSERT INTO patanos_staging.bootstrap (revision, intended_project_ref, baseline_sha256, supplement_sha256) VALUES ('${REVISION}', '${STAGING_REF}', '${EXPECTED_HASH}', '${SUPPLEMENT_HASH}');`,
    'COMMIT;',
    '',
  ].join('\n\n').trimEnd() + '\n'
}

module.exports = { renderStagingBootstrap, STAGING_REF, REVISION }
if (require.main === module) process.stdout.write(renderStagingBootstrap())
