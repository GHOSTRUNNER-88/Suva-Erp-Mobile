# Mobile: Items Stock, Dashboard Aggregate, Purchase PDF, Deals Fields

**Date:** 2026-08-31. Scope: Part A (Items warehouse stock + item detail),
Part B (real Dashboard aggregate), Part C (Purchase Bill PDF), Part D (Deals
`expectedClosingDate` + `isPrivate`) from the upgrade task described in
`MOBILE-UPGRADE-LOG.md`. Ran alongside two other agents working on
`components/ui/**`/`LineItemsEditor.js`/Home+Items dead-links and a new
Parties/Cash-Bank/Payment area — did not touch their files; `app/_layout.js`
and `i18n/resources.js` were edited by all three in parallel and merged
cleanly (verified after each edit by re-reading the file and, for i18n, a
Node `require()` sanity check).

## Part A — Items: real warehouse stock + item detail screen

**Backend (`vyzor-nextjs-ts-approuter/starterkit`):**

- `shared/items/service.ts` — added three functions, all reusing the same
  `inventories` table and `SUM(quantity)` shape `listStock()`/
  `runLowStock()` (the desktop Low Stock report) already use:
  - `getItemStockTotals(organizationDb)` — `SUM(quantity)` grouped by
    `itemId`, across every warehouse/variant. Used for the Items list "In
    Stock" figure. A direct grouped query rather than reusing `listStock()`
    itself, which cross-joins every item x warehouse x variant combination
    in memory for desktop's per-variant stock-editing UI — correct there,
    wasteful for a total-only figure.
  - `getItemStockByWarehouse(organizationDb, itemId)` — per-warehouse
    `SUM(quantity)` for one item (0 when no `inventories` row exists yet,
    same convention as `listStock()`). Used for the item detail screen.
  - `countLowStockItems(organizationDb)` — same filter as
    `shared/reports/definitions/low-stock.ts`'s `runLowStock()`
    (`items.reorderLevel IS NOT NULL AND SUM(quantity) <= reorderLevel`),
    projected as a count instead of full rows, for the dashboard.
- **`items.reorderLevel`** is a real schema column (decimal, nullable, "Low-
  stock alert threshold, in the item's primary unit" per its own comment,
  `shared/db/schema/organization.ts:543`) — confirmed before building any
  low-stock UI. It's a single per-item threshold, not per-warehouse.
- New `GET /api/mobile/items` (`app/api/mobile/items/route.ts`) — wraps the
  existing `listItems()` (same function desktop's own items page, the
  top-level `GET /api/items`, and the public `GET /api/v1/items` developer
  surface all call) plus `getItemStockTotals()`, merged into a
  `stockQuantity` field per item. Added as a **new dedicated route** instead
  of changing `GET /api/items`'s shape in place — confirmed via research
  that `listItems()` has three other call sites (desktop's items page
  imports it directly; the public `/api/v1/items`), so a mobile-only field
  stays out of that shared contract entirely rather than risking it.
- New `GET /api/mobile/items/[id]` (`app/api/mobile/items/[id]/route.ts`) —
  wraps the existing `getItemDetail()` (same single-item lookup desktop's
  edit-item form uses) plus `getItemStockByWarehouse()`, and resolves
  category/unit **names** via the existing `listItemCategories()`/
  `listUnits()` functions (not by changing `getItemDetail()`'s own shape,
  which desktop's edit form doesn't need names for). Response includes
  `warehouseStock` (per-warehouse breakdown), `totalStock`, `reorderLevel`
  (`null` when unset), and `lowStock` (`true`/`false` only when
  `reorderLevel` is set, otherwise `null` — never fabricated).

**Mobile:**

