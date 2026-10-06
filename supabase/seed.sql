-- SYNTHETIC LOCAL fixtures only. Never run against a linked/staging/production DB.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'admin@patanos.test',
   extensions.crypt('Local-test-only-123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'cashier@patanos.test',
   extensions.crypt('Local-test-only-123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Synthetic Cashier"}', now(), now(), '', '', '', '');

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
SELECT gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now()
FROM auth.users WHERE id IN ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

-- Fixture-only bootstrap by postgres. Never auto-approve all profiles on hosted promotion.
UPDATE public.profiles SET role = 'admin', is_enabled = true WHERE id = '11111111-1111-4111-8111-111111111111';
UPDATE public.profiles SET is_enabled = true WHERE id = '22222222-2222-4222-8222-222222222222';

INSERT INTO public.categories (id, name, slug, sort_order) VALUES
  ('33333333-3333-4333-8333-333333333333', 'Synthetic Drinks', 'synthetic-drinks', 1),
  ('44444444-4444-4444-8444-444444444444', 'Synthetic Meals', 'synthetic-meals', 2);

-- Stable synthetic IDs require an explicit fixture-only override of ALWAYS identities.
INSERT INTO public.menu_items (id, name, price, size_label, category_id, available) OVERRIDING SYSTEM VALUE VALUES
  (101, 'Test Iced Latte', 120, 'Regular', '33333333-3333-4333-8333-333333333333', true),
  (102, 'Test Iced Latte', 150, 'Large', '33333333-3333-4333-8333-333333333333', true),
  (103, 'Test Chicken Rice', 180, 'One portion', '44444444-4444-4444-8444-444444444444', true),
  (104, 'Test Sold-out Meal', 160, 'One portion', '44444444-4444-4444-8444-444444444444', false);

INSERT INTO public.modifier_groups (id, name, category_id, min_select, max_select) OVERRIDING SYSTEM VALUE VALUES
  (301, 'Synthetic Milk', '33333333-3333-4333-8333-333333333333', 1, 1);
INSERT INTO public.modifiers (id, modifier_group_id, name, extra_price, available) OVERRIDING SYSTEM VALUE VALUES
  (201, 301, 'Regular milk', 0, true), (202, 301, 'Oat milk', 25, true),
  (203, 301, 'Unavailable milk', 30, false);
INSERT INTO public.inventory (menu_item_id, stock_count, low_stock_threshold, track_inventory) VALUES
  (101, 20, 5, true), (102, 10, 3, true), (103, 12, 3, true), (104, 0, 3, true);

SELECT setval(pg_get_serial_sequence('public.menu_items', 'id'), (SELECT max(id) FROM public.menu_items));
SELECT setval(pg_get_serial_sequence('public.modifier_groups', 'id'), (SELECT max(id) FROM public.modifier_groups));
SELECT setval(pg_get_serial_sequence('public.modifiers', 'id'), (SELECT max(id) FROM public.modifiers));
COMMIT;
