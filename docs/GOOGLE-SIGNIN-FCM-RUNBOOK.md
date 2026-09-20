# Google Sign-In & FCM in production — verified state and what's left

Audited 2026-09-16 against the working tree.

> ## ⚠ CORRECTION 2026-09-17 — the table below is stale again
>
> `google-services.json` was re-downloaded today (mtime `Sep 17 09:37`) and it
> now contains **exactly one** `client_type: 1` entry:
> `931668619666-42mc9n07…`, certificate hash `e3ab986a…` (the **Play app
> signing** key). The client this runbook verified on 2026-09-16,
> `931668619666-qh70mca6…` / `3d60066c…` (the **upload** key), is **gone from
> the file** — same `mobilesdk_app_id`, so it is the same Firebase app.
>
> A `google-services.json` downloaded while two fingerprints are registered
> lists **two** `client_type: 1` entries. This one lists one. So the upload-key
> fingerprint looks **replaced, not added** — Play installs still resolve, but
> **sideloaded `preview` APKs signed with `credentials/android/keystore.jks`
> will now fail with `DEVELOPER_ERROR`.**
>
> Verified today with keytool against `credentials/android/keystore.jks`
> (alias `081dc48a6da5107bbc9012f601d43f30`):
> `SHA1: 3D:60:06:6C:06:CA:DB:2E:73:E7:98:62:4F:0C:03:06:83:C6:49:C0` — matches
> the entry that disappeared.
>
> **Confirm in Firebase Console → Project settings → the Android app → SHA
> certificate fingerprints.** If only one is listed, re-add the other. Note the
> file itself is not the gate — Google resolves the OAuth client server-side
> from package name + certificate — so the console is the authority, not this
> file.
>
> Also: every `recordCrashlyticsError()` call in `firebase/googleAuth.js`,
> including the one that logs the `DEVELOPER_ERROR` code, was a **silent
> no-op** until 2026-09-17. `@react-native-firebase/crashlytics` v26 removed
> the namespaced default export and `firebase/crashlytics.js` still used
> `require(...).default`. Fixed; see `firebase/crashlytics.check.js`. Any
> "no Crashlytics evidence for the login failure" conclusion drawn before
> today is worthless.

**Google Sign-In: done.** Both certificates are registered and
`google-services.json` is refreshed — see the resolved section below.

**FCM push delivery: still blocked.** One credential upload left, outside this
repo. Steps at the bottom.

This supersedes the Auth and "Push notifications → FCM" notes in `AGENTS.md`,
which were written before the fingerprints were registered and are stale.

---

## What was verified (all PASS)