- `screens/ItemsScreen.js` — now calls `/api/mobile/items`, shows a real
  "In Stock" figure per item (removed the old comment explaining why stock
  wasn't shown), and each card is now tappable through to the new item
  detail screen.
- `screens/ItemDetailScreen.js` (new) + `app/items/[id].js` (new) — item
  info, category, unit(s), both prices, total stock, low-stock badge (only
  when `lowStock === true`), reorder level (only when set), and the full
  per-warehouse breakdown.
- `screens/StockSummaryScreen.js` (new) + `app/items/stock-summary.js`
  (new) — the "Stock Summary" quick link (previously `comingSoon`) now
  shows the real item list sorted ascending by `stockQuantity`, reusing the
  same `GET /api/mobile/items` response (no new backend endpoint needed —
  sorting already-fetched real numbers is display-only, not a computed
  aggregate). "Online Store"/"Item Settings" quick links are untouched,
  still `comingSoon` (no backend for either).
- Both new routes registered in `app/_layout.js`'s `Stack.Protected` block.

## Part B — Real Dashboard aggregate

**Backend:** New `GET /api/mobile/dashboard` (`app/api/mobile/dashboard/
route.ts`) reuses `shared/dashboard/service.ts`'s `getDashboardSummary()` —
the exact function desktop's own Dashboard page calls — gated by the same
per-category `getCategoryPermissionFlags()` view flags (sales/purchase/
finance/cashBank/parties/items). Defaults to the `"thisMonth"` preset
(desktop's own default); accepts an optional `?preset=` for forward
compatibility with desktop's other four presets, falling back silently on
an invalid value.

Confirmed real vs. not before wiring anything:
- Sales/purchase current-vs-previous-period trend: **real**,
  `getDashboardSummary()`'s `sales`/`purchases` fields.
- Receivables due / payables due: **real**, `SUM(dueAmount)` across
  completed invoices/bills, all-time (point-in-time balance, not
  period-scoped — matches desktop's own reasoning, documented in that
  function's comment).
- Expenses this period: **real data, no pre-summed scalar** — desktop only
  exposes a per-category breakdown (`expenseCategoryReport`). Summed that
  real breakdown into `expensesThisPeriod` in the route rather than adding
  a new query.
- Low-stock count: **not part of `getDashboardSummary()` at all** — added
  via the new `countLowStockItems()` (Part A), gated by the same `items`
  access flag.
- Cash & bank balance, item/party counts: real, passed through unchanged.
- No month-over-month **chart** (a series over many periods) is built —
  only current-vs-previous scalar comparison, same as what
  `getDashboardSummary()` itself returns as `sales`/`purchases`
  `PeriodChange` objects (desktop does have a `trend: TrendPoint[]` array
  for a chart; not surfaced to mobile in this pass since there's no chart
  component here — noted as a gap, not fabricated).

**Mobile:** `screens/DashboardScreen.js` rewritten to call the single new
endpoint instead of `GET /api/items` + `GET /api/parties` +
`GET /api/mobile/sales-invoices` reduced client-side. Every field renders
conditionally on not being `null` (permission-gated fields never show a
fake zero).

## Part C — Purchase Bill PDF

**Backend:** New `GET /api/mobile/purchase-bills/[id]/pdf`
(`app/api/mobile/purchase-bills/[id]/pdf/route.ts`) — mirrors
`sales-invoices/[id]/pdf/route.ts` exactly (same `renderTemplatePdf`/
Handlebars pipeline, same `isoAdToBs` BS-date conversion, same auth guard
chain with `requireCategoryAction(session, "purchase", "view")`), sourced
from `getPurchaseBillDetail()`. Context-building logic is duplicated from
`purchase-bill-print-view.tsx`'s own Handlebars block, the same documented
duplication pattern the sales PDF route already uses against
`sales-invoice-print-view.tsx` — keep both pairs in sync if either changes.

Deltas from the sales-invoice version (all sourced from
`purchase-bill-print-view.tsx`'s own documented differences, confirmed by
reading that file): no `bankPrintOnInvoice` flag (bank visibility is
`Boolean(bill.bankName) && Number(bill.paidAmount) > 0` instead); no
`bankQrCodeUrl`; no per-line `hsCode` (always `""`); `isPaid`/`paidAmount`
instead of `isReceived`/`receivedAmount`; `supplierName`/`supplierAddress`
instead of `billingName`/`billingAddress`; `statusBadge` only non-empty for
`"cancelled"` (not "anything but completed"); `totals.inWords` always `""`
(purchase bills never compute a words-total).

**Mobile:** `screens/PurchaseDetailScreen.js` — added the same share-icon
pattern as `screens/SaleDetailScreen.js` (`downloadDocumentPdf` +
`expo-sharing`), replacing the previously-empty header spacer slot.

## Part D — Deals: `expectedClosingDate` + `isPrivate`

Confirmed both fields already exist on the backend `dealInputSchema`
(`shared/crm/schema.ts`) and that `POST /api/mobile/deals` passes the
parsed body straight to `createDeal()` with no field-stripping — **no
backend change needed**, UI-only wiring.

- `expectedClosingDate`: plain `"YYYY-MM-DD"` `TextInput` (validated with a
  regex before submit; sent as `null` when empty). `components/ui/
  DateField.js` (the real BS/AD picker per `MOBILE-UPGRADE-LOG.md`) did not
  exist yet at the time this was wired — flagged explicitly in the
  screen's own comment as a stopgap to upgrade once that component lands,
  per `../AGENTS.md` §4 (BS/AD everywhere).
- `isPrivate`: plain React Native `Switch` + a `switchRow` style, matching
  the existing `isVatApplicable`/`isReceived` toggle pattern in
  `CreateSaleScreen.js`/`CreateExpenseScreen.js` — no dedicated toggle
  component exists in `components/ui/` yet.
- `assignedToUserId` remains **out of scope** — still needs a new
  assignable-users list endpoint (not built by any agent this pass); no
  fake picker was built for it.

## i18n

Added English + Nepali keys in the same change for: `items.detailTitle`,
`items.notFound`, `items.priceSection`, `items.stockSection`,
`items.totalStock`, `items.byWarehouse`, `items.lowStock`,
`items.reorderLevel`; `dashboard.totalPurchase`, `dashboard.receivablesDue`,
`dashboard.payablesDue`, `dashboard.expensesThisPeriod`,
`dashboard.cashBankBalance`, `dashboard.lowStockCount`;
`crm.expectedClosingDate`, `crm.expectedClosingDatePlaceholder`,
`crm.expectedClosingDateInvalid`, `crm.isPrivate`.

## Verification

- `npx tsc --noEmit` in `starterkit`: **exit 0, no errors.**
- `npm run build` in `starterkit`: **compiled successfully.** One pre-
  existing Handlebars/webpack warning (`require.extensions is not
  supported by webpack`) now also appears for the new purchase-bills PDF
  route — this is the same warning the existing sales-invoices PDF route
  and `credit-note-print-view.tsx` already produce from importing
  `shared/printing/template-renderer.ts` → `handlebars`; not a regression,
  inherent to that library's usage pattern.
- Verified the new `i18n/resources.js` keys load correctly via a Node
  `require()` check after the file was also edited concurrently by the
  other two agents (parties/cashBank namespaces, `common.retry`/
  `somethingWentWrong`, etc.) — no corruption, all namespaces intact.
- Could not run the Expo app from this environment — every mobile file was
  read back in full after editing to check for syntax/JSX balance issues
  instead of visual verification.

## Files changed/added

**Backend (`vyzor-nextjs-ts-approuter/starterkit`):**
- `shared/items/service.ts` (edited — added `getItemStockTotals`,
  `getItemStockByWarehouse`, `countLowStockItems`, `isNotNull` import)
- `app/api/mobile/items/route.ts` (new)
- `app/api/mobile/items/[id]/route.ts` (new)
- `app/api/mobile/dashboard/route.ts` (new)
- `app/api/mobile/purchase-bills/[id]/pdf/route.ts` (new)

**Mobile (`suva-erp-mobile`):**
- `screens/ItemsScreen.js` (edited)
- `screens/ItemDetailScreen.js` (new)
- `screens/StockSummaryScreen.js` (new)
- `app/items/[id].js` (new)
- `app/items/stock-summary.js` (new)
- `screens/DashboardScreen.js` (rewritten)
- `screens/PurchaseDetailScreen.js` (edited)
- `screens/CreateDealScreen.js` (edited)
- `app/_layout.js` (edited — registered the two new items routes)
- `i18n/resources.js` (edited — new keys, en+ne)
