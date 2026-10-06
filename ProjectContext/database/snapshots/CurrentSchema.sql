-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  role USER-DEFINED NOT NULL DEFAULT 'cashier'::user_role,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'published'::item_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.menu_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  size_label text,
  category_id uuid NOT NULL,
  image_url text,
  status USER-DEFINED NOT NULL DEFAULT 'published'::item_status,
  is_featured boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.gallery_photos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  image_url text NOT NULL,
  caption text NOT NULL DEFAULT ''::text,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'published'::item_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gallery_photos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_number text NOT NULL,
  order_type USER-DEFINED NOT NULL DEFAULT 'dine-in'::order_type CHECK (order_type = ANY (ARRAY['dine-in'::order_type, 'takeout'::order_type, 'delivery'::order_type])),
  status USER-DEFINED NOT NULL DEFAULT 'open'::order_status CHECK (status = ANY (ARRAY['open'::order_status, 'completed'::order_status, 'cancelled'::order_status])),
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0::numeric),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0::numeric),
  payment_method USER-DEFINED CHECK (payment_method IS NULL OR (payment_method = ANY (ARRAY['cash'::payment_method, 'gcash'::payment_method]))),
  payment_ref text,
  amount_tendered numeric,
  change_amount numeric,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  menu_item_id bigint NOT NULL,
  item_name text NOT NULL,
  size_label text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  subtotal numeric DEFAULT ((quantity)::numeric * unit_price),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)
);
CREATE TABLE public.inventory (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  menu_item_id bigint NOT NULL UNIQUE,
  stock_count integer NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 10,
  track_inventory boolean NOT NULL DEFAULT false,
  last_restocked_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)
);
CREATE TABLE public.modifier_groups (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  category_id uuid,
  menu_item_id bigint,
  min_select integer NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select integer CHECK (max_select IS NULL OR max_select >= 1),
  sort_order integer NOT NULL DEFAULT 0,
  status USER-DEFINED NOT NULL DEFAULT 'published'::item_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT modifier_groups_pkey PRIMARY KEY (id),
  CONSTRAINT modifier_groups_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT modifier_groups_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)
);
CREATE TABLE public.modifiers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  modifier_group_id bigint NOT NULL,
  name text NOT NULL,
  extra_price numeric NOT NULL DEFAULT 0 CHECK (extra_price >= 0::numeric),
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT modifiers_pkey PRIMARY KEY (id),
  CONSTRAINT modifiers_modifier_group_id_fkey FOREIGN KEY (modifier_group_id) REFERENCES public.modifier_groups(id)
);
CREATE TABLE public.order_item_modifiers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_item_id bigint NOT NULL,
  modifier_id bigint NOT NULL,
  modifier_name text NOT NULL,
  extra_price numeric NOT NULL DEFAULT 0 CHECK (extra_price >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_item_modifiers_pkey PRIMARY KEY (id),
  CONSTRAINT order_item_modifiers_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id),
  CONSTRAINT order_item_modifiers_modifier_id_fkey FOREIGN KEY (modifier_id) REFERENCES public.modifiers(id)
);