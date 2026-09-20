# Google Play store assets — SUVA ERP Mobile

Generated 2026-09-16 for `com.suvacorp.suvaerp` v1.0.1 (versionCode 2).

## What's here

| File | Play field | Spec | Actual |
|---|---|---|---|
| `icon-512.png` | App icon | PNG/JPEG, ≤1 MB, 512×512 | PNG, 15 KB, 512×512 ✓ |
| `feature-graphic-1024x500.png` | Feature graphic | PNG/JPEG, ≤15 MB, 1024×500 | PNG, 106 KB, 1024×500 ✓ |
| `phone-01-home.png` | Phone screenshot 1 | PNG/JPEG, ≤8 MB, 9:16, 320–3840 px/side | PNG, 1080×1920 ✓ |
| `phone-02-invoice.png` | Phone screenshot 2 | ″ | PNG, 1080×1920 ✓ |
| `phone-03-scan.png` | Phone screenshot 3 | ″ | PNG, 1080×1920 ✓ |
| `phone-04-nepali-bs.png` | Phone screenshot 4 | ″ | PNG, 1080×1920 ✓ |
| `phone-05-reports.png` | Phone screenshot 5 | ″ | PNG, 1080×1920 ✓ |
| `phone-06-offline.png` | Phone screenshot 6 | ″ | PNG, 1080×1920 ✓ |
| `LISTING-EN.md` | Name, short + full description (en-US) | 30 / 80 / 4000 chars | 28 / 76 / 3439 ✓ |
| `LISTING-NE.md` | Name, short + full description (ne-NP) | ″ | 22 / 75 / 3107 ✓ |
| `_generator.html` | — | source for the graphics, not an upload | — |

Six screenshots at 1080 px on the short side clears Play's "eligible for
promotion" bar (≥4 screenshots, ≥1080 px per side).

`icon-512.png` is a straight 1024→512 resize of the shipped `assets/icon.png`,
so it is byte-for-byte the app's real launcher icon, not a redraw.

## ⚠ Read before uploading the screenshots

**These are designed mockups, not captures from a running device.** The layout,
screen names, tab bar (Home · Dashboard · Items · Scan · Menu), Nepali strings,
BS dates, report list and the four-step scan wizard were all reconstructed from
the actual source in `screens/` and `i18n/resources.js` — but no build was run
to produce them.

Google's Metadata policy requires screenshots to represent the real in-app
experience. Before you submit, do one of:

1. **Preferred** — install the production build, capture the six real screens
   listed in `LISTING-EN.md`'s caption table, and drop them into the device
   frames in `_generator.html` (replace the `.dev` block contents with an
   `<img>`), keeping the captions. Re-run the generator.
2. **Minimum** — open the app on a device next to each PNG and confirm every
   screen matches what ships. Fix anything that has drifted.

The figures shown (Rs 184,320 today's sales, INV-2083-0417, the trial-balance
rows) are illustrative sample data, not a real organization's books.

## Regenerating the graphics

```bash
cd suva-erp-mobile/store-assets
node -e "const h=require('http'),f=require('fs');h.createServer((q,s)=>{s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end(f.readFileSync('_generator.html'))}).listen(8792)"
```

Then screenshot each element at `scale: 'css'` (no device-pixel scaling — the
elements are already authored at exact output pixels):

| Element | Output |
|---|---|
| `#feature` | `feature-graphic-1024x500.png` |
| `#s1` … `#s6` | `phone-01-home.png` … `phone-06-offline.png` |

Fonts come from Google Fonts (Poppins, the app's real typeface, + Mukta for
Devanagari), so the generator needs network access.

## Still outstanding for the Play release

- **`submit.production` in `eas.json` is empty** — no store-submission config
  is committed, so nothing here has been uploaded yet.
- **Google Sign-In on Play builds** — the repo's SHA-1 is registered and
  correct, but Play App Signing re-signs the AAB with its own key, so Play's
  *app signing certificate* SHA-1 must also be added to the Firebase Android
  app or "Continue with Google" fails for every Play install. Audited steps:
  `../docs/GOOGLE-SIGNIN-FCM-RUNBOOK.md`.
- **FCM V1 service-account key** must be uploaded via `eas credentials` or
  Android push delivery will not work (same runbook).
- **Privacy policy URL** is required, and must agree with the Data safety form.
  See the checklist at the end of `LISTING-EN.md`.
- `android/app/build.gradle` still says `versionName 1.0.0 / versionCode 1`,
  stale against `app.json`'s 1.0.1 / 2. Harmless if you build through EAS
  (which uses app.json), worth fixing if anyone ever builds locally.
- Tablet, Chromebook and Android XR screenshots are optional and not generated
  here. `app.json` does declare tablet support, so adding 2 tablet shots later
  would widen distribution.
