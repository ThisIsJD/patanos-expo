const { renderBaseline } = require('./render-baseline.cjs')
const { STAGING_REF, REVISION } = require('./render-staging-bootstrap.cjs')

const OWNER_ID = '0fb1197e-dc56-4529-bbb4-44b58cc55f70'
const CASHIER_ID = '62b5c877-4051-4e2a-8659-163dec9a71bc'
const TABLES = ['categories', 'gallery_photos', 'inventory', 'menu_items', 'modifier_groups', 'modifiers', 'order_item_modifiers', 'order_items', 'orders', 'profiles']

function renderStagingAccess() {
  const originalRpc = renderBaseline().match(/CREATE OR REPLACE FUNCTION public\.place_order\([\s\S]*?\$function\$;/)[0]
  const guardedRpc = originalRpc.replace('v_user_id := auth.uid();', `v_user_id := auth.uid();
  IF NOT public.p0_staging_staff_allowed() THEN
    RAISE EXCEPTION 'Staging staff access not approved';
  END IF;`)
  return [
    '-- P0 controlled staging access only. Authorized target: ' + STAGING_REF,
    '-- Owner-supplied freshly created staging IDs; no credentials or development accounts.',
    '-- Signup/anonymous off, Email-only confirmed users: owner-confirmed precondition.',
    '-- Test containment is NOT the P1 production authorization/payment/inventory fixes.',
    'BEGIN;',
    `DO $controlled_setup$
BEGIN
  IF (SELECT count(*) FROM patanos_staging.bootstrap WHERE revision = '${REVISION}' AND intended_project_ref = '${STAGING_REF}' AND NOT client_access_enabled) <> 1
     OR (SELECT count(*) FROM auth.users) <> 2
     OR (SELECT count(*) FROM auth.users WHERE id IN ('${OWNER_ID}', '${CASHIER_ID}') AND email_confirmed_at IS NOT NULL AND NOT is_anonymous AND (banned_until IS NULL OR banned_until <= now())) <> 2
     OR (SELECT count(*) FROM public.profiles WHERE id IN ('${OWNER_ID}', '${CASHIER_ID}')) <> 2
     OR EXISTS (SELECT 1 FROM public.orders) THEN
    RAISE EXCEPTION 'Controlled staging access requires the verified closed bootstrap, exactly two approved confirmed users and no sales';
  END IF;
END;
$controlled_setup$;`,
    'CREATE TABLE patanos_staging.staff_access (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, fixture_role public.user_role NOT NULL);',
    'REVOKE ALL ON TABLE patanos_staging.staff_access FROM PUBLIC, anon, authenticated;',
    `INSERT INTO patanos_staging.staff_access (user_id, fixture_role) VALUES ('${OWNER_ID}', 'admin'), ('${CASHIER_ID}', 'cashier');`,
    `UPDATE public.profiles SET role = 'admin' WHERE id = '${OWNER_ID}';`,
    `UPDATE public.profiles SET role = 'cashier' WHERE id = '${CASHIER_ID}';`,
    `CREATE FUNCTION public.p0_staging_staff_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $allowed$
  SELECT EXISTS (
    SELECT 1 FROM patanos_staging.staff_access approved
    JOIN auth.users account ON account.id = approved.user_id
    WHERE approved.user_id = auth.uid() AND account.email_confirmed_at IS NOT NULL
      AND NOT account.is_anonymous AND (account.banned_until IS NULL OR account.banned_until <= now())
  );
$allowed$;`,
    'REVOKE ALL ON FUNCTION public.p0_staging_staff_allowed() FROM PUBLIC, anon;',
    'GRANT EXECUTE ON FUNCTION public.p0_staging_staff_allowed() TO authenticated;',
    ...TABLES.map(table => `CREATE POLICY p0_staging_allowlist ON public.${table} AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());`),
    guardedRpc,
    'REVOKE ALL ON FUNCTION public.place_order(text, numeric, numeric, text, jsonb) FROM PUBLIC, anon;',
    'GRANT EXECUTE ON FUNCTION public.place_order(text, numeric, numeric, text, jsonb) TO authenticated;',
    'GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;',
    // SECURITY INVOKER makes operational report reads respect the same staging allowlist.
    'ALTER VIEW public.daily_sales SET (security_invoker = true);',
    'ALTER VIEW public.category_sales SET (security_invoker = true);',
    ...TABLES.map(table => `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.${table} TO authenticated;`),
    'GRANT SELECT ON TABLE public.daily_sales, public.category_sales TO authenticated;',
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;',
    `CREATE POLICY p0_staging_storage_allowlist ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id NOT IN ('menu-images', 'gallery-images') OR public.p0_staging_staff_allowed())
WITH CHECK (bucket_id NOT IN ('menu-images', 'gallery-images') OR public.p0_staging_staff_allowed());`,
    `UPDATE patanos_staging.bootstrap SET client_access_enabled = true WHERE revision = '${REVISION}';`,
    'COMMIT;',
  ].join('\n\n') + '\n'
}

module.exports = { renderStagingAccess, OWNER_ID, CASHIER_ID }
if (require.main === module) process.stdout.write(renderStagingAccess())