| Check | Result |
|---|---|
| Android OAuth client (`client_type: 1`) exists in `google-services.json` | ✅ `931668619666-qh70mca6m7kk8uin2m25htqh15tmdj19` |
| Web OAuth client (`client_type: 3`) exists | ✅ `931668619666-9dcvjo40fb4hicnmoh5dm7qtum56cusm` |
| Registered SHA-1s | ✅ both the Play app signing key (`E3:AB:98:…`) and the upload key (`3D:60:06:…`) |
| All three `.jks` files are the same key | ✅ alias `081dc48a6da5107bbc9012f601d43f30` |
| `eas.json` production `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = the **web** client | ✅ correct client type |
| `eas.json` production `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` = plist `CLIENT_ID` | ✅ exact match |
| `app.json` `googleServicesFile` set for both platforms | ✅ |
| `android.package` == `ios.bundleIdentifier` == plist `BUNDLE_ID` | ✅ `com.suvacorp.suvaerp` |
| `google-services.json` / plist reach EAS Build | ✅ untracked but **not** gitignored, and `requireCommit` is unset, so EAS copies the working dir by `.gitignore` rules — they upload |
| Push: `projectId` passed to `getExpoPushTokenAsync` | ✅ from `extra.eas.projectId` |
| Push: Android notification channel created before token request | ✅ `default` channel |
| Push: cold-start tap handling + `clearLastNotificationResponse` | ✅ |

> **Do not "fix" the SHA-1s again.** Both the Play app signing key and the
> upload key are registered. Re-adding them changes nothing.

---

## Fixed in code this pass

`firebase/googleAuth.js`:

1. **`revokeAccess()` → `signOut()` before each sign-in.** Revoking tears down
   the OAuth *grant*, forcing Google's consent screen on every single sign-in
   and throwing when no account is connected. `signOut()` drops the cached
   account and still shows the picker. `auth/AuthProvider.js` already called
   `signOut()` on logout, so the revoke was redundant as well as harmful.
2. **`DEVELOPER_ERROR` is now surfaced distinctly.** Android rejects a
   certificate/OAuth-client mismatch with `code === "10"`
   (`CommonStatusCodes.DEVELOPER_ERROR`, see the native module's
   `RNGoogleSigninModule.java:168`). It is **not** in the exported
   `statusCodes` map in v16.1.4, so it must be matched on the raw string —
   `statusCodes.DEVELOPER_ERROR` is `undefined` and matching on it silently
   breaks. It previously fell into the generic "Sign-in failed. Please try
   again." bucket, which is exactly why a release-build failure was
   indistinguishable from a network blip.
3. **`SIGN_IN_CANCELLED` treated as a cancel, not an error.** Some Android
   versions throw on back-press instead of returning a non-success response,
   which used to raise a failure toast on a plain dismiss.

New bilingual key `auth.errGoogleMisconfigured` (EN + NE, parity verified at
1,177 keys each).

---

## ✅ RESOLVED 2026-09-16 — Blocker 1, Google Sign-In on Play installs

**Done.** Both fingerprints are now registered on the Firebase Android app and
`google-services.json` has been refreshed in this repo:

| Certificate | SHA-1 | Covers |
|---|---|---|
| Play **app signing** key | `E3:AB:98:6A:15:EC:0B:D3:A0:31:25:73:46:1F:F2:CA:41:51:47:EE` | every Play Store install |
| **Upload** key (`credentials/android/keystore.jks`) | `3D:60:06:6C:06:CA:DB:2E:73:E7:98:62:4F:0C:03:06:83:C6:49:C0` | sideloaded / internal APKs |

No further action. The history below is kept so nobody re-diagnoses this.

<details><summary>Original diagnosis</summary>

The `production` profile in `eas.json` sets no `android.buildType`, so it
produces an **AAB**. When an AAB is uploaded to Play with **Play App Signing**
enabled (the default, and mandatory for new apps), Play strips your upload
signature and **re-signs the app with its own key**. The certificate on the
device is therefore *not* `3D:60:06:…` — it is Play's app signing certificate,
which is not registered on the Firebase Android app.

Result: the sideloaded `preview` APK works, the Play build fails with
`DEVELOPER_ERROR`, for every user.

### Fix (5 minutes, needs Play Console + Firebase Console)

1. Play Console → your app → **Test and release → Setup → App signing**.
2. Copy the **SHA-1** under *App signing key certificate*
   (not *Upload key certificate* — add that one too, it's harmless and helps
   internal testing).
3. Firebase Console → **Project settings → Your apps → the Android app
   (`com.suvacorp.suvaerp`) → Add fingerprint** → paste → Save.
4. Download the refreshed `google-services.json` over the one in this repo.
5. Rebuild and re-upload.

No code change is needed for this — Google resolves the OAuth client
server-side from package name + certificate. Step 4 is hygiene so the file in
the repo reflects reality.

</details>

### If it still fails after that

Confirm the account isn't hitting the *other* path: an email that already has
a password-based Suva account (everyone created through the desktop
invite/add-user flow) returns `needsLinking`, and `LoginScreen.js` prompts for
the existing password to link. That flow is implemented and working — it is
not an error, despite what `AGENTS.md` says.

---

## ⚠ Blocker 1 (remaining) — FCM V1 key for Android push delivery

Push **registration** already succeeds (`getExpoPushTokenAsync` never touches
FCM). Only **delivery** to Android devices is blocked.

Expo's push service routes Android through FCM using this project's
`google-services.json`. Google retired the legacy FCM server key in June 2024,
so Expo needs the newer **FCM V1 service account key** uploaded to your Expo
account. Nothing in this repo can supply it.

### Fix (needs Firebase Console + the Expo account owner)

1. Firebase Console → **Project settings → Service accounts → Generate new
   private key**. Downloads a JSON file. **Treat it as a secret — do not
   commit it to this repo.**
2. Run `eas credentials` → platform **Android** → **Push Notifications: FCM
   V1** → *Upload a new service account key* → point it at that JSON.
3. Verify with `eas credentials` that FCM V1 shows as configured, then send a
   test push to a real device build.

iOS push needs an APNs key in the same `eas credentials` flow if you haven't
already uploaded one.

---

## Related, not blocking

- `submit.production` in `eas.json` is `{}` — no store-submission config, so
  nothing is automated for upload yet.
- `android/` is gitignored as a generated folder, so its stale
  `versionName 1.0.0 / versionCode 1` never reaches EAS (which prebuilds from
  `app.json`: `1.0.1` / `2`). Harmless unless someone builds locally.
- `credentials/android/keystore.jks` is gitignored by `*.jks`. That is correct
  — EAS CLI reads it from your machine via `credentials.json` and uploads it
  for signing; it does not need to be in the archive. **Back it up somewhere
  safe outside the repo; losing it means you can never update the app.**
