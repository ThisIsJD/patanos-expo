# P0.3 POS Workflow and UI Blueprint

Date: 2026-10-05. Tasks: P0-07/P0-08. Status: **Owner reviewed and approved the design; P0-07 complete**. Not implemented screens or a passed usability test. [Living tracker](../implementationPlan.md).

## Operating flow

Both roles land on POS after their permissions resolve. The cashier/barista takes a verbal order, records payment immediately or saves unpaid, prepares it, and verbally hands it over. No kitchen screen or printer is required. Owner tools are secondary.

```text
POS -> choose product/size -> optional extras -> cart
                                               |-> Pay & Complete -> saved paid sale
                                               |-> Save Unpaid -> Open orders -> Pay
Paid sale -> owner refund; unpaid order -> cancel with stock disposition
Every accepted action -> durable local record -> sync/needs-attention state
```

This is the target workflow for P1-P6. The current app queues order creation offline; it does not yet implement the complete offline paid-sale path shown here.

## Theme, navigation, and layout rules

- Keep Electric Mango: `COLORS.bgPrimary/bgCard`, `accentGold`, `textPrimary`, `textOnGold`; DM Sans for operational text, Permanent Marker for branding only. Use the existing spacing/radius tokens.
- Primary navigation: **POS**, **Orders**, **Shift**. Sync state is always accessible. Owner Tools appears only for the owner; UI visibility never replaces server permission checks.
- Map Counter to existing `dine-in`, Takeout to `takeout`, Delivery to `delivery`. Default to Counter, with visible selection. No mandatory customer details for a normal counter sale.
- Phone: scrolling menu, compact sticky cart footer, full-height cart/payment sheets. Tablet landscape: menu left, persistent cart right, centered bounded dialogs. Tablet portrait/narrow split-screen falls back to the phone-style cart sheet if measured space cannot fit both panels.
- Measure available width, not a device name. Qualify the existing 768-dp threshold in P5 instead of assuming it fits every keyboard/font/orientation. Keep state across rotation; do not remount or reset a payment/cart.
- Use at least 48-dp touch targets, separated destructive controls, labelled icons, TalkBack order/total announcements, text plus icons for statuses, and non-color error cues. Scale text without clipping primary actions. Test contrast; `textMuted` must not be assumed suitable for essential labels.
- Keep bottom actions above system insets and keyboard. Long lists scroll independently from pinned totals/actions. A visible Back/Close action and Android Back must behave consistently.

## 1. POS and search

```text
PHONE                             TABLET LANDSCAPE
+---------------------------+     +----------------------------------------------+
| POS  Cashier  Offline (2)  |     | POS  Cashier  Shift open       Offline (2)   |
| Search products... [clear] |     | Search... [clear]       | CART              |
| All Milk tea Pizza Meals  |     | Category chips          | Counter v         |
| Okinawa   Matcha          |     | Product grid            | Okinawa 16 oz  39 |
| from 29   from 29         |     |                         | [-] 1 [+] Edit    |
| Pizza     Sold out        |     | Visible stock labels    | Total PHP 39      |
| ...scroll...              |     |                         | Pay & Complete    |
| Cart (1) PHP 39 [Checkout] |     | POS Orders Shift        | Save Unpaid       |
+---------------------------+     +----------------------------------------------+
```

Search across product/flavor names and category, keeping a clear action and useful no-results state. A product card shows **from** when it has multiple prices; never show an arbitrary variant price as the whole product's price. Availability is variant-specific. Product images are optional; offline/text-only cards remain usable.

Quick-add only when one available variant and no unresolved required choice exists. Otherwise open one combined size/extras sheet. A configurable owner-approved default may reduce taps, but must be visibly selected and must not silently choose a required extra. Current synthetic milk fixtures have a required group: they must not be mistaken for a quick-add case.

## 2. Size, modifiers, and the pizza bundle

```text
PHONE SHEET                       TABLET DIALOG (menu/cart remain behind it)
+---------------------------+     +---------------------------------------+
| Back       Okinawa        |     | Okinawa                     Close     |
| 12 oz 29 [16 oz 39] 22 49  |     | 12 oz 29  [16 oz 39]  22 oz 49         |
| Extras: Pearl +10 [ ]      |     | Extras [Pearl +10]                    |
| Note: less ice            |     | Note: less ice    Qty [-] 1 [+]       |
| Quantity [-] 1 [+]         |     | Unit PHP 49       [Add PHP 49]        |
| Unit PHP 49 [Add PHP 49]   |     +---------------------------------------+
+---------------------------+
```

Show required choices and selection limits inline. Preserve selected variant, notes, quantities and extras while editing; cancel an edit without changing the cart. Explain price changes before committing. Unavailable options are labelled and disabled, not silently removed from a saved selection.

