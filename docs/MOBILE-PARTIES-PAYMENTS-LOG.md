# Mobile Parties + Cash/Bank/Payments — Build Log

**Done:** 2026-08-31. Scope: real Parties area (list/detail/create/edit) and
real Cash/Bank + Payment In/Out, per the task brief in
`MOBILE-UPGRADE-LOG.md` §2. Ran in parallel with another session building
`components/ui/**` and fixing `LineItemsEditor.js`/Home/Items dead
quick-links — none of those files were touched here except the one
targeted change to `HomeScreen.js` called out below.

## Backend changes (`vyzor-nextjs-ts-approuter/starterkit`)

All three new routes follow the exact `requireApiUser → requireCompanyMembership
→ requireOrganizationAccess → requireCategoryAction` guard chain and
`{ok,data}`/`{ok,error}` envelope every other `app/api/mobile/**` route uses,
verified against `app/api/mobile/expenses/route.ts` and
`app/api/mobile/deals/[id]/route.ts` before writing them.

- **`app/api/mobile/parties/[id]/route.ts`** (new) — GET only. Category
  `"parties"`, action `"view"`. Calls `getPartyLedger(organizationDb, id)`
  from `shared/parties/service.ts` — the exact function desktop's
  `/parties/[id]` Server Component page calls — returning `{party, entries}`
  (profile header + full ledger with running balances), not the bare-fields
  shape `getPartyDetail()` returns. This is genuinely new capability: no
  bearer-token route previously exposed the ledger, only the desktop page
  called it directly.
  - `GET /api/parties/[id]` and `PATCH /api/parties/[id]` **already
    existed** (`app/api/parties/[id]/route.ts`) and already use the
    identical bearer-safe guard chain (`requireApiUser`), confirmed by
    reading the file — reused as-is for CreatePartyScreen's edit-mode
    prefill (GET, bare fields) and submit (PATCH). No mobile-specific
    duplicate was needed for those two.
  - `GET /api/party-groups` also already existed with the same guard
    chain — reused as-is for the party-group picker.
- **`app/api/mobile/bank-accounts/route.ts`** (new) — GET only. Category
  `"cashBank"` (matching desktop's bank-account Server Actions guard,
  confirmed by reading `shared/@spk-reusable-components/suva/bank-accounts/actions.ts`),
  action `"view"`. Calls `listBankAccountsWithBalance(organizationDb,
  activeOnly)` from `shared/bank-accounts/service.ts` — balance is always
  live-computed server-side from `bankTransactions`, never cached or
  recomputed on mobile. `?activeOnly=true|false` query param (default
  false, shows inactive accounts too, matching desktop's own list).
  No create/edit/delete route added — out of this pass's scope (list-only
  screen requested).
