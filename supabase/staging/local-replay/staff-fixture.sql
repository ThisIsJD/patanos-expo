-- Disposable local SQL-role rehearsal ONLY. No login passwords or remote Auth writes.
-- UUIDs match the owner-approved staging fixtures; emails are synthetic substitutes.
BEGIN;
INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
 ('00000000-0000-0000-0000-000000000000', '0fb1197e-dc56-4529-bbb4-44b58cc55f70', 'authenticated', 'authenticated', 'owner-smoke@patanos.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', '62b5c877-4051-4e2a-8659-163dec9a71bc', 'authenticated', 'authenticated', 'cashier-smoke@patanos.test', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
COMMIT;
