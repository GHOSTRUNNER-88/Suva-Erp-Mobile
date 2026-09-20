@../AGENTS.md

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# suva-erp-mobile (Expo/React Native, JavaScript) — Project Rules

Workspace-wide rules that also apply here (UI parity, bilingual, dual
calendar, accounting accuracy, legacy PHP handling): see `../AGENTS.md`.

## Backend

**The backend is `../vyzor-nextjs-ts-approuter/starterkit`, not `../suva-erp`.**
(`../suva-erp` is still unedited `create-next-app` boilerplate — confirmed
with the user 2026-08-26. If that ever changes, update this file and every
`EXPO_PUBLIC_API_BASE_URL` reference before writing any more mobile code.)

- This app has no backend of its own. Every piece of data or action goes
  through `starterkit`'s Next.js API routes under `app/api/**` — never a
  direct DB connection, never a copy of business logic that duplicates what
  the API already does. If an endpoint doesn't exist yet, add it in
  `../vyzor-nextjs-ts-approuter/starterkit/app/api/mobile/**` first (a
  dedicated namespace for mobile-only endpoints, created 2026-08-26), then
  consume it from here.
- Every call goes through `lib/api.js`'s `apiFetch()`, which attaches a
  fresh Firebase ID token as `Authorization: Bearer <token>` and unwraps the
  `{ok,data}`/`{ok,error}` envelope every `app/api/**/route.ts` already
  returns. Don't hand-roll a second fetch wrapper.
- Don't recompute totals/tax/balances client-side for display purposes
  beyond simple formatting — trust the API's numbers (see `../AGENTS.md` §5).

## Auth

- **Firebase Auth, same project as `starterkit`** (`suva-erp`, project
  number `931668619666`) — not a separate Firebase project. `.env`'s
  `EXPO_PUBLIC_FIREBASE_*` values must always match `starterkit/.env.local`'s
  `NEXT_PUBLIC_FIREBASE_*` values (same values, different prefix).
- **Email/password**: plain `firebase` JS SDK (`firebase/auth`), RN
  persistence via `initializeAuth(app, { persistence:
  getReactNativePersistence(AsyncStorage) })` — see `firebase/client.js`.
  Verified directly against the installed `@firebase/auth` package (both
  v11 in `starterkit` and v12 here) that `getReactNativePersistence` is
  exported from plain `firebase/auth` under Metro's `react-native`
  resolution condition — no special subpath import needed. Works in plain
  Expo Go, no native build required.
