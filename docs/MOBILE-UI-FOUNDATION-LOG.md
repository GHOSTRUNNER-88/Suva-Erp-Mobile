# Mobile UI Foundation — Session Log (2026-08-31)

Scope: finish `components/ui/` (MOBILE-UPGRADE-LOG.md §1's remaining
numbered list), fix the two confirmed `LineItemsEditor.js` bugs (§0), and
fix the dead "Coming Soon" quick-links on Home/Items (§2's first bullet).
Read `../AGENTS.md`, `../../AGENTS.md`, and `../MOBILE-UPGRADE-LOG.md` in
full before starting, per the task brief — not re-audited from scratch.

**Note on concurrency**: other background agents were actively editing this
same codebase during this session (i18n/resources.js gained `parties`/
`cashBank` namespaces; `shared/items/service.ts` gained category-delete
logic; `ItemsScreen.js` was rebuilt with a real `/api/mobile/items` stock
join, a real Item Detail screen, and a real Stock Summary screen). Files
were re-read immediately before each edit in this pass to avoid clobbering
that concurrent work — no conflicts found; all edits below merged cleanly.

## Part A — `components/ui/` (9 new files)

All follow the established pattern from the already-built files (8px
radius, restrained borders instead of heavy shadows, 44px+ touch targets,
`theme/colors.js` + `theme/typography.js`, no new hardcoded colors):

1. **`components/ui/MoneySummary.js`** — `rows` (array of `{label, value}`,
   formatted via `formatNpr` unless `formatted` is given), plus
   `totalLabel`/`totalValue` (strong final row) and optional
   `dueLabel`/`dueValue` (danger-colored row below total). Display only —
   takes numbers as props, never computes anything.
2. **`components/ui/FormField.js`** — labeled `TextInput` wrapper, 44px+
   min height, focus border → `colors.primary`, error text below, supports
   `multiline`/`secureTextEntry`/`editable`.
3. **`components/ui/DateField.js`** — BS-first date picker. `value`/
   `onChange` are always AD ISO strings; BS is only ever the picker UI
   (`../../AGENTS.md` §4). Closed field shows `"YYYY-MM-DD BS · YYYY-MM-DD
   AD"` (via `lib/bs-ad.js`'s `toIso()`). Modal has year/month prev-next
   steppers (clamped to `getBsMinMaxYear()`, month names from
   `BS_MONTH_NAMES_EN`/`_NE` chosen by `i18n.language`) and a day grid sized
   by `getBsDaysInMonth(year, month)` (wrapped in try/catch, falls back to
   30 — never assumes a fixed day count). A "Today" button calls
   `todayIsoAd()` directly. An invalid/missing `value` falls back to today
   for display without silently calling `onChange`.
4. **`components/ui/StickyActionBar.js`** — bottom action row, solid
   `colors.cardBg`, `borderTopWidth:1`/`colors.border`, safe-area bottom
   inset via `useSafeAreaInsets()`. Deliberately normal flex-flow (not
   `position:absolute`) — meant to be the last child of a flex:1 column
   (scroll content above, bar below), so it never overlaps the keyboard.
5. **`components/ui/ConfirmDialog.js`** — Yes/Cancel modal, `destructive`
   prop renders the confirm button in `colors.danger`.
6. **`components/ui/Toast.js`** — `ToastProvider` (context + one
   `Animated.View` banner sliding from the top, auto-dismiss 2.5s) +
   `useToast()` → `{ showToast(message, "success"|"error"|"info") }`. Wired
   into `app/_layout.js` (see Part C below).
7. **`components/ui/SearchToolbar.js`** — search input + optional filter/
   sort `IconButton`s, single row, 44px controls.
8. **`components/ui/FilterSheet.js`** — bottom-sheet Modal chrome only
   (`children` is fully caller-defined), Apply/Reset footer. Caller owns
   the filter state and what Apply/Reset actually do.
9. **`components/ui/ListRow.js`** — generic list-row card (title/subtitle
   left, meta text + badge slot right), thin border + 8px radius. Intended
   to replace the repeated `card`/`cardHeaderRow`/`partyName`/`badge` style
   blocks in HomeScreen/SaleListScreen/PurchaseListScreen/
   ExpensesListScreen/DealsListScreen — **not wired into those screens in
   this pass** (explicitly out of scope per the task brief: "do NOT edit
   those screens yourself — that's other agents' work").

**i18n**: added to `common.*` in both `en`/`ne` in `i18n/resources.js`:
`searchPlaceholder`, `filter`, `sort`, `apply`, `reset`, `close`, `today`,
`confirm`, `selectDate`, plus two keys `ListStates.js` already referenced
via `defaultValue` but that were never actually added —
`somethingWentWrong`, `retry` (filled in as a drive-by fix since they were
missing from both languages). Verified programmatically after the pass:
`en` and `ne` translation trees now have exactly 328 keys each, zero
one-sided keys either direction.

## Part B — `LineItemsEditor.js` bug fixes

1. **Pricing bug (fixed)**: added a `priceField` prop (default
   `"sellingPrice"`), used as `String(selected[priceField] ?? 0)` instead
   of the hardcoded `selected.sellingPrice`. Callers updated:
   - `screens/CreateSaleScreen.js` → `priceField="sellingPrice"`
   - `screens/CreatePurchaseScreen.js` → `priceField="purchasePrice"`
2. **Missing unit/discount UI (fixed)**:
   - **Unit picker**: checked what `GET /api/items` actually returned —
     `shared/items/service.ts`'s `listItems()` only selected
     `primaryUnitId`/`primaryUnitName` (no secondary unit at all), even
     though desktop's `document-form.tsx` expects
     `primaryUnitId`/`primaryUnitCode`/`secondaryUnitId`/`secondaryUnitCode`
     per item to build its own unit dropdown (confirmed by reading that
     file directly). Extended `listItems()` in
     `../vyzor-nextjs-ts-approuter/starterkit/shared/items/service.ts` to
     also select `primaryUnitCode`, `secondaryUnitId`, `secondaryUnitName`,
     `secondaryUnitCode`, and `conversionFactor`, via a second aliased join
     on `units` (same `alias()` pattern already used elsewhere in the same
     file, e.g. `getProductLedger`). This is additive/backward-compatible
     — `GET /api/items` is a thin pass-through
     (`app/api/items/route.ts`) consumed by both the desktop items list and
     mobile, and existing consumers just ignore new fields. Per
     `../AGENTS.md` §2 ("if mobile needs data that has no endpoint yet, add
     it in suva-erp first"). `LineItemsEditor.js`'s new `unitOptionsFor(line)`
     builds `[primary, secondary?]` from the selected item and renders it
     through the existing `PickerField` (label `items.unit`, reused —
     already bilingual) — never a full unit catalog, exactly the item's
     real available units.
   - **Discount UI**: added a per-line value `TextInput` (`discValue`) +
     a percent/amount toggle button (`discType`), mirroring the
     document-level toggle already in `CreateSaleScreen.js`/
     `CreatePurchaseScreen.js` and reusing the same existing i18n keys
     (`sale.discount`, `sale.discountPercent`, `sale.discountAmount`) — no
     new keys needed.
   - `variantId` stays omitted, unchanged — matches the existing documented
     decision (real sub-feature, out of scope).

Files touched: `components/LineItemsEditor.js`,
`screens/CreateSaleScreen.js`, `screens/CreatePurchaseScreen.js`,
`../vyzor-nextjs-ts-approuter/starterkit/shared/items/service.ts`.

## Part C — dead quick-links

1. **`screens/HomeScreen.js`** — `QUICK_LINKS`'s `addTxn` entry no longer
   routes to Coming Soon. Tapping it opens a real action-sheet `Modal`
   (`ADD_TXN_ACTIONS`) listing New Sale/Purchase/Expense/Deal/Item, each
   navigating to its existing real create screen
   (`/sales/new`, `/purchases/new`, `/expenses/new`, `/deals/new`,
   `/items/new`) and closing the sheet. Row labels reuse existing i18n
   keys (`sale.createTitle`, `purchase.createTitle`, `expenses.createTitle`,
   `crm.createTitle`, `items.createTitle`) — no new keys needed. `txnSettings`
   left as `comingSoon` (no backend feature to map it to — legitimate stub,
   confirmed against the audit). The FAB ("Add New Sale" → `/sales/new`)
   is unchanged. Updated the screen's stale top-of-file doc comment to
   match.
2. **`screens/ItemsScreen.js`** — found this screen had already been
   rebuilt by a concurrent agent this session (real `/api/mobile/items`
   stock join, real Item Detail screen, real Stock Summary screen wired to
   `stockSummary`). The one remaining dead stub was a separate "Show All"
   button that called `openComingSoon("items.showAll")` — dishonest,
   because this screen **is already** the full items list; there's no
   further "show all" destination to route to. Removed that button
   entirely rather than pointing it at a fake destination or at itself.
   `onlineStore`/`itemSettings` remain legitimate `comingSoon` stubs (no
   backend feature yet, per the audit).

## Verification

- `package.json` has no `lint`/`test` scripts (only `start`/`android`/
  `ios`/`web`) — nothing to run there.
- `npx expo-doctor` from `E:\SUVA\suva-erp-mobile`: **19/21 checks
  passed.** The 2 failures are both pre-existing and unrelated to this
  pass:
  - `@react-native-ml-kit/text-recognition` flagged "Untested on New
    Architecture" — already documented in `../AGENTS.md`'s Scan Receipt
    section as a known, accepted risk.
  - Patch-version drift on `expo`/`expo-constants`/`expo-font` (e.g.
    `expo` `57.0.17` installed vs `~57.0.18` expected) — pre-existing
    dependency lag, not introduced by any file touched here.
- Verified `i18n/resources.js` parses (loaded as a script and diffed
  `en`/`ne` key sets programmatically — see Part A) and every new key
  added in this pass exists in both languages.
- No TypeScript/test runner exists in this project, so every touched file
  was read back in full after editing to check balanced JSX tags, correct
  relative import paths, and no leftover unused imports:
  `components/ui/MoneySummary.js`, `FormField.js`, `DateField.js`,
  `StickyActionBar.js`, `ConfirmDialog.js`, `Toast.js`, `SearchToolbar.js`,
  `FilterSheet.js`, `ListRow.js`, `components/LineItemsEditor.js`,
  `screens/CreateSaleScreen.js`, `screens/CreatePurchaseScreen.js`,
  `screens/HomeScreen.js`, `screens/ItemsScreen.js`, `app/_layout.js`.
- **Could not verify visually** — no device/simulator available in this
  environment. Nothing in this log should be read as "confirmed working
  on-device"; it's confirmed syntactically sound and logically consistent
  with the existing codebase's own patterns only.
- `ListRow.js` exists and is ready to use but was **not** wired into any
  existing list screen — that was explicitly out of scope for this pass
  (other agents' work per the task brief).