- **`app/api/mobile/payments/route.ts`** (new) — GET (list) + POST
  (create). Category `"finance"` (matching desktop's payments guard).
  - GET: `?type=in|out` required, 422 if missing/invalid. Calls
    `listPayments(organizationDb, type)`.
  - POST: body must include `paymentType: "in"|"out"` (validated
    separately since it's a positional service-function argument, not
    part of `paymentInputSchema`) plus the rest of `paymentInputSchema`
    (`paymentDate`, `partyId`, `bankAccountId`, `amount`, `notes`,
    `allocations`). Calls `createPayment(organizationDb, paymentType,
    input)` — ledger posting, `bankTransactions` row, receipt-number
    generation, and the Payment-In push notification all stay inside that
    function, never duplicated here.

All three compiled clean: `npx tsc --noEmit` in `starterkit` ran after all
three files were written, **exit code 0**, no new errors.

## Mobile changes (`suva-erp-mobile`)

### Parties

- `screens/PartiesListScreen.js` (new) + `app/parties/index.js` (new,
  thin re-export) — `GET /api/parties`, client-side search (name/phone/
  PAN/group/type, mirrors desktop's `getSearchText` fields) + a
  Customer/Supplier/Both/All filter chip row (desktop's own list has no
  type filter, only a group filter — this is a mobile-only addition since
  the task asked for one; it's pure client-side filtering, no new
  business logic). Balance sign convention matches `HomeScreen.js`
  exactly (`balance >= 0` → Dr). Pull-to-refresh + focus-refresh via
  `useFocusEffect`. FAB → `/parties/new`.
- `screens/PartyDetailScreen.js` (new) + `app/parties/[id].js` (new) —
  `GET /api/mobile/parties/[id]`, renders profile (name, type, phone, PAN,
  address, group, opening balance+type+date, credit limit) plus the full
  ledger (desktop's `PartyDetailView` + `PartyLedgerView` combined onto
  one screen). Ledger row labels (`salesInvoice`, `paymentIn`, etc.) go
  through a new `parties.ledgerLabels.*` i18n map rather than showing the
  raw enum string. Edit icon → `/parties/edit/[id]`.
- `screens/CreatePartyScreen.js` (new) + `app/parties/new.js` +
  `app/parties/edit/[id].js` (both new, thin re-exports) — one screen
  handles both modes (desktop's shared `party-form.tsx` does the same for
  its `PartyFormValues`). Field order mirrors desktop exactly: name, type
  (Customer/Supplier/Both chips), party group (`PickerField` over
  `GET /api/party-groups`), phone, PAN, address, opening balance + Dr/Cr
  toggle, opening balance date, credit limit. Create → `POST /api/parties`;
  edit → `PATCH /api/parties/[id]` (prefilled from `GET /api/parties/[id]`).
  **Intentionally omitted: `creditTermId`** — same reasoning as
  `CreateDealScreen.js` omitting `assignedToUserId`: no mobile-facing
  credit-terms list endpoint exists yet (desktop's picker reads
  `shared/business-settings` credit terms, not wired to any
  `app/api/mobile/**` route). The field defaults to `null` server-side, so
  create/update still succeed without it; still editable from desktop.
  Opening balance date is a plain text field defaulting to today's AD
  date (`YYYY-MM-DD`), no BS/AD picker — `components/ui/DateField.js`
  wasn't ready from the parallel session; same "retrofit later" allowance
  the task brief gave Payment In/Out.
- **Entry points wired**: `HomeScreen.js`'s "Party Details" tab rows were
  a bare `<View>` — changed to `<TouchableOpacity>` navigating to
  `/parties/${item.id}` (one targeted change, `QUICK_LINKS`/layout
  untouched, left to the parallel session owning that file).
  `MenuScreen.js`'s `MY_BUSINESS_ROWS` got a new `parties` row (icon
  `users`, href `/parties`) — desktop has a top-level Parties nav item and
  the feature needed *a* discoverable entry point beyond Home's tab;
  added `menu.parties` i18n key.

### Cash/Bank + Payments

- `screens/BankAccountsScreen.js` (new) + `app/bank-accounts/index.js`
  (new) — `GET /api/mobile/bank-accounts`, list with bank name/display
  name, active/inactive badge, live balance (red if negative). Read-only,
  no create/edit (matches the narrower brief scope — desktop bank-account
  create/edit stays desktop-only for this pass, same "admin surface" call
  as Module Store purchasing).
- `screens/PaymentsListScreen.js` (new) + `app/payments/index.js` (new) —
  one shared screen for both directions, keyed by a `type` route param
  (`in`/`out`), mirroring desktop's single `PaymentsView`/`PaymentForm`
  components parameterized by `paymentType` rather than two separate
  screens. `GET /api/mobile/payments?type=...`, shows receipt #, party,
  bank label, amount, date; summary card totals the list. FAB →
  `/payments/new?type=...`.
- `screens/CreatePaymentScreen.js` (new) + `app/payments/new.js` (new) —
  field order mirrors desktop's `payment-form.tsx`: date (auto today,
  AD-only, same date-picker allowance as above — not user-editable in
  this first pass since there's no date picker yet, kept simple rather
  than a raw unvalidated text field for a financial posting date), party
  (`PickerField`, optional/"on-account" allowed, matches
  `partyId: 0` default), bank account (`PickerField` over
  `?activeOnly=true`), amount, notes (labelled "Reference" in the UI —
  desktop's schema has no dedicated reference/cheque field, only free-text
  `notes`, confirmed by reading `shared/payments/schema.ts`). Party
  options are filtered exactly like desktop: Payment In excludes
  `type === "Supplier"`, Payment Out excludes `type === "Customer"`.
  **Intentionally omitted: invoice/bill allocation table** — desktop's
  optional per-document allocation UI is a real sub-feature on its own
  (same class of omission as `LineItemsEditor`'s variant field or Deal's
  `assignedToUserId`); every mobile payment posts as fully on-account
  (`allocations: []`), which `createPayment()` already treats as a
  complete, valid payment — desktop can allocate it afterward.
