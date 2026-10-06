-- P1-04 LOCAL/CI only. Hosted promotion requires a separately reviewed owner bootstrap.
-- Fail closed: existing and future profiles need explicit trusted approval; no sales change.
BEGIN;

ALTER TABLE public.profiles ADD COLUMN is_enabled boolean NOT NULL DEFAULT false;
REVOKE UPDATE (is_enabled) ON public.profiles FROM PUBLIC, anon, authenticated;

CREATE FUNCTION patanos_private.staff_account_eligible(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users account WHERE account.id = p_user_id
      AND account.email_confirmed_at IS NOT NULL
      AND account.email IS NOT NULL
      AND NOT coalesce(account.is_anonymous, false)
      AND (account.banned_until IS NULL OR account.banned_until <= now())
  );
$$;
REVOKE ALL ON FUNCTION patanos_private.staff_account_eligible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT profile.role FROM public.profiles profile WHERE profile.id = auth.uid()
    AND profile.is_enabled AND patanos_private.staff_account_eligible(profile.id);
$$;
ALTER FUNCTION public.get_user_role() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Metadata is user-editable. Never trust role, approval, or enabled claims from it.
  INSERT INTO public.profiles (id, email, full_name, role, is_enabled)
    VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data ->> 'full_name', ''), 'cashier', false);
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_identity_and_role()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email IS DISTINCT FROM OLD.email OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.is_enabled IS DISTINCT FROM OLD.is_enabled)
     AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Profile identity and role require a trusted server operation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_identity_and_role() FROM PUBLIC, anon, authenticated;

-- Existing auth.uid()-only permissive policies otherwise admit disabled/unsigned-up staff.
-- Published catalog/image access for anonymous visitors is deliberately unchanged.
DO $policies$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['categories', 'gallery_photos', 'inventory',
    'menu_items', 'modifier_groups', 'modifiers', 'orders', 'order_items', 'order_item_modifiers']
  LOOP
    EXECUTE format('CREATE POLICY "Enabled staff access" ON public.%I AS RESTRICTIVE
      FOR ALL TO authenticated USING (public.get_user_role() IS NOT NULL)
      WITH CHECK (public.get_user_role() IS NOT NULL)', relation_name);
  END LOOP;
END;
$policies$;
-- A disabled user can still read their own profile to show the correct locked state.
CREATE POLICY "Enabled staff profile edits" ON public.profiles AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (public.get_user_role() IS NOT NULL)
  WITH CHECK (public.get_user_role() IS NOT NULL);

CREATE OR REPLACE FUNCTION patanos_private.require_order_staff()
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  staff_id uuid := auth.uid();
  staff_role public.user_role;
BEGIN
  -- Hold approval through the whole sale transaction; disabling waits for committed work.
  SELECT role INTO staff_role FROM public.profiles WHERE id = staff_id AND is_enabled FOR SHARE;
  IF staff_id IS NULL OR staff_role IS NULL OR staff_role NOT IN ('admin', 'cashier')
     OR NOT patanos_private.staff_account_eligible(staff_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'An authenticated staff profile is required';
  END IF;
  RETURN staff_id;
END;
$$;
REVOKE ALL ON FUNCTION patanos_private.require_order_staff() FROM PUBLIC, anon, authenticated;

CREATE TABLE patanos_private.staff_access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  previous_enabled boolean NOT NULL,
  new_enabled boolean NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 240),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE patanos_private.staff_access_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE patanos_private.staff_access_audit_id_seq FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.set_staff_enabled(p_user_id uuid, p_enabled boolean, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can change staff access' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_enabled IS NULL OR p_reason IS NULL
     OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Staff identity, enabled state and a 3-240 character reason are required' USING ERRCODE = '22023';
  END IF;
  -- Same lock as role changes: concurrent disable/demotion cannot remove every owner.
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can change staff access' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff profile not found' USING ERRCODE = '22023';
  END IF;
  IF p_enabled AND NOT patanos_private.staff_account_eligible(p_user_id) THEN
    RAISE EXCEPTION 'Only a confirmed, non-anonymous, unbanned email account can be approved' USING ERRCODE = '22023';
  END IF;
  IF NOT p_enabled AND target_profile.is_enabled AND target_profile.role = 'admin'
     AND patanos_private.staff_account_eligible(p_user_id)
     AND (SELECT count(*) FROM public.profiles WHERE role = 'admin' AND is_enabled
       AND patanos_private.staff_account_eligible(id)) <= 1 THEN
    RAISE EXCEPTION 'The last active owner cannot be disabled' USING ERRCODE = '42501';
  END IF;
  IF target_profile.is_enabled IS DISTINCT FROM p_enabled THEN
    UPDATE public.profiles SET is_enabled = p_enabled WHERE id = p_user_id;
    INSERT INTO patanos_private.staff_access_audit (actor_id, staff_id, previous_enabled, new_enabled, reason)
      VALUES (auth.uid(), p_user_id, target_profile.is_enabled, p_enabled, btrim(p_reason));
  END IF;
  RETURN pg_catalog.jsonb_build_object('user_id', p_user_id, 'role', target_profile.role, 'is_enabled', p_enabled);
END;
$$;
ALTER FUNCTION public.set_staff_enabled(uuid, boolean, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_staff_enabled(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_enabled(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_staff_role(p_user_id uuid, p_role public.user_role)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can assign staff roles' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Staff identity and role are required' USING ERRCODE = '22023';
  END IF;
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can assign staff roles' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO target_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff profile not found' USING ERRCODE = '22023';
  END IF;
  IF target_profile.role = 'admin' AND target_profile.is_enabled AND p_role <> 'admin'
     AND patanos_private.staff_account_eligible(p_user_id)
     AND (SELECT count(*) FROM public.profiles WHERE role = 'admin' AND is_enabled
       AND patanos_private.staff_account_eligible(id)) <= 1 THEN
    RAISE EXCEPTION 'The last owner cannot be demoted' USING ERRCODE = '42501';
  END IF;
  IF target_profile.role IS DISTINCT FROM p_role THEN
    UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
    INSERT INTO patanos_private.staff_role_audit (actor_id, staff_id, previous_role, new_role)
      VALUES (auth.uid(), p_user_id, target_profile.role, p_role);
  END IF;
  RETURN pg_catalog.jsonb_build_object('user_id', p_user_id, 'role', p_role);
END;
$$;
ALTER FUNCTION public.set_staff_role(uuid, public.user_role) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_staff_role(uuid, public.user_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_role(uuid, public.user_role) TO authenticated;

-- Role assignment and approval either both commit or both roll back.
CREATE FUNCTION public.approve_staff(p_user_id uuid, p_role public.user_role, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.set_staff_role(p_user_id, p_role);
  RETURN public.set_staff_enabled(p_user_id, true, p_reason);
END;
$$;
ALTER FUNCTION public.approve_staff(uuid, public.user_role, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.approve_staff(uuid, public.user_role, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_staff(uuid, public.user_role, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
