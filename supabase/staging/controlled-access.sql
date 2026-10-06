-- P0 controlled staging access only. Authorized target: omxoyujlteqcolqcdzxp

-- Owner-supplied freshly created staging IDs; no credentials or development accounts.

-- Signup/anonymous off, Email-only confirmed users: owner-confirmed precondition.

-- Test containment is NOT the P1 production authorization/payment/inventory fixes.

BEGIN;

DO $controlled_setup$
BEGIN
  IF (SELECT count(*) FROM patanos_staging.bootstrap WHERE revision = 'p0-closed-bootstrap-20261005-v1' AND intended_project_ref = 'omxoyujlteqcolqcdzxp' AND NOT client_access_enabled) <> 1
     OR (SELECT count(*) FROM auth.users) <> 2
     OR (SELECT count(*) FROM auth.users WHERE id IN ('0fb1197e-dc56-4529-bbb4-44b58cc55f70', '62b5c877-4051-4e2a-8659-163dec9a71bc') AND email_confirmed_at IS NOT NULL AND NOT is_anonymous AND (banned_until IS NULL OR banned_until <= now())) <> 2
     OR (SELECT count(*) FROM public.profiles WHERE id IN ('0fb1197e-dc56-4529-bbb4-44b58cc55f70', '62b5c877-4051-4e2a-8659-163dec9a71bc')) <> 2
     OR EXISTS (SELECT 1 FROM public.orders) THEN
    RAISE EXCEPTION 'Controlled staging access requires the verified closed bootstrap, exactly two approved confirmed users and no sales';
  END IF;
END;
$controlled_setup$;

CREATE TABLE patanos_staging.staff_access (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, fixture_role public.user_role NOT NULL);

REVOKE ALL ON TABLE patanos_staging.staff_access FROM PUBLIC, anon, authenticated;

INSERT INTO patanos_staging.staff_access (user_id, fixture_role) VALUES ('0fb1197e-dc56-4529-bbb4-44b58cc55f70', 'admin'), ('62b5c877-4051-4e2a-8659-163dec9a71bc', 'cashier');

UPDATE public.profiles SET role = 'admin' WHERE id = '0fb1197e-dc56-4529-bbb4-44b58cc55f70';

UPDATE public.profiles SET role = 'cashier' WHERE id = '62b5c877-4051-4e2a-8659-163dec9a71bc';

CREATE FUNCTION public.p0_staging_staff_allowed() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $allowed$
  SELECT EXISTS (
    SELECT 1 FROM patanos_staging.staff_access approved
    JOIN auth.users account ON account.id = approved.user_id
    WHERE approved.user_id = auth.uid() AND account.email_confirmed_at IS NOT NULL
      AND NOT account.is_anonymous AND (account.banned_until IS NULL OR account.banned_until <= now())
  );
$allowed$;

REVOKE ALL ON FUNCTION public.p0_staging_staff_allowed() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.p0_staging_staff_allowed() TO authenticated;

CREATE POLICY p0_staging_allowlist ON public.categories AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.gallery_photos AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.inventory AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.menu_items AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.modifier_groups AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.modifiers AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.order_item_modifiers AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.order_items AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.orders AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE POLICY p0_staging_allowlist ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING (public.p0_staging_staff_allowed()) WITH CHECK (public.p0_staging_staff_allowed());

CREATE OR REPLACE FUNCTION public.place_order(p_order_type text, p_subtotal numeric, p_total_amount numeric, p_notes text DEFAULT NULL::text, p_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_inserted_item_id bigint;
  v_modifier jsonb;
  v_result jsonb;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF NOT public.p0_staging_staff_allowed() THEN
    RAISE EXCEPTION 'Staging staff access not approved';
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate order type
  IF p_order_type NOT IN ('dine-in', 'takeout', 'delivery') THEN
    RAISE EXCEPTION 'Invalid order type: %', p_order_type;
  END IF;

  -- Validate amounts
  IF p_subtotal < 0 OR p_total_amount < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  -- Validate items array
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must have at least one item';
  END IF;

  -- 1. Insert order (order_number auto-generated by existing trigger)
  INSERT INTO orders (order_type, subtotal, total_amount, notes, created_by)
  VALUES (p_order_type::order_type, p_subtotal, p_total_amount, p_notes, v_user_id)
  RETURNING * INTO v_order;

  -- 2. Insert order items and their modifiers
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate individual item
    IF (v_item->>'quantity')::int < 1 THEN
      RAISE EXCEPTION 'Invalid quantity for item: %', v_item->>'item_name';
    END IF;
    IF (v_item->>'unit_price')::numeric < 0 THEN
      RAISE EXCEPTION 'Invalid price for item: %', v_item->>'item_name';
    END IF;

    INSERT INTO order_items (order_id, menu_item_id, item_name, size_label, quantity, unit_price, notes)
    VALUES (
      v_order.id,
      (v_item->>'menu_item_id')::bigint,
      v_item->>'item_name',
      v_item->>'size_label',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      v_item->>'notes'
    )
    RETURNING id INTO v_inserted_item_id;

    -- 3. Insert modifiers for this item
    IF v_item ? 'modifiers' AND jsonb_array_length(v_item->'modifiers') > 0 THEN
      FOR v_modifier IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
      LOOP
        INSERT INTO order_item_modifiers (order_item_id, modifier_id, modifier_name, extra_price)
        VALUES (
          v_inserted_item_id,
          (v_modifier->>'id')::bigint,
          v_modifier->>'modifier_name',
          (v_modifier->>'extra_price')::numeric
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Return the created order as JSON
  v_result := jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'order_type', v_order.order_type,
    'subtotal', v_order.subtotal,
    'total_amount', v_order.total_amount,
    'status', v_order.status,
    'created_at', v_order.created_at
  );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.place_order(text, numeric, numeric, text, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.place_order(text, numeric, numeric, text, jsonb) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

ALTER VIEW public.daily_sales SET (security_invoker = true);

ALTER VIEW public.category_sales SET (security_invoker = true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gallery_photos TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.menu_items TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.modifier_groups TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.modifiers TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_item_modifiers TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

GRANT SELECT ON TABLE public.daily_sales, public.category_sales TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE POLICY p0_staging_storage_allowlist ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id NOT IN ('menu-images', 'gallery-images') OR public.p0_staging_staff_allowed())
WITH CHECK (bucket_id NOT IN ('menu-images', 'gallery-images') OR public.p0_staging_staff_allowed());

UPDATE patanos_staging.bootstrap SET client_access_enabled = true WHERE revision = 'p0-closed-bootstrap-20261005-v1';

COMMIT;
