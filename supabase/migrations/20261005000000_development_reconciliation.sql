-- LOCAL/CI reconstruction correction only; NOT approved for remote deployment.

-- Supplement: owner-confirmed development export 2026-10-05; SHA-256 2176652529ebb7e7f6d9718421e67998656f109b61258cee3f4a529b7e8f8f9a

-- Original baseline stays unchanged. Known authorization/transaction defects remain.

-- Requires no sales; recreates the generated subtotal and dependent report views.

-- Sequence max_value was rounded in the JSON export; do not use it as a SQL bound.

BEGIN;

SET LOCAL search_path = public, extensions;

DO $local_only$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders)
     OR EXISTS (SELECT 1 FROM public.order_items)
     OR EXISTS (SELECT 1 FROM public.order_item_modifiers) THEN
    RAISE EXCEPTION 'P0.2 local reconciliation requires an empty sales database; no history upgrade is authorized';
  END IF;
END;
$local_only$;

DROP VIEW public."category_sales";

DROP VIEW public."daily_sales";

ALTER TABLE public."order_items" DROP COLUMN "subtotal";

ALTER TABLE public."menu_items" ALTER COLUMN "price" TYPE numeric(10,2);

ALTER TABLE public."modifiers" ALTER COLUMN "extra_price" TYPE numeric(10,2);

ALTER TABLE public."order_item_modifiers" ALTER COLUMN "extra_price" TYPE numeric(10,2);

ALTER TABLE public."order_items" ALTER COLUMN "unit_price" TYPE numeric(10,2);

ALTER TABLE public."orders" ALTER COLUMN "subtotal" TYPE numeric(10,2);

ALTER TABLE public."orders" ALTER COLUMN "discount_amount" TYPE numeric(10,2);

ALTER TABLE public."orders" ALTER COLUMN "total_amount" TYPE numeric(10,2);

ALTER TABLE public."orders" ALTER COLUMN "amount_tendered" TYPE numeric(10,2);

ALTER TABLE public."orders" ALTER COLUMN "change_amount" TYPE numeric(10,2);

ALTER TABLE public."order_items" ADD COLUMN "subtotal" numeric(10,2) GENERATED ALWAYS AS (((quantity)::numeric * unit_price)) STORED;

ALTER TABLE public."gallery_photos" ALTER COLUMN "id" SET GENERATED ALWAYS;

ALTER TABLE public."inventory" ALTER COLUMN "id" SET GENERATED ALWAYS;

ALTER TABLE public."menu_items" ALTER COLUMN "id" SET GENERATED ALWAYS;

ALTER TABLE public."modifier_groups" ALTER COLUMN "id" SET GENERATED ALWAYS;

ALTER TABLE public."modifiers" ALTER COLUMN "id" SET GENERATED ALWAYS;

ALTER TABLE public."order_item_modifiers" ALTER COLUMN "id" SET GENERATED ALWAYS;

ALTER TABLE public."order_items" ALTER COLUMN "id" SET GENERATED ALWAYS;

ALTER TABLE public."orders" ALTER COLUMN "id" SET GENERATED ALWAYS;

CREATE VIEW public."category_sales" AS
 SELECT o.created_at::date AS sale_date,
    c.name AS category_name,
    sum(oi.quantity) AS items_sold,
    sum(oi.subtotal) AS revenue
   FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     JOIN categories c ON c.id = mi.category_id
  WHERE o.status = 'completed'::order_status
  GROUP BY (o.created_at::date), c.name
  ORDER BY (o.created_at::date) DESC, (sum(oi.subtotal)) DESC;

CREATE VIEW public."daily_sales" AS
 SELECT created_at::date AS sale_date,
    count(*) AS total_orders,
    COALESCE(sum(total_amount), 0::numeric) AS total_revenue,
    COALESCE(avg(total_amount), 0::numeric) AS avg_order_value,
    COALESCE(sum(total_amount) FILTER (WHERE payment_method = 'cash'::payment_method), 0::numeric) AS cash_sales,
    COALESCE(sum(total_amount) FILTER (WHERE payment_method = 'gcash'::payment_method), 0::numeric) AS gcash_sales,
    count(*) FILTER (WHERE order_type = 'dine-in'::order_type) AS dinein_count,
    count(*) FILTER (WHERE order_type = 'takeout'::order_type) AS takeout_count,
    count(*) FILTER (WHERE order_type = 'delivery'::order_type) AS delivery_count
   FROM orders
  WHERE status = 'completed'::order_status
  GROUP BY (created_at::date)
  ORDER BY (created_at::date) DESC;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."categories" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."category_sales" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."category_sales" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."category_sales" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."category_sales" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."daily_sales" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."daily_sales" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."daily_sales" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."daily_sales" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."gallery_photos" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."gallery_photos" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."gallery_photos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."gallery_photos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."inventory" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."inventory" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."inventory" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."inventory" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."menu_items" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."menu_items" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."menu_items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."menu_items" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifier_groups" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifier_groups" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifier_groups" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifier_groups" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifiers" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifiers" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifiers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."modifiers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_item_modifiers" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_item_modifiers" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_item_modifiers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_item_modifiers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_items" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_items" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."order_items" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."orders" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."orders" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."orders" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."orders" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "service_role";

-- Captured supabase_admin default privileges remain managed by Supabase, not altered here.

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";

DO $publication$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$publication$;

ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete, truncate');

DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gallery_photos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."gallery_photos";
  END IF;
END;
$membership$;

DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."inventory";
  END IF;
END;
$membership$;

DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'menu_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."menu_items";
  END IF;
END;
$membership$;

DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'modifier_groups') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."modifier_groups";
  END IF;
END;
$membership$;

DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'modifiers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."modifiers";
  END IF;
END;
$membership$;

DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."order_items";
  END IF;
END;
$membership$;

DO $membership$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."orders";
  END IF;
END;
$membership$;

COMMIT;