- **Entry points wired**: `MenuScreen.js`'s "Cash & Bank" section — the
  existing "Bank Accounts" row switched from `openComingSoon` to
  `router.push("/bank-accounts")`; two new rows added, "Payment In" →
  `/payments?type=in` and "Payment Out" → `/payments?type=out" (both
  needed to exist for the feature to be reachable at all — there was no
  existing row for either).

### i18n

Added two new namespaces to `i18n/resources.js`, **both `en` and `ne`** in
the same edit: `parties.*` (including a `ledgerLabels.*` sub-map for the
9 ledger entry types + 2 opening-balance variants) and `cashBank.*`.
Copy for every key that has a desktop equivalent (`partyName`, `typeCustomer/
Supplier/Both`, `phone`, `panNumber`, `address`, `openingBalance`,
`openingBalanceDate`, `creditLimit`+hint, `dr`/`cr`, `currentBalance`,
`createParty`/`editParty`, and the schema error messages
`partyNameRequired/TooLong/Exists`, `partyPanNumberExists`,
`partyPhoneNumberExists`, `partyNotFound`, `openingBalanceDateRequired`,
`somethingWentWrong`) was copied verbatim from
`starterkit/shared/i18n/resources.ts`'s `parties.*` block per the mobile
app's own i18n convention. `cashBank.*` and the payment-side fields have
no desktop i18n equivalent to mirror (desktop's payment/bank-account UI
uses its own component-local strings under different key paths not
reused elsewhere), so those are new mobile-authored copy, still added to
both languages in the same change. Also added `menu.parties` (en+ne) for
the new Menu row.

## Verified vs. not verified

- **Verified**: every new/edited file passes `node --check` (confirmed
  this actually catches JSX syntax errors by deliberately breaking a
  scratch file first — Node 24's `--check` does parse JSX, not just plain
  JS). Every mobile payload field name/type cross-checked line-by-line
  against `partyInputSchema` and `paymentInputSchema` (both zod schemas
  read in full). `npx tsc --noEmit` in `starterkit` — exit 0.
- **Not verified** (cannot be, from this environment): no on-device or
  Expo Go run. Never claimed visual confirmation — reasoning about layout
  correctness is from reading the file and matching existing screens'
  established style patterns (`DealsListScreen.js`/`CreateDealScreen.js`
  were the closest existing templates and were read in full before
  writing the new screens).

## Known gaps / intentionally deferred (flagged, not silently dropped)

- Party `creditTermId` field — no mobile credit-terms list endpoint yet.
- Payment invoice/bill allocation table — real sub-feature, out of scope.
- Bank account create/edit/delete on mobile — desktop-only for now.
- Opening-balance-date and payment-date are plain AD text/fixed values,
  no BS/AD `DateField` yet (blocked on the parallel session's
  `components/ui/DateField.js`, not yet landed as of this write-up).
- No bank-account ledger/detail screen on mobile (desktop has
  `cash-bank/accounts/[id]` — not requested in this task's brief, which
  scoped `BankAccountsScreen` as list-only).
