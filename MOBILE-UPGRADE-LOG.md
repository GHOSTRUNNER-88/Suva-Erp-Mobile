# Mobile Upgrade Log

**Started:** 2026-08-31. Scope: the full mobile-app audit/upgrade task (see the
session that created this file for the exact brief — home nav cleanup, shared
UI foundation, Sale/Purchase form upgrades, list upgrades, Parties area,
Cash/Bank + Payment In/Out, Items stock, dashboard aggregate, Purchase PDF,
org switching, Deals fields). This log exists because the session context-
switched to a separate, larger task (desktop signup/organization-wizard
rebuild) right after the ground-truth audit landed — read this before
resuming, don't re-audit from scratch.

## 0. Ground truth (from a background Explore agent, verified against source)

Full detail was reported inline in that session; the load-bearing facts:

- Router is `expo-router`, every `app/**/*.js` is a 2-line re-export of a
  `screens/*.js` component — edit the `screens/` file, not the route file.
- `lib/api.js` has exactly two functions (`apiFetch`, `downloadDocumentPdf`)
  — no per-endpoint wrapper layer. Every screen calls `apiFetch("/api/...")`
  with a literal path.
- **Every mobile `apiFetch` call already has a matching backend route** —
  zero orphaned calls either direction. The "missing API" work in this task
  is genuinely new endpoints (Parties detail/create, Bank Accounts, Payment
  In/Out, Purchase Bill PDF, dashboard aggregate, org switch), not fixing
  broken wiring.
- Confirmed bugs/gaps (all still open as of this log):
  - `HomeScreen.js`'s `QUICK_LINKS` (line ~16): `addTxn` is still
    `comingSoon: true` despite real create-sale/purchase/expense/deal/item
    screens existing. `txnSettings` has no real backend equivalent, that
    stub is legitimate. `ItemsScreen.js` has the same pattern for
    `onlineStore`/`stockSummary`/`itemSettings`/`showAll`.
  - `components/LineItemsEditor.js:59` — **real bug**: `rate: ... ?
    String(selected.sellingPrice ?? 0) : line.rate` always defaults from
    `sellingPrice`, never `purchasePrice`, regardless of whether it's
    rendered inside Create Sale or Create Purchase. `CreatePurchaseScreen.js`
    passes no mode/priceField prop to distinguish context. Fix: add a
    `pricingField="sellingPrice"|"purchasePrice"` prop.
  - Same component exposes only item/qty/rate — `unitId` is silently
    auto-set with no picker, `discType`/`discValue` are hardcoded
    (`percent`/`"0"`) with no UI, `variantId` is deliberately omitted
    (documented, real sub-feature).
  - No BS/AD date picker exists anywhere on mobile (confirmed by grep) —
    **now partially fixed this session**: `lib/bs-ad.js` was ported from
    `starterkit/shared/date/bs-ad.ts` (same `@sajanm/nepali-functions`
    engine, added as a dependency — pure JS, no native deps, safe in Expo).
    A `DateField` UI component consuming it was NOT finished — see §2.
  - Sales PDF sharing is real (`SaleDetailScreen.js` + `/api/mobile/
    sales-invoices/[id]/pdf`); **Purchase Bill has no PDF at all**, neither
    a share button in `PurchaseDetailScreen.js` nor a backend
    `/api/mobile/purchase-bills/[id]/pdf` route. Mirror the sales one
    exactly (same Handlebars/`renderTemplatePdf` pipeline).
  - Organization switching: backend `switchOrganization()` exists
    (`shared/organizations/service.ts:334`), zero mobile UI. Only build
    this for real multi-org users (check `session.organizations?.length > 1`
    from `/api/mobile/session` — extend that route if it doesn't already
    return the list of orgs the user belongs to).
  - Items list (`GET /api/items` → `shared/items/service.ts` `listItems()`)
    does not join the per-warehouse `inventories` table — no stock
    quantity anywhere. Needs a real backend join (new query or a
    `?includeStock=true` param), not a client guess.
  - No dedicated Parties screen exists at all — Home's "Party Details" tab
    is read-only, no detail nav, no create. `POST /api/parties` exists on
    the backend but no mobile screen calls it.
  - Bank Accounts / Payment In / Payment Out: pure `comingSoon` stub in
    `MenuScreen.js`, no screen file, no backend route at all under
    `app/api/mobile/**`.
  - Dashboard: total-sale + item/party counts only, all computed
    client-side from full list responses (no aggregate endpoint). No
    trend/receivables/payables/expenses/low-stock data.
  - Deal creation form (`CreateDealScreen.js`) omits `assignedToUserId`
    (no assignable-users endpoint exists), `expectedClosingDate` (blocked
    on the missing date picker — now unblocked, see §2), and `isPrivate`.

