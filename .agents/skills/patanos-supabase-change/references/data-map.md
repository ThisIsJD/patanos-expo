# Patanos Supabase Data Map

Use this as a routing map, not as proof of the live production schema. `queryresults.json` is the repository's current metadata snapshot. Refresh it with `database-review.sql` before relying on schema-sensitive details.

## Client boundaries

| Area | Primary code | Remote or local data |
|---|---|---|
| Client setup | `src/lib/supabase.js` | Supabase client with AsyncStorage-backed auth persistence |
| Authentication and roles | `src/contexts/AuthContext.jsx`, `app/_layout.jsx` | Supabase Auth session plus `profiles.role` |
| Menu and category cache | `src/hooks/useMenu.js` | `menu_items`, `categories`, `modifier_groups`, `modifiers`; AsyncStorage cache; menu Realtime channel |
| Modifiers | `src/hooks/useModifiers.js` | Modifier groups/options with category or item targeting; Realtime refresh |
| Inventory | `src/hooks/useInventory.js` | `inventory` joined to menu data; Realtime refresh |
| Orders | `src/hooks/useOrders.js` | `orders`, nested items/modifiers, `place_order` RPC; Realtime refresh |
| Offline orders | `src/lib/offlineQueue.js` | AsyncStorage active and dead-letter queues |
| Reports | `src/hooks/useSalesReports.js` | `daily_sales` and `category_sales` views |
| Gallery | `src/hooks/useGallery.js` | `gallery_photos` plus gallery storage |
| Images | `src/utils/imageUpload.js` | Public URLs from `menu-images` and `gallery-images` buckets |

## Known public relations

Tables with RLS enabled:

- `categories`
- `gallery_photos`
- `inventory`
- `menu_items`
- `modifier_groups`
- `modifiers`
- `order_item_modifiers`
- `order_items`
- `orders`
- `profiles`

Views:

- `daily_sales`: completed-order totals by order creation date, including cash/GCash and order-type counts.
- `category_sales`: completed item quantity and revenue grouped by order creation date and category.

## Enumerated values

- `user_role`: `admin`, `cashier`
- `item_status`: `published`, `draft`, `archived`
- `order_type`: `dine-in`, `takeout`, `delivery`
- `order_status`: `open`, `completed`, `cancelled`
- `payment_method`: `cash`, `gcash`

## Order-related server behavior

- `place_order(p_order_type text, p_subtotal numeric, p_total_amount numeric, p_notes text, p_items jsonb)` is the client order-entry RPC in the snapshot.
- `orders_set_order_number` generates an order number before insert when absent.
- `order_items_decrement_stock` decrements inventory after an order item insert.
- `orders_restore_stock_on_cancel` restores stock after an order cancellation update.
- `orders.created_by` references `profiles.id`.
- Order items and item modifiers cascade when their parent is deleted; menu/modifier references are otherwise restricted.

The snapshot reports `place_order` as security-definer and executable by both `anon` and `authenticated`. Do not assume that is safe or intentional: verify the live function body, grants, internal authentication checks, and fixed `search_path` before modifying or relying on its security boundary.

## Policy shape in the snapshot

- Published menu, category, modifier-group, gallery, and relevant modifier data has public-read policies.
- Authenticated users can read operational menu/order data needed by staff.
- Admin policies govern menu, category, modifier, gallery, and inventory writes.
- Staff can update orders; cashiers/admins can create orders and child records.
- Users can read/update their own profile; admins can read/update all profiles.
- `menu-images` and `gallery-images` are publicly readable while admin policies govern writes.

Policy names are not proof of safety. Inspect `qual`, `with_check`, roles, function calls, and grants in `queryresults.json` or fresh metadata.

## Change checklist

- Which client callers and cached representations change?
- Which RLS policy and role authorizes each operation?
- Does a multi-table mutation remain atomic?
- Do triggers run once and in the intended order?
- Can Realtime or optimistic state produce duplicate refreshes or stale UI?
- Are public storage URLs appropriate for the content?
- Do reports retain their intended date and status semantics?
- Are migration and rollback steps explicit without mutating production unintentionally?