- **Google Sign-In is wired up (2026-08-27)**, via
  `@react-native-google-signin/google-signin` (NOT `@react-native-firebase/*`
  — deliberately avoided pulling in the whole RNFirebase native suite; this
  library only obtains a native Google ID token, which is then exchanged for
  a Firebase session through the existing plain `firebase/auth` JS SDK —
  `GoogleAuthProvider.credential(idToken)` + `signInWithCredential()` — so
  the app keeps exactly one auth persistence path, not two). See
  `firebase/googleAuth.js` (`configureGoogleSignIn()` called once from
  `auth/AuthProvider.js` at module load; `signInWithGoogle()` called from
  `LoginScreen.js`'s Google button). Client IDs come from
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  (see `.env.example` for where to copy them from — they're the same
  non-secret client IDs already sitting in the checked-in
  `google-services.json` / `GoogleService-Info.plist`).
  - **iOS config confirmed complete** — `GoogleService-Info.plist` has a
    real iOS-type OAuth client.
  - **Android config is complete** (re-verified 2026-09-16, this paragraph
    previously said otherwise and was stale). `google-services.json` now has
    both an Android-type OAuth client (`client_type: 1`) and a web-type one
    (`client_type: 3`), and the registered SHA-1
    (`3D:60:06:6C:06:CA:DB:2E:73:E7:98:62:4F:0C:03:06:83:C6:49:C0`) matches
    all three `.jks` keystores in the repo. The Play App Signing certificate
    (`E3:AB:98:6A:…`, the key Play re-signs the uploaded AAB with) was added
    alongside it on 2026-09-16, so Google Sign-In is now correctly configured
    for **both** Play installs and sideloaded APKs. **Don't re-register
    either.** Full audit: `docs/GOOGLE-SIGNIN-FCM-RUNBOOK.md`.
  - This is a native module — **does not run in Expo Go.** `expo-dev-client`
    is now a dependency and `eas.json` has a `development` build profile
    (`developmentClient: true`) — build with
    `eas build --profile development --platform android|ios`, install that
    build on the device/emulator, then `npx expo start --dev-client` (not
    plain `expo start`) to connect to it. Plain Expo Go no longer works for
    this project from this point on. iOS dev builds need a paid Apple
    Developer account + a physical device to install on (no Simulator
    without a Mac) unless building for the iOS Simulator specifically.
  - **Real, not-yet-fixed gap found 2026-08-27 while investigating a "Google
    picker doesn't open" report**: `organizations/service.ts`'s
    add/invite-user flow creates every user's Firebase account as
    email/password immediately (`getAdminAuth().createUser({email,
    password})`), never Google. If that same person later tries "Continue
    with Google" on mobile with the same email, Firebase will very likely
    refuse to auto-link the identities and throw
    `auth/account-exists-with-different-credential` from
    `signInWithCredential()` in `firebase/googleAuth.js` — currently caught
    generically as `auth.errSignInFailed`, not handled as a real linking
    flow. The immediate bug reported this session ("no picker opens at
    all") is almost certainly unrelated and just a stale pre-SHA-1-fix
    build — but once that's confirmed fixed by rebuilding, this
    account-linking gap is real and will block Google Sign-In for anyone
    created via the web app, the very scenario the user described. Proper
    fix: catch that specific Firebase error code, prompt for their existing
    password, then `linkWithCredential()` the Google credential onto the
    existing account — **this is now implemented** (verified 2026-09-16;
    this line previously said "not attempted yet"). See
    `firebase/googleAuth.js`'s `needsLinking` return and
    `linkGoogleAccountWithPassword()`, wired through `auth/AuthProvider.js`
    to the password prompt in `screens/LoginScreen.js`.
  - **More native modules added since the first dev-client build**
    (2026-08-27): `expo-file-system` + `expo-sharing` (WhatsApp/PDF share),
    `expo-image-picker` + `@react-native-ml-kit/text-recognition` (Scan
    Receipt), `@react-native-firebase/app` + `@react-native-firebase/crashlytics`
    (Crashlytics crash reporting & error tracking, added 2026-09-16).
    Any dev-client build made before all of these landed needs a
    fresh `eas build --profile development` — the installed binary only
    contains whatever native modules existed at build time (this is exactly
    the `TurboModuleRegistry: 'RNGoogleSignin' could not be found` crash
    that happened the first time, caused by testing against a stale build).
- **No signup screen in this app, by explicit instruction (2026-08-26).**
  Account/workspace creation stays desktop-only. Don't add one without being
  asked again.
- `resolveAuthContextFromFirebaseUid`
  (`starterkit/shared/auth/resolve-context.ts`) already resolves a verified
  Firebase UID → company → organization automatically (via
  `users.lastOrganizationId` or the company's default org) — **there is no
  subdomain/workspace-picker step on login.** A user who belongs to more
  than one organization can switch via the existing
  `POST /api/organizations/switch` route (persists
  `users.lastOrganizationId`, so the next `/api/mobile/session` call picks
  it up) — not yet wired into any mobile screen; build it when a real
  multi-org user needs it, don't guess at the UI for it now.

## i18n

- Mirror `starterkit/shared/i18n/resources.ts`'s key names and copy
  verbatim wherever an equivalent key already exists there (currently just
  the `auth.*` namespace, in `i18n/resources.js`) — same `i18next` +
  `react-i18next` libraries, deliberately, so translations never fork
  between web and mobile. Add new keys to **both** `en` and `ne` in the same
  change, never English with a translation TODO (`../AGENTS.md` §3).
- Every screen needs a visible language switch — see the pill toggle on
  `screens/LoginScreen.js` for the pattern (calls `i18n/language.js`'s
  `setLanguage()`, which persists the choice to `AsyncStorage` and is
  restored on boot via `restoreLanguage()`).
- Both BS and AD dates wherever a date appears (`../AGENTS.md` §4) — no
  date-bearing screen exists yet; when one is built, port
  `starterkit/shared/date/bs-ad.ts`'s conversion logic rather than
  hand-rolling a second one (it's DOM-free, server/client-safe already).

## UI

- Plain JavaScript project — no TypeScript, no `.tsx`/`.ts` files.
- Before building a screen, check the equivalent screen in `starterkit`
  (desktop) and mirror its fields, labels, and flow — see `../AGENTS.md` §1.
  Only adapt what touch/mobile ergonomics actually require (e.g. list
  instead of table, drawer instead of sidebar).
- **Brand mark**: use `assets/brand/suva-mark.js`'s `suvaMarkXml` (rendered
  via `react-native-svg`'s `<SvgXml>`) — the real Suva gold-gradient mark,
  copied from `starterkit/public/assets/images/brand-logos/suva-mark.svg`.
  The Vyzor template's own `desktop-logo.png`/`toggle-logo.png` are
  143-177 byte placeholder stubs, not real branding — don't use them. The
  gold is the *logo's* color only, not the UI theme color — see below.
- **UI theme color = `theme/colors.js`**, copied from the real shipped
  defaults in `../vyzor-nextjs-ts-approuter/final/public/assets/scss/_variables.scss`'s
  `:root` block (primary `rgb(152,95,253)` = `#985FFD`, danger `#FF6757`,
  success `#32D484`, text `#011A42`, muted text `#5D6576`, border `#E2E8EE`,
  body bg `#F8F9FD`) — **not** `starterkit`'s copy of that file, which only
  points these at a runtime CSS variable with no static fallback (the theme
  is customizer-driven there). `final` is the source of truth for the
  actual default values. Always pull new colors from `theme/colors.js`,
  don't hardcode a new hex per screen.
- **Icons**: `@expo/vector-icons` (bundled with Expo, no extra native
  config) — `Feather` set used so far (`mail`, `lock`, `eye`/`eye-off`).
  Stay on one icon set unless a specific icon is missing from it.
- **Safe area**: use `react-native-safe-area-context`'s `SafeAreaView`
  (imported from that package, not the built-in `react-native` one — the
  built-in one is a no-op on Android, which is exactly why the first draft
  of this screen rendered under the status bar). `App.js` wraps the whole
  tree in `SafeAreaProvider` — every screen must sit inside that, and use
  `edges` to control which sides actually apply insets (e.g.
  `LoginScreen.js`'s gradient header deliberately extends full-bleed behind
  the status bar with only the toggle/logo/text inside a `SafeAreaView
  edges={["top"]}`, rather than inset-ing the whole gradient block).
- Styling is plain `StyleSheet` — no NativeWind/Tamagui/RN Paper added.
  Revisit if screen count grows enough that repeating style objects becomes
  real pain, not preemptively.

## Navigation & screens (2026-08-27)

`expo-router` (file-based, mirrors the web app's routing mental model).
`package.json`'s `main` is `expo-router/entry` — there is no `App.js`/
`index.js` anymore, the root is `app/_layout.js`.

- `app/_layout.js` — loads Poppins fonts, restores the saved language, and
  gates everything on auth via `Stack.Protected guard={...}` (the *current*
  SDK 57 pattern — verified against Expo's docs directly before using it,
  since the older `useProtectedRoute`/`router.replace()` pattern is
  deprecated). Keeps the native splash screen up via `expo-splash-screen`
  until fonts + language + the Firebase auth check are all ready, so there's
  no blank-white-flash on cold start.
- `auth/AuthProvider.js` — a `<AuthProvider>` + `useAuth()` context (not a
  bare hook anymore — multiple screens now need the same `{user, loading,
  login, logout}` state, and a bare hook would attach a duplicate
  `onAuthStateChanged` listener per caller).
- `app/(tabs)/_layout.js` — the bottom tab bar: **Home / Dashboard / Items /
  Menu**, in that order, matching `../mobile-ui-ref`'s reference screenshots
  exactly (flat white bar, colored icon+label when active, no pill-highlight
  background — that's the iBank kit's style, not this app's). The actual
  screen components live in `screens/*.js`; the files under `app/(tabs)/`
  are thin re-exports, same separation as `app/login.js` → `screens/LoginScreen.js`.
- `app/coming-soon.js` — one generic, reusable placeholder screen (`title`
  param) for every nav destination that has no real screen yet. **Every
  screen and every tap in this app must be honest about what's real**: wire
  real data via `apiFetch()` wherever a backend route already exists, and
  route to `/coming-soon` for anything that doesn't — never fabricate
  numbers, never build a fake-looking list backed by nothing. This is why
  `HomeScreen.js`'s "Transaction Details" tab shows a real empty state
  instead of invented transactions (see below).

### What's real vs. placeholder right now

Built against `mobile-ui-ref`'s screenshots (Home, Notifications, Dashboard,
Items, Menu, Sale list, Sale Report, Business Profile — "that is the app,"
per the user, 2026-08-27) as the actual target IA, styled with the iBank kit's
atomic component vocabulary (Poppins, 15px radius, card shadows) and this
app's own violet/gold colors:

| Screen | Status | Data source |
|---|---|---|
| Login | Done | Firebase email/password + Google (native, EAS dev build only — see Auth section; Android blocked on a missing SHA-1 fingerprint) |
| Home | Real | Both tabs real: "Party Details" = `GET /api/parties`; "Transaction Details" = `GET /api/mobile/sales-invoices`. "Add Txn"/"Txn Settings" and the "Add New Sale" FAB still route to `/coming-soon` — no create-sale form built (real `document-form.tsx`-level scope). |
| Dashboard | Real counts, no trend chart | Real item/party counts + real total-sale figure (`/api/items`, `/api/parties`, `/api/mobile/sales-invoices`). No month-over-month chart — that needs a real historical aggregate, not a single total. |
| Items | Real | `GET /api/items` (name, sale/purchase price, category). No "in stock" figure — `listItems()` doesn't join the per-warehouse `inventories` table, not guessed at. Quick Links + "Add New Item" FAB → `/coming-soon` (POST endpoint exists, create-item form doesn't). |
| Menu | Real (as navigation) | Sale + Reports rows go to the real Sale list/Report screens; Purchase/Expenses still `/coming-soon` (no backend); Business Profile row is real; Log out is real. |
| Sale list (`/sales`) | Real | `GET /api/mobile/sales-invoices` (new). Total-sale summary card, status badge, tap-through to detail. |
| Sale detail (`/sales/[id]`) | Real | `GET /api/mobile/sales-invoices/[id]` (new) — invoice header + line items + full totals breakdown. Header share icon downloads a real PDF (`GET /api/mobile/sales-invoices/[id]/pdf`, new, 2026-08-27 — server-renders through the same Handlebars context/template desktop's print view uses) and opens the native share sheet (`expo-sharing`) — WhatsApp shows up there automatically if installed. |
| Sale Report (`/sales/report`) | Real | Same list endpoint, client-filtered This-Month/All-Time (no dedicated report-aggregate endpoint yet — real per-row data, computed client-side, not fabricated). |
| Notifications (`/notifications`) | Real | `GET /api/mobile/notifications` (new). Renders by the small known `type` enum, not the raw `titleKey`/`bodyKey` starterkit stores — see the file's own comment for why (avoids the exact "raw i18n key on screen" bug flagged in starterkit's own audit). |
| Business Profile & Organization Settings (`/business-profile`, `/organization-settings`) | Real, **fully functional** (2026-09-04) | Full CRUD & switching via `GET/PUT /api/mobile/organization` and `POST /api/organizations/switch`. Persists Business Name, Industry, Phone Number, Email, Address, PAN/VAT Number, VAT registration toggle, Website, Currency, Invoice Prefix, Bill Prefix, and Default VAT %. PayTide FinTech style with live visiting card, dynamic profile completion, and bilingual support. |
| Purchase list/detail (`/purchases`, `/purchases/[id]`) | Real | `GET /api/mobile/purchase-bills` (+`[id]`, new) — mirrors Sale list/detail exactly. |
| Create Sale (`/sales/new`) | Real | `POST /api/mobile/sales-invoices` (new), fields mirror `salesInvoiceInputSchema` exactly. Variant (`variantId`) selection not exposed — a real sub-feature on its own, out of scope; lines post without a variant, same as any non-variant item on desktop. |
| Create Purchase (`/purchases/new`) | Real, domestic-only | `POST /api/mobile/purchase-bills` (new). Every import/customs field (isImport, exchangeRate, landed-cost breakdown...) is omitted — all zod-`.default()`ed in `purchaseBillInputSchema`, so this still produces a valid bill, just not an import one. Import purchases stay desktop-only. |
| Create Item (`/items/new`) | Real, core fields | `POST /api/items` (already existed). Skips secondary-unit conversion, variant `attributeValueIds`, and per-party-group price overrides — each is its own real UI (an attribute picker, a price-override table), not attempted here. |
| Expenses list + create (`/expenses`, `/expenses/new`) | Real | `GET/POST /api/mobile/expenses` + `GET /api/mobile/expense-categories` (both new). `expenseNumber` is auto-generated (`EXP-<timestamp>`) rather than a user-typed field like desktop's — the one field intentionally simplified here. |
| Onboarding tutorial (`/onboarding`) | Real (2026-08-27) | 5-slide swipeable walkthrough shown once per Firebase uid after first login (`lib/onboarding.js`, AsyncStorage — no backend involved). `app/_layout.js`'s auth gate now has a third `Stack.Protected` branch (`!!user && needsOnboarding`) checked before landing on `(tabs)`, computed as part of the same splash-screen readiness gate as fonts/language so there's no flash of the tabs before redirecting. Same pass also fixed a real gap found while wiring this: `deals/index`, `deals/[id]`, `deals/new`, and `scan` had route files but were never added to any `Stack.Protected` block in `_layout.js` — unclear whether expo-router was silently leaving them unauthenticated-reachable or just unreachable, but either way they're now correctly inside the `!!user` group alongside every other authenticated screen. |
| Store Management | **Not built** | Unclear what this maps to in the real schema (mobile-ui-ref's own screenshot wasn't in the shared set) — needs a concrete spec before building, not a guess. |
| Deals list/detail/create (`/deals`, `/deals/[id]`, `/deals/new`) | Real (2026-08-27) | `GET/POST /api/mobile/deals`, `GET /api/mobile/deals/[id]`, `PATCH /api/mobile/deals/[id]/stage`, `GET/POST /api/mobile/lead-sources` (all new). CRM's real shape is just Deals + Lead Sources (see `starterkit/shared/crm/service.ts` — no Kanban, no leads/contacts/notes/calls, desktop doesn't have those either). Create form is deliberately trimmed to title/contact/stage/lead-source/expected-revenue — skips `assignedToUserId` (no assignable-users list endpoint built for mobile), `expectedClosingDate` (no BS/AD date picker on mobile at all yet — see the still-open dual-calendar gap below), and `isPrivate`. Detail screen's stage chips are the one desktop CRM "special action" (`updateDealStageAction`), mirrored as tappable chips instead of a dropdown. |
| Scan Receipt (`/scan`) | Real, best-effort (2026-08-27) | Camera capture (`expo-image-picker`) → on-device OCR (`@react-native-ml-kit/text-recognition`, Google ML Kit) → `lib/receiptParser.js` heuristics guess an amount (regex for "Total"/"Grand Total" lines, else the largest currency-like number found) and match a party by substring against the real `GET /api/parties` list. Hands off to Create Expense/Purchase/Sale via route params — Expense gets both party + amount prefilled (no line items in its schema); Purchase/Sale only get the party prefilled, since OCR can't reliably itemize a receipt against the real item catalog — lines stay fully manual there, same as any non-scanned create. **`@react-native-ml-kit/text-recognition` is flagged by `expo-doctor` as "Untested on New Architecture"** (this app runs RN 0.86 with the New Architecture on, confirmed by the earlier `TurboModuleRegistry` crash signature) — it may still work fine, but if the Scan screen crashes specifically (not other screens), this library is the first suspect; `/ahmeterenodaci/rn-mlkit-ocr` (Context7 id) is an alternative worth trying if so. |

### New backend surface this pass

Every route below follows the exact same guard chain and `{ok,data}`/raw-service-result envelope as the routes before it — `requireApiUser → requireCompanyMembership → requireOrganizationAccess → requireCategoryAction`:

- `POST /api/mobile/sales-invoices` (create, added to the existing list route)
- `GET/POST /api/mobile/purchase-bills`, `GET /api/mobile/purchase-bills/[id]`
- `GET/POST /api/mobile/expenses`, `GET /api/mobile/expense-categories`
- `GET /api/mobile/warehouses`, `GET /api/mobile/units`, `GET /api/mobile/item-categories` (supporting picker data for the forms above)
- `GET /api/mobile/sales-invoices/[id]/pdf` (2026-08-27) — server-side PDF via `shared/printing/template-renderer.ts`'s `renderTemplatePdf`, reusing `getPrintPreset()`'s self-contained Handlebars template for orgs that haven't saved a custom print template (the common case) so the PDF doesn't depend on the app's global CSS. Context-building logic is intentionally duplicated from `sales-invoice-print-view.tsx` rather than refactoring that live desktop component under time pressure — keep the two in sync if either changes.
- `GET/POST /api/mobile/deals`, `GET /api/mobile/deals/[id]`, `PATCH /api/mobile/deals/[id]/stage`, `GET/POST /api/mobile/lead-sources` (2026-08-27) — thin wrappers over `shared/crm/service.ts`, the same functions desktop's Server Actions call.
- `POST/DELETE /api/mobile/push-token`, `GET /api/mobile/modules`, `GET /api/mobile/woocommerce/orders` (2026-08-27) — see "Push notifications" and "Store Management" sections below.

## Push notifications (2026-08-27)

Real, wired to one concrete event (Payment In / "money received"), not a
generic framework wired to nothing — see `../vyzor-nextjs-ts-approuter/
starterkit/shared/notifications/push.ts` and `shared/payments/service.ts`'s
`createPayment` (push fires after the transaction commits, on the outer
`organizationDb`, never inside the transaction).

**Important scope note, found while building this**: starterkit's existing
in-app notification bell (`shared/notifications/producers.ts`) only runs
its scans when someone has the bell open — there is no cron. That system
could never have powered real phone push (nothing to react to while the
app is closed), so push needed its own hook directly into the business
action, not a retrofit of the bell. Only Payment In is wired so far —
adding another event (invoice overdue, deal won, etc.) means adding the
same `notifyOrganizationDevices(organizationDb, {title, body, data})` call
at that action's own commit point, same pattern as `createPayment`.

**Storage**: `push_tokens` table, one per **organization database**
(migration `0038_push_tokens.sql`), not company-wide — a push-triggering
action already runs inside one org's own db connection, so this avoids a
cross-database company→org fan-out. Trade-off: a user active in multiple
orgs only gets pushed for orgs whose session actually registered a token,
not automatically for every org they belong to.

**Mobile**: `lib/pushNotifications.js`'s `registerForPushNotifications()`
— requests permission, gets an Expo push token, POSTs it to
`/api/mobile/push-token`. Called fire-and-forget from `app/_layout.js`
whenever `user` becomes truthy (a denied permission must never block the
app). Needs `expo-notifications` (native module — another dev-client
rebuild needed before this is testable).

**FCM (2026-08-27; still outstanding as of 2026-09-16 — steps in `docs/GOOGLE-SIGNIN-FCM-RUNBOOK.md`)**: Expo's push service already
routes Android delivery through FCM using this project's own
`google-services.json` — no mobile code change was needed for "set up FCM".
The one real gap is credential-side, in Expo's own account, not this repo:
Google deprecated the legacy FCM server key in June 2024, and Expo's push
service needs the newer FCM **V1** service-account key uploaded via
`eas credentials` (Android → Push Notifications → set up FCM V1) before
push delivery to real devices keeps working. That upload needs the
Firebase console (Project Settings → Service Accounts → Generate new
private key) — only the account owner can do it, so it's flagged here
rather than attempted. Until it's done, push registration itself still
succeeds (`getExpoPushTokenAsync` doesn't touch FCM directly); only actual
delivery to Android devices is at risk.

**Web push (2026-08-27)**: the desktop app (starterkit) now has real
browser push too — `shared/notifications/push.ts`'s
`notifyOrganizationDevices()` fans out to both Expo (mobile tokens) and
Firebase Admin Messaging (web tokens) from the same `push_tokens` table,
keyed by `platform`. Needs `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in starterkit's
`.env` (Firebase console → Project Settings → Cloud Messaging → Web Push
certificates → generate key pair) — without it the header bell's "Enable"
button fails silently (caught, logged, never blocks the page). See
`../vyzor-nextjs-ts-approuter/starterkit/shared/firebase/messaging-
client.ts` and `app/firebase-messaging-sw.js/route.ts`.

## Developer API module (2026-08-27)

New, backend-only so far — no mobile screen for it (an org owner manages
keys from desktop only, `integrations/developer-api` in starterkit,
owner-gated same as billing). Documented here because it changes how
`requireApiUser()` works on **every** `/api/mobile/**` route: a bearer
token starting `sk_live_` is now resolved as a Developer API key
(`shared/developer-api/service.ts`) instead of a Firebase ID token — same
function, same downstream permission chain, so nothing in mobile's own
code needed to change. A curated external-facing mirror of the busiest
mobile endpoints also exists at `/api/v1/*` (parties, items, sales-
invoices, purchase-bills) for third-party integrations, reusing the exact
same shared service functions mobile's own routes call — no duplicated
business logic.

## Store Management (2026-08-27)

Built after being shown `mobile-ui-ref`'s actual source — the reference
screenshots are the real **Vyapar** app (competitor), not a generic Figma
kit; its Menu screen has a "Store Management" section (Modules +
"My Online Store") that this mirrors. Two screens, both read-only:

- **Modules** (`/store/modules`) — the org's `MODULE_CATALOG` entries with
  purchased/enabled status, mirroring desktop's Module Store list.
  Purchasing/activating stays desktop+owner-only (billing — see the
  Organization Center permission note below), mobile only ever reports
  status.
- **WooCommerce Orders** (`/store/woocommerce-orders`) — real order data
  via the same `listWooOrders()` desktop's WooCommerce Orders page calls.
  Page 1 only, no pagination UI (a full filterable order table is a
  desktop-scale screen, not a "quick mobile" one).
- **Shopify has no equivalent screen** — confirmed by reading
  `shared/shopify/service.ts` directly: it's connection-settings only, no
  order-sync table exists yet on desktop either. Nothing to mirror until
  desktop itself has it — don't build a fake one.

### Shared form infrastructure

- `components/PickerField.js` — searchable full-screen picker, the mobile
  equivalent of desktop's searchable-select (`../AGENTS.md` workspace rule:
  "every relation select must be searchable"). No inline quick-create —
  that's a real feature of its own, not attempted.
- `components/LineItemsEditor.js` — shared between Create Sale and Create
  Purchase, since `salesInvoiceLineInputSchema`/`purchaseBillLineInputSchema`
  are identically shaped.
- `lib/api.js`'s `ApiError` now carries `fieldErrors`/`formError` in
  addition to `code`/`messageKey` — needed once real create-forms existed,
  since a validation failure from `createSalesInvoice`/`createItem`/etc.
  returns its result object raw (`{ok:false, fieldErrors}` or
  `{ok:false, formError}`), not wrapped in the auth-guard's
  `{ok:false, error:{code, messageKey}}` envelope. Every form screen checks
  `err.fieldErrors`/`err.formError` before falling back to `err.messageKey`.
- Every create-form's live subtotal/VAT/total is **display only** — the
  real, authoritative numbers are always recomputed server-side by the same
  `computeLinesAndTotals()` desktop uses, never trusted from the client
  (`../AGENTS.md` §5).

## Dev setup

- `.env` holds this machine's LAN IP as `EXPO_PUBLIC_API_BASE_URL` (a phone
  running Expo Go can't reach `localhost`) — re-check with `ipconfig` if it
  stops connecting after a network change. `starterkit`'s dev server
  (`npm run dev`) must be running and reachable at that address.
- `npx expo start`, scan the QR with the Expo Go app — no native build
  needed for anything currently in this app (changes the moment native
  Google Sign-In is added, see Auth above).

## Animations + module-added notice (2026-09-01)

Added without any new native dependency — `react-native-reanimated` is
NOT installed (checked, including transitively), so everything here uses
React Native's built-in `Animated` API. Deliberate: this project already
has several native-module rebuilds queued (google-signin, notifications,
ml-kit, sharing); adding Reanimated on top would force yet another EAS
build cycle before any of this is even testable, for a purely cosmetic
feature. If reanimated ever gets added for another reason, this can be
revisited, but built-in `Animated` is enough for press-feedback and
mount-in fades.

- `lib/useFadeInUp.js` — the one shared primitive: `useFadeInUp(delay)`
  (mount fade+slide, used by `ListRow`), `staggerDelay(index)` (caps the
  per-row delay so a long list doesn't take forever to finish animating
  in), `usePressScale()` (press-in/press-out scale, used by `Button`/
  `IconButton`). Every screen using `Button` (nearly all of them) gets
  press feedback for free from this one change.
- `app/_layout.js`'s root `Stack` now sets `animation: "slide_from_right"`
  — every screen navigation in the app, one line.
- `components/ui/ListRow.js` fades in on mount and accepts an optional
  `index` prop for stagger — **not adopted by any screen yet**: the 14
  list screens (`HomeScreen`, `SaleListScreen`, `DealsListScreen`, etc.)
  each hand-roll their own `FlatList` renderItem/card markup rather than
  using this shared component. Retrofitting all 14 was out of scope for
  this pass — `ListRow`'s animation is real and ready, it just needs each
  screen to actually render `<ListRow>` instead of its own inline card.

**Module-added notice** — `lib/moduleTourTracker.js`'s `checkForNewModule()`
mirrors starterkit's `shared/tour/ModuleAddedTourTrigger.tsx` (same diff-
against-last-known-list idea, ported from localStorage to AsyncStorage).
Wired into `app/_layout.js` alongside the push-registration effect: on
login, fetches `/api/mobile/modules`, and if a module key appears that
wasn't there last time, shows a toast ("New module unlocked: X"). A real
DOM-measured spotlight tour (what starterkit's web version does) doesn't
translate to React Native without wiring a `ref` onto every target
element first — a toast is the platform-honest equivalent per AGENTS.md
§1 (presentation may differ, the underlying flow doesn't), not a
downgrade taken for convenience.