## 1. Shared UI foundation — IN PROGRESS, not finished

New directory `components/ui/` (8px-radius, restrained-shadow, 44px
touch-target design direction — a deliberate departure from the existing
screens' heavier 15px-radius/shadow "iBank kit" look; new/touched screens
should move to this, don't blanket-restyle untouched screens just for it):

**Done, written this session:**
- `components/ui/ScreenHeader.js` — back button + title + optional right
  slot, replaces the header block copy-pasted at the top of every screen.
- `components/ui/Button.js` — `Button` (primary/secondary/ghost/danger,
  loading state) + `IconButton` (44x44 bare icon button).
- `components/ui/StatusBadge.js` — wraps the existing `lib/statusColor.js`.
- `components/ui/ListStates.js` — `SkeletonBlock`, `SkeletonListRow`,
  `SkeletonList`, `ErrorState` (with retry), `EmptyState` (with optional
  action button).
- `lib/bs-ad.js` — plain-JS port of `starterkit/shared/date/bs-ad.ts`
  (see above).

**NOT yet built — do these next, in this order:**
1. `components/ui/MoneySummary.js` — label/value rows + a strong-hierarchy
   grand-total/due row, for Sale/Purchase/Expense detail and create
   screens' totals block. Mirror `formatNpr` from `lib/format.js`, never
   recompute totals — display only.
2. `components/ui/FormField.js` — labeled `TextInput` wrapper with error
   text, consistent border/radius/focus state, 44px min height.
3. `components/ui/DateField.js` — BS-first date picker consuming
   `lib/bs-ad.js`: show both BS and AD, tap opens a modal with a simple
   year/month stepper (reuse `PickerField`-style option lists for year/
   month, generated from `getBsMinMaxYear()`/`BS_MONTH_NAMES_EN`/`_NE`) and
   a day grid sized by `getBsDaysInMonth()`. Selecting a day computes AD
   via `isoBsToIsoAd()` and calls `onChange(isoAd)`. This unblocks Sale/
   Purchase/Expense date fields (currently plain `todayIso()`, AD-only)
   and Deal's `expectedClosingDate`.
4. `components/ui/StickyActionBar.js` — bottom action bar wrapper: solid
   background, thin top border (`colors.border`), safe-area bottom inset,
   no gradient. Used by every create/edit form's Save/Cancel row.
5. `components/ui/ConfirmDialog.js` — simple Yes/Cancel modal (delete
   confirmations, destructive actions).
6. `components/ui/Toast.js` — a small `ToastProvider` + `useToast()`/
   `showToast()` for success/error feedback banners, mounted once in
   `app/_layout.js`.
7. `components/ui/SearchToolbar.js` + `components/ui/FilterSheet.js` — a
   search input + filter/sort trigger row, and a bottom-sheet Modal for
   per-screen filter fields (children render prop, Apply/Reset footer).
   Configure per-screen per the task's filter-field table (Sales: date
   range/customer/status/payment-status/warehouse/amount/sort; Purchases:
   mirror; Expenses: date range/category/payment account/amount; Deals:
   stage/lead source/assigned user/closing date/value; Items: category/
   unit/active/warehouse/stock state; Parties: type/status/balance/name).
8. `components/ui/ListRow.js` — generic list-row card (title, subtitle,
   right-aligned meta/badge) to replace the repeated `card`/`cardHeaderRow`/
   `partyName`/`badge` style blocks duplicated across HomeScreen,
   SaleListScreen, PurchaseListScreen, ExpensesListScreen, DealsListScreen.

