-- P1-03 additive LOCAL/CI implementation. Remote promotion requires separate review/authorization.
-- Not an idempotent sale ledger, refund workflow, or portion/waste ledger (P2/P4).
BEGIN;

ALTER TABLE public.orders ADD COLUMN cancel_release_stock boolean NOT NULL DEFAULT false;

REVOKE ALL ON TABLE public.orders, public.order_items, public.order_item_modifiers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.orders, public.order_items, public.order_item_modifiers TO authenticated;
REVOKE ALL ON SEQUENCE public.orders_id_seq, public.order_items_id_seq, public.order_item_modifiers_id_seq FROM PUBLIC, anon, authenticated;

-- Defense in depth: a future accidental grant must not reopen raw business writes.
CREATE FUNCTION public.guard_order_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Orders require a trusted server operation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_guard_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_mutation();
CREATE TRIGGER order_items_guard_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_order_mutation();
CREATE TRIGGER order_modifiers_guard_mutation BEFORE INSERT OR UPDATE OR DELETE ON public.order_item_modifiers
FOR EACH ROW EXECUTE FUNCTION public.guard_order_mutation();

CREATE TABLE patanos_private.order_mutation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL,
  actor_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('place', 'complete', 'cancel')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  release_stock boolean
);
REVOKE ALL ON TABLE patanos_private.order_mutation_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE patanos_private.order_mutation_audit_id_seq FROM PUBLIC, anon, authenticated;

CREATE FUNCTION patanos_private.require_order_staff()
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  staff_id uuid := auth.uid();
  staff_role public.user_role;
BEGIN
  SELECT role INTO staff_role FROM public.profiles WHERE id = staff_id FOR SHARE;
  IF staff_id IS NULL OR staff_role IS NULL OR staff_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'An authenticated staff profile is required';
  END IF;
  RETURN staff_id;
