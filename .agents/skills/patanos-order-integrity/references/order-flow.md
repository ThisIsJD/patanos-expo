# Patanos Order Flow and Invariants

This describes the current repository behavior. If database metadata has changed since `queryresults.json` was captured, refresh it before relying on server details.

## Flow map

```text
menu item + variant + modifiers
  -> CartContext.addItem/updateItem
  -> cart state (unit_price includes modifier extras)
  -> app/(pos)/order.jsx
  -> useOrders.placeOrder
  -> validateOrder
     -> online: useOrders._placeOrderOnline -> Supabase place_order RPC
     -> offline: offlineQueue.enqueue -> AsyncStorage active queue
  -> open-orders display
     -> online orders from Supabase Realtime/refetch
     -> queued orders projected from AsyncStorage
  -> completeOrder (payment) or cancelOrder
```

When connectivity returns:

```text
NetInfo status change
  -> useOrders.trySyncQueue
  -> offlineQueue.syncQueue
  -> _placeOrderOnline for each queued payload
  -> success: refetch remote orders, then refresh queued display
  -> failure below retry limit: retain with incremented _retryCount
  -> fifth failure: move to patanos_dead_orders
```

## Cart identity and pricing

- Cart rows are merged when `menu_item_id` and the sorted modifier ID set match.
- Each new distinct row receives a client `cartId` based on menu item ID and time.
- `base_price` stores the menu price.
- `unit_price` stores base price plus selected modifier extras.
- Subtotal is `sum(unit_price * quantity)`.
- `validateOrder` accepts a one-peso difference between computed and submitted subtotal to tolerate rounding.
- Notes live on the cart/order item and must survive item edits and offline projection.

Changing modifier identity, price calculation, row merging, or notes requires checking add, edit, remove, quantity, online payload, offline payload, and rendered order history together.

## Validation

Current client rules:

- order type: `dine-in`, `takeout`, or `delivery`;
- at least one item;
- item name is a string;
- quantity is from 1 through 100;
- unit price is from 0 through 50,000;
- subtotal is numeric and non-negative;
- subtotal matches the calculated item total within one peso.

Client validation improves feedback but is not a security boundary. Server validation, enum/check constraints, RLS, and RPC logic must enforce trusted behavior.

## Server effects from the metadata snapshot

- `place_order` is intended to insert the order and its children in one database transaction.
- A before-insert trigger generates a missing order number.
- An after-insert trigger on `order_items` decrements tracked stock.
- An after-update trigger on `orders` restores stock on cancellation.
- Reporting views count only completed orders.

Inspect the current function and trigger definitions before altering payloads or status transitions. The snapshot contains signatures and trigger wiring, not all function bodies.

## Offline failure model

- Active queue key: `patanos_offline_orders`.
- Dead-letter key: `patanos_dead_orders`.
- A module-level `syncLock` prevents concurrent queue processors in one JavaScript runtime.
- A hook `syncing` ref prevents duplicate starts from one hook instance.
- Failed items retry up to five times, then move to the dead-letter queue with failure metadata.
- The queue is rewritten after a sync pass.

Risks to analyze for any change:

- RPC commits but the client loses the response, then retries and duplicates the order.
- Multiple mounted hook instances observe connectivity changes.
- The app exits between a successful RPC and queue persistence.
- Cached menu prices differ from current server prices.
- Partial UI refresh hides a queued order before its remote representation is loaded.
- Cancellation or repeated status updates apply inventory restoration more than once.

## Verification scenarios

Choose the scenarios affected by the change and report which were actually run:

- add the same variant/modifier combination twice;
- add the same item with different modifiers;
- edit quantity, modifiers, and notes;
- reject invalid quantity, price, order type, or subtotal;
- place an online order;
- place an offline order and restart the app;
- reconnect and sync once;
- simulate a retryable failure and a fifth failure;
- complete with cash and GCash;
- cancel an open order and confirm inventory restoration;
- confirm queued and remote order displays do not overlap incorrectly.