## 2. Everything else in the original 13-priority list

**Not started.** In priority order once §1 is finished:
- Wire real routes into Home ("Add Txn" → an action-sheet Modal linking to
  New Sale/Purchase/Expense/Deal/Item; keep the FAB as the fast-path to
  Sale). Fix Items screen's dead quick-links the same way (point at real
  screens where one exists, e.g. "Show All" already has a real list).
- Fix `LineItemsEditor`'s pricing-field bug + add unit/discount-value/
  discount-type UI (variant stays out of scope, matches desktop's own
  "not attempted" note for the same reason — real sub-feature).
- Rebuild Create Sale/Purchase with `DateField`, the fixed `LineItemsEditor`,
  credit term + payment/received/bank-account controls (check whether
  `/api/mobile/warehouses` response or a new endpoint needs to expose
  credit terms and bank accounts — likely needs new mobile routes mirroring
  desktop's `creditTerms`/`bankAccounts` picker data, reusing
  `shared/business-settings/service.ts` / `shared/bank-accounts/service.ts`
  the same way `warehouses`/`units`/`item-categories` routes already do).
- List screen upgrades (pull-to-refresh via `RefreshControl`, focus-refresh
  via `useFocusEffect`, the new `SearchToolbar`/`FilterSheet`, pagination if
  the underlying list endpoints support `?page=`/`?cursor=` — check each
  service function's signature before assuming, add params only where the
  service already supports them, otherwise that's a backend change too).
- New Parties area (list/detail/create/edit) — `GET /api/parties` already
  lists, `POST /api/parties` already creates; a detail/edit screen may need
  a new `GET/PATCH /api/parties/[id]` mobile-facing route if one doesn't
  exist yet under `app/api/mobile/**` (check `app/api/parties/[id]/route.ts`
  on desktop first — it likely already exists for the desktop UI and can be
  reused directly, same pattern as `sales-invoices/[id]`).
- Cash/Bank + Payment In/Out — new `app/api/mobile/bank-accounts/**` and
  `app/api/mobile/payments/**` routes on the backend, reusing
  `shared/bank-accounts/service.ts` and `shared/payments/service.ts`
  (`paymentType` param distinguishes in/out, same as desktop), then real
  mobile screens.
- Items: add a real warehouse-stock join to `listItems()` (or a parallel
  `listItemsWithStock()`) and a real Item Detail screen showing it +
  low-stock flag (needs a real reorder-level field — check the schema
  before fabricating a "low stock" threshold, same caution as the desktop
  data-list work earlier this session).
- Dashboard: a real aggregate endpoint (`GET /api/mobile/dashboard` or
  similar) computing trend/receivables/payables/expenses/low-stock
  server-side — never client-reduce a full list for this again.
- Purchase Bill PDF — mirror `sales-invoices/[id]/pdf/route.ts` exactly,
  wire a share button into `PurchaseDetailScreen.js`.
- Organization switching — only if `/api/mobile/session` reports >1 org;
  extend that route first if it doesn't already return the membership list.
- Deals: add `expectedClosingDate` now that `DateField` exists; adding
  `assignedToUserId` needs a new assignable-users list endpoint (check
  desktop's own deal-assignment picker for what it already calls);
  `isPrivate` is a simple boolean toggle, no new endpoint needed.

## 3. Rules to not re-litigate

- Plain JavaScript only, no TypeScript/.tsx — this app was never converted
  and stays that way.
- Never recompute authoritative totals/tax/stock/balances on mobile —
  display-only, server is truth (`../AGENTS.md` §5, restated in this app's
  own `AGENTS.md`).
- New backend endpoints go under `starterkit/app/api/mobile/**`, reusing
  existing `shared/*/service.ts` functions — never duplicate business logic.
- Every new string needs EN+NE in `i18n/resources.js`, same key structure
  as `starterkit/shared/i18n/resources.ts` wherever an equivalent namespace
  already exists there.
- `SafeAreaView` from `react-native-safe-area-context`, never the built-in
  react-native one.
- No signup screen — explicit standing instruction, don't add one.
