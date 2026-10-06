# Cafe Menu Capture for P0 Acceptance

Date: 2026-10-05. Source: owner-supplied [Patanos-Menu.jpg](../assets/Patanos-Menu.jpg), visually inspected. Owner now confirms prices/portions remain unchanged. Prices below are **owner-confirmed poster prices**, not imported or independently verified database catalog data. Currency: PHP.

## Catalog footprint

The poster shows **38 named product/flavor entries across nine sections**. Counting each standard size separately gives 88 clear single-item sellable choices, plus four fries price tiers and two siomai preparations: **94 candidate choices** if those are configured as variants. The approved pizza bundle is an additional product/selection flow, not 125 automatically generated flavor combinations.

| Section | Named products / flavors | Sizes and prices | Candidate choices |
| --- | --- | --- | ---: |
| Mini pizza | Hawaiian; Pepperoni; Ham & Cheese; Supreme; Beef & Mushroom | 4-inch round, 39 each | 5 |
| Milk tea | Okinawa; Red Velvet; Matcha; Dark Choco; Wintermelon; Taro; Cookies & Cream | 12 oz 29; 16 oz 39; 22 oz 49 | 21 |
| Shake | Mango Graham; Avocado Graham; Dark Chocolate | 12 oz 40; 16 oz 60; 22 oz 80 | 9 |
| Fruit soda | Blue Lemonade; Strawberry; Green Apple; Blueberry; Kiwi; Lychee | 12 oz 29; 16 oz 39; 22 oz 49 | 18 |
| Ice cream | Plain cup; Wafer cone; Chocolate; Strawberry; Caramel | Plain 20; cone 10; topped flavors 25 each; serving size not printed | 5 |
| Floats | Milo; Dutch Milk; Chuckie; Coke | First three: 12 oz 49 / 16 oz 59 / 22 oz 69. Coke: 12 oz 39 / 16 oz 49 / 22 oz 69 | 12 |
| Float fruit soda | Blue Lemonade; Strawberry; Lychee; Blueberry; Green Apple; Kiwi | 12 oz 39; 16 oz 49; 22 oz 59 | 18 |
| Fries | Fries, seasonings cheese / sour cream / salt | 25 / 50 / 75 / 100; portion labels unspecified | 4 provisional |
| Pork siomai | Pork siomai, fried or steamed | 5 for both preparations (owner confirms equal prices); confirm selling unit | 2 provisional |

Optional extras shown: milk tea pearl +10; fruit soda Yakult +15 and nata +10. Do not assume extras also apply to shakes/floats or that they are mandatory. Selection limits and extra portion tracking remain owner/catalog decisions before P2/P4 acceptance.

## Approved bundle scope addition

Owner explicitly chose inclusion on 2026-10-05: **three mini pizzas for PHP 99, mix or same flavor**, alongside PHP 39 standalone pizzas. This is one fixed-price bundle, not a general discounts engine.

- Exactly three flavor portions are required; repeated flavors are allowed if stock permits.
- Bundle quantity two consumes six portions; track each selected pizza flavor, not a fictitious bundle-only stock count.
- Record immutable parent price/composition and child portion snapshots. For the current equal-price three-pizza offer, proposed reporting allocation is PHP 33 per pizza (total 99); do not independently charge the children again.
- Server validates bundle definition, active catalog price and exactly three choices. Offline preserves the accepted catalog/composition; retries cannot consume them again.
- Initial refund unit is the whole bundle. No arbitrary per-pizza partial bundle refund without a separate approved allocation/refund policy.
- P2/P4/P5/P6 and acceptance tests must cover composition, repeats, sold-out flavors, price, stock effects and whole-bundle refund. This scope is recorded in the living plan; not implemented by transcription.

## Outstanding confirmations

- Current poster prices/portions: owner confirms unchanged on 2026-10-05. Any unpublished/off-menu meals or seasonal products remain separate catalog inputs.
- What are the fries portion labels/units for the four prices? Is seasoning a required single choice, and is there any extra charge?
- Is siomai PHP 5 **per piece**, with the same minimum quantity for both preparations?
- Confirm ice-cream portion sizes, extra limits/applicability and which variants should track portions.
- Current test run is phone-only: `SM-A156E/DSN`, Android 16 (owner-reported); performance is not measured. Tablet details are deferred until hardware is available for later tablet qualification, not required for the immediate phone APK check. Phone/tablet release design remains unchanged.

Use the confirmed catalog to configure synthetic staging data before UI load/stock acceptance. Current four-item local/staging seed is intentionally small; it is **not** the real-menu performance fixture. No exact performance claim should use that small seed as a substitute for this catalog.