END;
$$;
REVOKE ALL ON FUNCTION patanos_private.require_order_staff() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.place_order(p_order_type text, p_subtotal numeric,
  p_total_amount numeric, p_notes text DEFAULT NULL, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  staff_id uuid := patanos_private.require_order_staff();
  placed_order public.orders%ROWTYPE;
  catalog_item public.menu_items%ROWTYPE;
  catalog_modifier public.modifiers%ROWTYPE;
  selection_group public.modifier_groups%ROWTYPE;
  item jsonb;
  modifier jsonb;
  selected_modifiers jsonb;
  selected_ids bigint[];
  group_count integer;
  quantity integer;
  unit_price numeric;
  computed_total numeric := 0;
  inserted_item_id bigint;
  normalized_items jsonb := '[]'::jsonb;
  normalized_modifiers jsonb;
BEGIN
  IF p_order_type IS NULL OR p_order_type NOT IN ('dine-in', 'takeout', 'delivery')
     OR p_subtotal IS NULL OR p_total_amount IS NULL
     OR p_subtotal::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_total_amount::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_subtotal < 0 OR p_total_amount < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid order type or amounts';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Order items must be an array';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 OR length(coalesce(p_notes, '')) > 2000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid item count or order notes';
  END IF;
  -- Small single-cafe catalog: prevent mixed catalog versions during validation/snapshotting.
  LOCK TABLE public.menu_items, public.categories, public.modifier_groups, public.modifiers IN SHARE MODE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid order item';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(item) AS fields(key)
      WHERE key NOT IN ('menu_item_id', 'item_name', 'size_label', 'quantity', 'unit_price', 'notes', 'modifiers'))
      OR jsonb_typeof(item->'menu_item_id') IS DISTINCT FROM 'number'
      OR coalesce(item->>'menu_item_id', '') !~ '^[1-9][0-9]{0,17}$'
      OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
      OR coalesce(item->>'quantity', '') !~ '^[1-9][0-9]{0,2}$'
      OR (item->>'quantity')::integer > 100
      OR jsonb_typeof(item->'unit_price') IS DISTINCT FROM 'number'
      OR length(coalesce(item->>'notes', '')) > 2000 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid order item fields';
    END IF;
    SELECT menu.* INTO catalog_item FROM public.menu_items menu JOIN public.categories category ON category.id = menu.category_id
      WHERE menu.id = (item->>'menu_item_id')::bigint AND menu.status = 'published' AND menu.available AND category.status = 'published';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Menu item is unavailable';
    END IF;
    quantity := (item->>'quantity')::integer;
    unit_price := catalog_item.price;
    selected_modifiers := coalesce(item->'modifiers', '[]'::jsonb);
    IF jsonb_typeof(selected_modifiers) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Modifiers must be an array';
    END IF;
    IF jsonb_array_length(selected_modifiers) > 100 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Too many modifiers';
    END IF;
    selected_ids := ARRAY[]::bigint[];
    normalized_modifiers := '[]'::jsonb;
    FOR modifier IN SELECT value FROM jsonb_array_elements(selected_modifiers) LOOP
      IF jsonb_typeof(modifier) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid modifier';
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(modifier) AS fields(key) WHERE key NOT IN ('id', 'modifier_name', 'extra_price'))
        OR jsonb_typeof(modifier->'id') IS DISTINCT FROM 'number'
        OR coalesce(modifier->>'id', '') !~ '^[1-9][0-9]{0,17}$' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid modifier fields';
      END IF;
      SELECT option.* INTO catalog_modifier FROM public.modifiers option JOIN public.modifier_groups grp ON grp.id = option.modifier_group_id
        WHERE option.id = (modifier->>'id')::bigint AND option.available AND grp.status = 'published'
          AND (grp.menu_item_id = catalog_item.id OR grp.category_id = catalog_item.category_id
            OR (grp.menu_item_id IS NULL AND grp.category_id IS NULL));
      IF NOT FOUND OR catalog_modifier.id = ANY(selected_ids) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Modifier is unavailable, duplicated or does not apply';
      END IF;
      IF jsonb_typeof(modifier->'extra_price') IS DISTINCT FROM 'number'
        OR (modifier->>'extra_price')::numeric IS DISTINCT FROM catalog_modifier.extra_price THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Modifier price changed; refresh the menu';
      END IF;
      selected_ids := array_append(selected_ids, catalog_modifier.id);
      unit_price := unit_price + catalog_modifier.extra_price;
      normalized_modifiers := normalized_modifiers || jsonb_build_array(jsonb_build_object('id', catalog_modifier.id,
        'modifier_name', catalog_modifier.name, 'extra_price', catalog_modifier.extra_price));
    END LOOP;
    FOR selection_group IN SELECT * FROM public.modifier_groups grp WHERE grp.status = 'published'
      AND (grp.menu_item_id = catalog_item.id OR grp.category_id = catalog_item.category_id
        OR (grp.menu_item_id IS NULL AND grp.category_id IS NULL)) LOOP
      SELECT count(*) INTO group_count FROM public.modifiers option
        WHERE option.id = ANY(selected_ids) AND option.modifier_group_id = selection_group.id;
      IF group_count < selection_group.min_select OR group_count > coalesce(selection_group.max_select, 100) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Modifier selection limits not satisfied';
      END IF;
    END LOOP;
    IF unit_price::text IN ('NaN', 'Infinity', '-Infinity') OR unit_price NOT BETWEEN 0 AND 50000
      OR (item->>'unit_price')::numeric IS DISTINCT FROM unit_price THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Item price changed; refresh the menu';
    END IF;
    computed_total := computed_total + unit_price * quantity;
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object('menu_item_id', catalog_item.id,
      'item_name', catalog_item.name, 'size_label', catalog_item.size_label, 'quantity', quantity,
      'unit_price', unit_price, 'notes', item->>'notes', 'modifiers', normalized_modifiers));
  END LOOP;
  -- Preserve the existing one-peso validation tolerance, but never persist a forged total.
  IF abs(p_subtotal - computed_total) > 1 OR abs(p_total_amount - computed_total) > 1 OR computed_total > 99999999.99 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Order totals do not match the menu';
  END IF;
  PERFORM inventory.id FROM public.inventory inventory WHERE inventory.menu_item_id IN
    (SELECT (value->>'menu_item_id')::bigint FROM jsonb_array_elements(normalized_items)) ORDER BY inventory.menu_item_id FOR UPDATE;
  INSERT INTO public.orders (order_type, subtotal, total_amount, notes, created_by)
    VALUES (p_order_type::public.order_type, computed_total, computed_total, p_notes, staff_id) RETURNING * INTO placed_order;
  FOR item IN SELECT value FROM jsonb_array_elements(normalized_items) LOOP
    INSERT INTO public.order_items (order_id, menu_item_id, item_name, size_label, quantity, unit_price, notes)
      VALUES (placed_order.id, (item->>'menu_item_id')::bigint, item->>'item_name', item->>'size_label',
        (item->>'quantity')::integer, (item->>'unit_price')::numeric, item->>'notes') RETURNING id INTO inserted_item_id;
    FOR modifier IN SELECT value FROM jsonb_array_elements(item->'modifiers') LOOP
      INSERT INTO public.order_item_modifiers (order_item_id, modifier_id, modifier_name, extra_price)
        VALUES (inserted_item_id, (modifier->>'id')::bigint, modifier->>'modifier_name', (modifier->>'extra_price')::numeric);
    END LOOP;
  END LOOP;
  INSERT INTO patanos_private.order_mutation_audit (order_id, actor_id, operation) VALUES (placed_order.id, staff_id, 'place');
  RETURN to_jsonb(placed_order);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.inventory SET stock_count = stock_count - NEW.quantity
    WHERE menu_item_id = NEW.menu_item_id AND track_inventory;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'cancelled' AND NEW.cancel_release_stock THEN
    PERFORM inventory.id FROM public.inventory inventory JOIN public.order_items item ON item.menu_item_id = inventory.menu_item_id
      WHERE item.order_id = NEW.id ORDER BY inventory.menu_item_id FOR UPDATE OF inventory;
    UPDATE public.inventory inventory SET stock_count = inventory.stock_count + portions.quantity
      FROM (SELECT menu_item_id, sum(quantity)::integer AS quantity FROM public.order_items
        WHERE order_id = NEW.id GROUP BY menu_item_id) portions
      WHERE inventory.menu_item_id = portions.menu_item_id AND inventory.track_inventory;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.complete_order(p_order_id bigint, p_payment_method text,
  p_amount_tendered numeric DEFAULT NULL, p_payment_ref text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  staff_id uuid := patanos_private.require_order_staff();
  target_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO target_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Order not found'; END IF;
  IF target_order.status <> 'open' THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Order is not open'; END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'gcash') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid payment method';
  END IF;
  IF p_payment_method = 'cash' AND (p_amount_tendered IS NULL
    OR p_amount_tendered::text IN ('NaN', 'Infinity', '-Infinity') OR p_amount_tendered < target_order.total_amount
    OR p_amount_tendered > 99999999.99 OR p_amount_tendered <> round(p_amount_tendered, 2)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cash tender must cover the total using valid centavos';
  END IF;
  IF length(coalesce(p_payment_ref, '')) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payment reference is too long';
  END IF;
  UPDATE public.orders SET status = 'completed', payment_method = p_payment_method::public.payment_method,
    amount_tendered = CASE WHEN p_payment_method = 'cash' THEN p_amount_tendered ELSE NULL END,
    change_amount = CASE WHEN p_payment_method = 'cash' THEN p_amount_tendered - target_order.total_amount ELSE NULL END,
    payment_ref = CASE WHEN p_payment_method = 'gcash' THEN nullif(btrim(p_payment_ref), '') ELSE NULL END,
    completed_at = now() WHERE id = target_order.id RETURNING * INTO target_order;
  INSERT INTO patanos_private.order_mutation_audit (order_id, actor_id, operation) VALUES (target_order.id, staff_id, 'complete');
  RETURN to_jsonb(target_order);
END;
$$;

CREATE FUNCTION public.cancel_order(p_order_id bigint, p_reason text, p_release_stock boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  staff_id uuid := patanos_private.require_order_staff();
  target_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO target_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Order not found'; END IF;
  IF target_order.status <> 'open' THEN RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Only an open unpaid order can be cancelled'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' OR length(p_reason) > 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A cancellation reason of 1 to 500 characters is required';
  END IF;
  UPDATE public.orders SET status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_reason),
    cancel_release_stock = coalesce(p_release_stock, false)
    WHERE id = target_order.id RETURNING * INTO target_order;
  INSERT INTO patanos_private.order_mutation_audit (order_id, actor_id, operation, reason, release_stock)
    VALUES (target_order.id, staff_id, 'cancel', btrim(p_reason), target_order.cancel_release_stock);
  RETURN to_jsonb(target_order);
END;
$$;

ALTER FUNCTION public.place_order(text, numeric, numeric, text, jsonb) OWNER TO postgres;
ALTER FUNCTION public.complete_order(bigint, text, numeric, text) OWNER TO postgres;
ALTER FUNCTION public.cancel_order(bigint, text, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.place_order(text, numeric, numeric, text, jsonb),
  public.complete_order(bigint, text, numeric, text), public.cancel_order(bigint, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(text, numeric, numeric, text, jsonb),
  public.complete_order(bigint, text, numeric, text), public.cancel_order(bigint, text, boolean) TO authenticated;

ALTER FUNCTION public.generate_order_number() SET search_path = '';
ALTER FUNCTION public.update_updated_at() SET search_path = '';
REVOKE ALL ON FUNCTION public.guard_order_mutation(), public.decrement_stock(), public.restore_stock_on_cancel(),
  public.generate_order_number(), public.update_updated_at(), public.handle_new_user(), public.guard_profile_identity_and_role()
  FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
