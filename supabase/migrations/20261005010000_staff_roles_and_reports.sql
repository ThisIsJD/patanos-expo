-- P1-01/P1-02: additive security boundaries. No historical sales are recreated.
BEGIN;

-- A table-level UPDATE would override any protected-column revocation.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, email, full_name, role, avatar_url, created_at, updated_at)
  ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

CREATE FUNCTION public.guard_profile_identity_and_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
BEGIN
  -- Effective SQL identity, never a mutable JWT claim or custom session flag.
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email IS DISTINCT FROM OLD.email OR NEW.created_at IS DISTINCT FROM OLD.created_at)
     AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'Profile identity and role require a trusted server operation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_profile_identity_and_role() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_guard_identity_and_role BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_identity_and_role();

CREATE SCHEMA IF NOT EXISTS patanos_private;
REVOKE ALL ON SCHEMA patanos_private FROM PUBLIC, anon, authenticated;
CREATE TABLE patanos_private.staff_role_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  previous_role public.user_role NOT NULL,
  new_role public.user_role NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE patanos_private.staff_role_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE patanos_private.staff_role_audit_id_seq FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.set_staff_role(p_user_id uuid, p_role public.user_role)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  previous_role public.user_role;
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can assign staff roles' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'Staff identity and role are required' USING ERRCODE = '22023';
  END IF;
  -- Serialize owner changes, including concurrent attempts to remove the last owner.
  LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;
  IF public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can assign staff roles' USING ERRCODE = '42501';
  END IF;
  SELECT profile.role INTO previous_role FROM public.profiles profile WHERE profile.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff profile not found' USING ERRCODE = '22023';
  END IF;
  IF previous_role = 'admin'::public.user_role AND p_role <> 'admin'::public.user_role
     AND (SELECT count(*) FROM public.profiles WHERE role = 'admin'::public.user_role) <= 1 THEN
    RAISE EXCEPTION 'The last owner cannot be demoted' USING ERRCODE = '42501';
  END IF;
  IF previous_role IS DISTINCT FROM p_role THEN
    UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
    INSERT INTO patanos_private.staff_role_audit (actor_id, staff_id, previous_role, new_role)
      VALUES (auth.uid(), p_user_id, previous_role, p_role);
  END IF;
  RETURN pg_catalog.jsonb_build_object('user_id', p_user_id, 'role', p_role);
END;
$function$;
ALTER FUNCTION public.set_staff_role(uuid, public.user_role) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_staff_role(uuid, public.user_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_role(uuid, public.user_role) TO authenticated;

-- Owner-owned views can bypass underlying RLS. Keep their existing report formulas
-- for P6, but expose data only through a runtime owner-checked RPC.
REVOKE ALL ON TABLE public.daily_sales, public.category_sales FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.owner_daily_sales(p_start_date date, p_end_date date)
RETURNS SETOF public.daily_sales
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can read sales reports' USING ERRCODE = '42501';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'A valid inclusive report date range is required' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT report.* FROM public.daily_sales report
    WHERE report.sale_date BETWEEN p_start_date AND p_end_date ORDER BY report.sale_date DESC;
END;
$function$;
ALTER FUNCTION public.owner_daily_sales(date, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.owner_daily_sales(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_daily_sales(date, date) TO authenticated;

CREATE FUNCTION public.owner_category_sales(p_start_date date, p_end_date date)
RETURNS SETOF public.category_sales
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.get_user_role() IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Only an owner can read sales reports' USING ERRCODE = '42501';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'A valid inclusive report date range is required' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT report.* FROM public.category_sales report
    WHERE report.sale_date BETWEEN p_start_date AND p_end_date ORDER BY report.revenue DESC;
END;
$function$;
ALTER FUNCTION public.owner_category_sales(date, date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.owner_category_sales(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_category_sales(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