Approved scope addition: **three mini pizzas for PHP 99**, mixed or same flavor. Show three flavor slots and per-flavor available portions, e.g. Hawaiian / Pepperoni / Hawaiian. Add stays disabled until exactly three available portions are selected. A second bundle consumes another three portions. Standalone pizzas remain PHP 39 each. Show bundle price directly, not a cashier-entered discount. Initial bundle refunds are whole-bundle only; individual flavor substitutions/refunds require a later explicit policy decision. The server validates bundle composition and fixed catalog price.

## 3. Cart and saved-unpaid action

```text
PHONE FULL SHEET                  TABLET RIGHT PANEL
+---------------------------+     +------------------------------+
| Back          CART        |     | CART         Counter v       |
| Counter / Takeout / Deliv.|     | Okinawa 16 oz + pearl   49   |
| Okinawa 16 oz + pearl 49  |     | less ice [-] 1 [+] Edit      |
| less ice [-] 1 [+] Edit   |     | 3 Pizza Bundle          99   |
| 3 Pizza Bundle        99 |     | H / P / H      [-] 1 [+]     |
| H / P / H   [-] 1 [+]     |     | Note (optional)              |
| Note (optional)           |     | Total PHP 148                |
| Total PHP 148             |     | [Pay & Complete]             |
| [Pay & Complete]          |     | [Save Unpaid]                |
| [Save Unpaid]             |     +------------------------------+
+---------------------------+
```

Edit/remove applies to the selected line only. Lines with different notes/selections stay distinct. Clear Cart requires confirmation; remove one line may offer safe undo. Save Unpaid persists before clearing the cart, shows a stable order reference, and reserves portions once. Delivery/takeout notes are optional operational text; do not require or log unnecessary customer identifiers.

## 4. Quick payment and confirmation

```text
PHONE KEYBOARD-SAFE SHEET         TABLET DIALOG
+---------------------------+     +-----------------------------------------+
| Back   Total PHP 148      |     | Total PHP 148               Close       |
| [Cash]  GCash             |     | [Cash] GCash                            |
| Tendered: [200.00]        |     | Tendered [200.00]  Change PHP 52         |
| Exact / 200 / 500         |     | Exact / 200 / 500                       |
| Change PHP 52            |     | [Collect & Save PHP 148]                |
| [Collect & Save PHP 148]  |     +-----------------------------------------+
| ...numeric keyboard...   |
+---------------------------+
```

Cash is the default. Offer Exact and sensible nearby tender presets; reject insufficient/invalid tender before submission. The final action names the amount. Disable repeated submission while saving; retain the cart and explain failure if persistence fails. Show success only after a durable record exists. Confirmation shows reference, amount, tender/change and **Paid - pending sync** when applicable, with New Order as the primary next step. No mandatory receipt-print or extra success acknowledgement.

GCash: staff manually checks the owner-approved evidence and explicitly confirms receipt; show **Manually recorded**, never System verified. Reference is optional unless the owner requires it. It contributes nothing to drawer cash. Offline GCash handling is a P2/P3 policy decision: until qualified, disable it with an explanation rather than promise verification. Offline cash remains required.

## 5. Open and paid orders

```text
PHONE                             TABLET
+---------------------------+     +--------------------------------------------+
| Orders  Open / Paid       |     | Orders Open/Paid Search                    |
| Search reference...       |     | #A12 Unpaid 148  | #A12 Details             |
| #A12 Unpaid PHP 148       |     | #A13 Paid 39     | Lines, type, notes       |
| Pending sync  Owner      |     | ...scroll...     | Saved by / payment       |
| [Pay] [Details]           |     |                  | [Pay] [Cancel unpaid]   |
+---------------------------+     +--------------------------------------------+
```

Include saved unpaid orders across midnight; separate payment state from sync state. Stable identity merges local/remote rows. Unpaid cancellation asks reason and **Unprepared / Prepared or unknown** disposition; default unknown to no sellable restock. Paid orders expose owner-only refund, not Cancel/Delete. Refunds retain original sale and linked reason, method and restock disposition. Cashiers see a permission explanation, not an unauthorized write attempt presented as success.

## 6. Sync problems and recovery

```text
PHONE                             TABLET
+---------------------------+     +----------------------------------------------+
| Sync: 2 pending, 1 issue  |     | Sync 2 pending, 1 needs attention             |
| #A12 Paid locally PHP148 |     | Pending list | #A12 durable paid record       |
| Auth expired - reconnect |     | Issue list   | Reason, attempts, last try     |
| [Retry when online]      |     |              | [Safe retry] [Owner review]    |
| [Ask owner]              |     +----------------------------------------------+
| Never clear app data     |
+---------------------------+
```

Offline is informational, not a modal on every sale. Distinguish waiting for connection, syncing, acknowledged, and needs attention. Five failed attempts retain the sale/payment in history. Safe retry reuses identities; do not create another sale. Authentication/price/stock conflicts have specific explanations. Never suggest uninstalling or clearing data for recovery. Expired offline permission locks new protected actions while preserving already recorded transactions for authorized recovery.

## 7. Shift and handover

```text
PHONE                             TABLET
+---------------------------+     +------------------------------------------+
| Shift: Family cashier A  |     | Shift summary       | Opening/close form |
| Float 500 Cash sales 148 |     | Expected cash 648   | Counted [648.00]   |
| Expected drawer 648      |     | GCash separate      | Difference 0       |
| Counted [648.00]          |     | Pending 2           | Reason if different |
| [Handover] [Close]        |     |                     | [Handover] [Close] |
+---------------------------+     +------------------------------------------+
```

Opening requires amount and staff identity. Same-device handover uses separate locally authorized accounts and counted cash, preserving the outgoing actor on unsynced sales. Changing phone/tablet requires sync/reconciliation and explicit active-device transfer. Block hardware transfer during unresolved outage; show manual fallback guidance. Never equate changing login with transferring a cash drawer or erase pending records on logout.

## 8. Owner tools

```text
PHONE                             TABLET
+---------------------------+     +-----------------------------------------+
| Owner tools  [Back to POS]|     | Owner tools | Selected tool             |
| Stock counts / movements |     | Stock       | Counts, reasons, history   |
| Menu / portions / bundles|     | Menu        | Product / variant editor   |
| Staff / device access    |     | Staff       | Authorized account actions |
| Refunds / reconciliation |     | Reports     | Cash / GCash reconciliation|
| Reports / settings       |     | [POS]       |                           |
+---------------------------+     +-----------------------------------------+
```

Stock and daily corrections precede gallery/content management. Stock count changes need reason and safe conflict handling; a count cannot overwrite intervening sales. Owner account still starts at POS. No printer, ingredient recipe, advertising or reporting dashboard interrupts normal order entry.

## Required non-happy states

| State | Required behavior |
| --- | --- |
| Initial load / empty catalog | Loading placeholder; distinguish truly empty from failed fetch. Explain online first enrollment. |
| Offline cached menu | Show cache age/authorization eligibility; usable text/image fallback, known stock versus unknown stock. |
| Network or role error | Inline explanation and safe retry; never expose owner tools before roles resolve. |
| Sold out / unavailable extra | Label disabled choice; no accidental sale via search or bundle composition. |
| Saving / low storage | Prevent duplicate tap; no success/cart clearing on failed durable write. |
| Large text / TalkBack | Read amount and states clearly; visible labels; no inaccessible clipped footer. |
| Keyboard / Android Back | Preserve edits; dismiss keyboard/sheet predictably; never lose a committed payment. |
| Orientation / resume | Same cart, draft, selection and save identity; no duplicate action or reset. |

## Implementation ownership and sequencing

| Area | Existing boundary / future responsibility |
| --- | --- |
| POS/search | `app/(pos)/order.jsx` orchestrates; `src/components/pos/MenuGrid.jsx` and feature-local search UI present catalog. |
| Selection/cart | Existing `ModifierPicker.jsx`, `CartPanel.jsx`; cart context/domain helpers own identity and exact pricing. Bundle UI cannot calculate authoritative prices independently. |
| Payment/orders | POS feature components and order hooks call P2/P3 durable operations; no financial writes inside generic presentation controls. |
| Sync | Shared local/outbox coordinator and POS recovery UI; one sync owner, not each screen's independent processor. |
| Shifts/tools | Router screens orchestrate feature UI; authorized domain operations and Supabase boundaries remain outside presentation. |
| Permissions/stock | P1/P2/P4 contract first, P5 integrates these wireframes, P6 delivers shift/refund lifecycle. |

## Owner approval and device evidence

On 2026-10-05 the owner reviewed this file and explicitly replied, "Done reviewing, I approve," covering the immediate/unpaid payment, bundle, sync, shift and owner-tools designs. P0-07 is checked for design/review completion only. Device performance, actual menu confirmation and P5 usability acceptance remain separate requirements; no redesigned screen is claimed implemented.

Phone: owner-confirmed `SM-A156E/DSN`, Android 16. Tablet: not selected. Actual menu draft and uncertainties: [menu capture](menu-capture.md). Scenario expectations: [acceptance matrix](../specifications/cafe-acceptance.md).

Proposed usability targets (not measured/approved yet): no intervening admin dashboard; single selection surface; immediate checkout without opening Orders; no printer requirement; at most one final financial confirmation. Record actual taps and timings on the phone/tablet with the confirmed catalog. No desktop timing is evidence of device performance.
