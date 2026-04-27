# StatusVault — WhatsApp Status Saver App

## Overview
StatusVault is a production-grade, fully offline WhatsApp Status Saver app for Android. Built with Expo React Native and Expo Router.

## App Architecture

### Stack
- **Frontend**: Expo React Native (Expo Router file-based routing)
- **Backend**: Express.js (serves landing page + API scaffolding)
- **Storage**: AsyncStorage for local app state, Firebase Firestore for verified paid subscriptions
- **Fonts**: Nunito (Google Fonts via @expo-google-fonts/nunito)
- **Video**: expo-video
- **Media**: expo-media-library, expo-sharing, expo-file-system/legacy
- **Payments**: Dual-store architecture — Razorpay (Indus/other stores) OR Google Play Billing (Play Store). Completely separate folders. Switch by changing 2 lines in `payment-providers/index.ts` + `payment-providers/server.ts`, then deleting the unused folder before uploading.

### Color Palette (Dark Navy + Emerald)
- Background: #0A0E1A (deep dark navy)
- Surface: #111827
- Primary: #00C48C (emerald green)
- Text: #F0F4F8
- Text Secondary: #8896A8

## Pages / Screens

| Route | Description |
|-------|-------------|
| `/(tabs)/index` | Home — WhatsApp statuses (Images + Videos tabs) |
| `/(tabs)/saved` | Saved statuses gallery |
| `/(tabs)/settings` | Settings, device info, links |
| `/viewer` | Full-screen image/video viewer with save/share |
| `/permissions` | Storage permission setup flow |
| `/guide` | Complete accordion setup guide |
| `/privacy` | Privacy policy (GDPR, Play Store, Indus compliant) |

## Key Features

1. **Android Version Detection** — Detects API level and uses correct storage method:
   - Legacy (Android < 10): Direct file system access
   - Scoped (Android 10): Scoped storage with READ_EXTERNAL_STORAGE
   - SAF (Android 11+): StorageAccessFramework with separate direct-folder grants for WhatsApp and WhatsApp Business

2. **WhatsApp Status Paths**:
   - `/storage/emulated/0/WhatsApp/Media/.Statuses`
   - `/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses`
   - WhatsApp Business variants
   - Home screen includes a top source selector with WhatsApp as default and WhatsApp Business as the second option; each selection opens the Android folder picker directly at the matching Media folder.

3. **AdMob Integration** (placeholder):
   - Banner ads: `AdBanner` component (60px height)
   - Interstitial ads: `AdInterstitial` component (every 3 video views)
   - Replace `AD_UNIT_IDS` in `constants/admob.ts`

4. **Paid Ad Removal**:
   - Plans: ₹30 monthly, ₹199 yearly, ₹499 lifetime
   - Settings page includes an ad-free banner and subscription plan sheet
   - Backend creates Razorpay orders and verifies Razorpay signatures before activation
   - Firestore stores payment orders, user payment history, and subscription status
   - Ads are hidden only when the backend-confirmed subscription is active or local rewarded ad access is active

5. **Media Operations**:
   - View images and videos
   - Save to device gallery (StatusVault album)
   - Share to any app or directly to WhatsApp
   - Video viewer uses prepared file URIs, a URI-based hard reset key, ready-state playback gating, and explicit decoder release when videos leave the nearby swipe window to reduce Android black-screen-with-audio issues.

## Project Structure
```
app/                        # Expo Router screens
  (tabs)/                   # Tab bar screens (index, saved, settings)
  _layout.tsx               # Root layout (fonts, providers)
  subscription.tsx          # Subscription / upgrade screen
  viewer.tsx                # Full-screen media viewer
  permissions.tsx           # Storage permission setup
  guide.tsx / privacy.tsx / terms.tsx / contact.tsx ...

components/                 # Domain-grouped React Native components
  ads/                      # AdBanner, AdInterstitial, AdReward, AdAppOpen, RewardAdButton, SupportDeveloperAd
  media/                    # MediaCard, EmptyState, LoadingShimmer, SAFGuideOverlay
  subscription/             # SubscriptionPlansCard, PaymentSuccessModal
  auth/                     # GoogleSignInModal
  feedback/                 # MilestoneRatingCard
  common/                   # AppLoadingScreen, ErrorBoundary, ErrorFallback, KeyboardAwareScrollViewCompat

hooks/                      # Domain-grouped custom hooks
  ads/                      # useAppOpenAd, useFreeAdsState
  subscription/             # useSubscriptionStatus
  feedback/                 # useMilestoneRating
  media/                    # useStatusReminder

contexts/                   # React Context providers
  AuthContext.tsx            # Firebase auth + user state
  LanguageContext.tsx        # i18n language selection
  MediaContext.tsx           # WhatsApp status media state

constants/                  # Static config
  colors.ts / theme.ts / admob.ts

lib/                        # Client-side utilities
  firebase-client.ts / device-identity.ts / i18n.ts / query-client.ts / ...
  locales/                  # Translation strings (en, hi, ar, de, es, fr, ja, ml, pt, ru)

server/                     # Express backend
  index.ts                  # App setup + server listen
  routes.ts                 # Route registrar (health, templates)
  payment-routes.ts         # Thin wrapper → payment-providers/server.ts
  user-routes.ts            # Account deletion / cancel-deletion
  config/
    firebase-admin.ts       # Firebase Admin SDK initialization
  storage.ts                # File storage helpers
  templates/                # HTML templates (landing page, privacy, terms, pricing)

payment-providers/          # Store-specific payment logic (delete unused before build)
  razorpay/                 # Indus App Store / Razorpay
    client/                 # React Native hooks + plan config
    server/                 # Express routes (orders, verify, status)
    index.ts                # Razorpay client-side provider export
  google-play/              # Google Play Billing / react-native-iap
    client/                 # React Native hooks + plan config
    server/                 # Express routes (verify, status)
    index.ts                # Google Play client-side provider export
  shared/                   # Shared types, server-utils (getAuthenticatedUser, normalizeDeviceId)
  index.ts                  # Active client-side provider switch
  server.ts                 # Active server-side provider switch

shared/                     # isomorphic (client + server) code
  subscription-plans.ts     # Canonical plan definitions (id, label, amount, duration)
  schema.ts                 # Drizzle/DB schema

scripts/                    # Utility scripts
```

## Payment Configuration

### Dual-Store Build Switch
The payment system is fully separated into two self-contained folders with zero runtime if/else:

| Store | Provider | Active folder | Delete before upload |
|-------|----------|---------------|----------------------|
| Indus App Store / Other | Razorpay | `payment-providers/razorpay/` | `payment-providers/google-play/` |
| Google Play Store | Google Play Billing | `payment-providers/google-play/` | `payment-providers/razorpay/` |

**Current default: Google Play Store (Play Store build active).** To switch to Indus/Razorpay: edit 2 lines in `payment-providers/index.ts` + 2 lines in `payment-providers/server.ts`.

### Env Vars — Razorpay build
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID` (optional)

### Env Vars — Google Play build
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME`
- `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID` (optional)

### Firestore Collections
- `subscriptions` — active Pro status per user UID
- `paymentOrders` — Razorpay order records
- `googlePlayOrders` — Google Play purchase records
- `users/{uid}/payments` — full payment history
- `influencer_campaigns/{CODE}` — admin-created referral codes (limit, usedCount, status, vipDuration, influencerUid, redeemDurationDays)
- `referral_redemptions/{uid}_{CODE}` — idempotency ledger; one doc per user+code
- `referral_devices/{deviceId}` — device fingerprint anti-spoof: which deviceId already claimed a referral

## Influencer Referral System
- **User flow:** `app/subscription.tsx` shows a "Have a referral code?" input (`components/subscription/ReferralCodeInput.tsx`). Sign-in is enforced before submit. On success the joiner gets 90 days (configurable per code) of free Pro.
- **Anti-spoof:** redemption is blocked if (a) user has any active subscription, (b) `users/{uid}.referralClaimed === true`, or (c) the device fingerprint already exists in `referral_devices`. All writes happen inside one Firestore transaction.
- **Influencer VIP:** when admin creates a campaign with an `influencerUid` and `vipDuration` (`LIFETIME` or `{ type: "DAYS", days }`), the influencer's own subscription doc is set immediately. Use `applyVipNow: true` on PATCH to re-apply later.
- **Admin allowlist:** comma-separated `ADMIN_EMAILS` env var (plus the hardcoded `ahmedsameerbinan1@gmail.com`).
- **Endpoints** (all under `server/referral-routes.ts`):
  - `GET    /api/admin/influencer-campaigns` — list
  - `POST   /api/admin/influencer-campaigns` — create `{ code, limit, redeemDurationDays?, vipDuration?, influencerUid?, influencerEmail?, influencerName?, notes? }`
  - `PATCH  /api/admin/influencer-campaigns/:code` — update any field; pass `applyVipNow: true` to push VIP again
  - `POST   /api/admin/influencer-campaigns/:code/ban` / `/unban`
  - `GET    /api/referrals/lookup/:code` — public preview (slots remaining, etc.)
  - `POST   /api/referrals/redeem` — body `{ code, deviceId }`, requires `Authorization: Bearer <idToken>`

## Personal Referral / Invite & Earn (Viral Growth Ladder)
- **User flow:** every signed-in user gets a unique short code (e.g. `K3T8N2`) on first visit to `app/invite.tsx`. Sharing the code via `Share.share()` sends a Play Store URL `…?referrer=ref%3DCODE` (works as deferred deep link) plus the code in plain text and a `statusvault://invite?ref=CODE` deep link for users who already have the app.
- **Reward ladder** (defined in `shared/referral-types.ts → REWARD_LADDER`): 3 friends → 48 hr Pro · 10 → 1 wk · 50 → 1 mo · 100 → 3 mo · 500 → 1.5 years (548 days). Rewards STACK on top of any existing `paidUntil`, never replace it. Each tier can be claimed once (tracked in `user_referrals/{uid}.rewardsClaimed`). Provider on the resulting subscription doc is `referral_ladder`.
- **Attribution layers:**
  1. Manual: friend's code typed in the Invite screen.
  2. Deep link: `app/+native-intent.tsx` parses `?ref=CODE` from any inbound `statusvault://` URL and stashes it in AsyncStorage (`pending_referral_code`).
  3. Post-install Play Referrer: route + DB schema is ready, requires the `react-native-play-install-referrer` native module on a future custom dev build.
  After sign-in, `hooks/referral/usePendingReferralAttribution.ts` (registered in `app/_layout.tsx`) auto-POSTs the pending code.
- **Anti-fraud:** must be signed in with Google, one referrer per user (immutable `referredBy` aka `referrerUid`), self-referral blocked, one device-id per attribution (collection `referral_install_devices`).
- **New endpoints:**
  - `GET  /api/referrals/me` — returns `MyReferralResponse` (lazy-creates code on first call)
  - `POST /api/referrals/attribute-install` — body `{ code, deviceId }`, attributes the *signed-in user* as a new referee for the code's owner and triggers `applyLadderRewards()`.
- **New Firestore collections:**
  - `user_referrals/{uid}` — `{ myCode, referralCount, rewardsClaimed[], referredUserIds[], referredJoinedAt[], referrerUid? }`
  - `referral_codes/{CODE}` — `{ uid }` reverse-lookup
  - `referral_install_devices/{deviceId}` — anti-fraud per-device attribution lock

## Theming (System-Driven, No Picker)
- The app theme **always follows the OS color scheme** — there is no in-app picker. `ThemeContext.tsx` listens to `Appearance.addChangeListener` and resolves to `LIGHT_COLORS` or `DARK_COLORS` based on `Appearance.getColorScheme()`. `setMode` exists as a no-op shim purely for backward compatibility with any leftover imports.
- The Android navigation bar background + button-icon colors are re-applied on every theme change in `app/_layout.tsx` via `applyImmersiveMode(colors.BACKGROUND, resolved === 'dark')`. The status bar (where the battery icon lives) flips between `light` and `dark` content via `<StatusBar style={resolved === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />`. So phone chrome at the top and bottom always matches the active theme.
- The "Ad-Free Active / Subscribe" banner (`components/subscription/SubscriptionPlansCard.tsx`) uses a theme-aware gradient: deep-green premium look in dark mode, soft tinted-surface in light mode so text and the crown icon stay readable.

## Firebase Rules (Firestore + Storage)
- `firebase.json` registers `firestore.rules` and `storage.rules` so `firebase deploy --only firestore:rules,storage` ships them.
- `firestore.rules` — default-deny everything; explicitly allow each signed-in user to READ their own `/users/{uid}`, `/subscriptions/{uid}`, `/user_referrals/{uid}`. Public READ on `/referral_codes/{code}` and `/influencer_campaigns/{code}` (only non-sensitive fields are stored). All WRITES are denied to clients — every write is performed by the Express server through the Firebase Admin SDK, which bypasses these rules.
- `storage.rules` — default-deny all paths. The app does not currently upload to Storage (statuses live on-device); rule is in place to prevent accidental billing if a stray client SDK call ever ran.
- To deploy from local machine: `firebase deploy --only firestore:rules,storage`.

## Viral Short-Link Sharing (April 22, 2026)
Every shared status (and the Settings "Share App" button) now carries the user's personal install link, so each share doubles as a referral.

**Backend** — `server/referral-routes.ts`
- New `GET /s/:CODE` route → 302 to `https://play.google.com/store/apps/details?id=com.binan.statussaver&referrer=ref%3DCODE` plus an HTML+JS fallback body for in-app webviews that strip 302s. Codes are normalized to uppercase and validated against `^[A-Z0-9_-]{3,16}$`. Garbage codes still redirect, just to the bare Play Store.
- `/api/referrals/me` now returns BOTH `shareUrl` (short, e.g. `https://svault.me/K3T8N2` once the domain is live) and `playStoreUrl` (full referrer URL, fallback). Short-link base is read from `PUBLIC_BASE_URL` env var, otherwise derived from request `Host` (handles Replit/CDN proxy headers).
- Set `PUBLIC_BASE_URL=https://svault.me` in Replit Secrets when the short domain is registered — no app rebuild needed.

**App-side**
- `lib/share-link.ts` — tiny AsyncStorage cache (`@statusvault_share_link`, `@statusvault_share_code`) plus `buildShareCaption()` helper. Always returns a usable URL (falls back to bare Play Store install link).
- `hooks/referral/usePrefetchShareLink.ts` — wired into `AuthProvider`. As soon as a Firebase user is detected, fires a one-shot fetch to `/api/referrals/me` and caches the short link. Clears the cache on sign-out so links don't leak across accounts.
- `app/invite.tsx` — also persists `shareUrl` to the cache on every successful fetch, so the cache is always fresh.
- `contexts/MediaContext.tsx::shareStatus` — calls `Share.open()` from `react-native-share` with `message: caption` (becomes Intent.EXTRA_TEXT on Android, UIActivityViewController text item on iOS) so WhatsApp/Telegram/Instagram/etc. AUTO-FILL their caption box with the user's personal short link. Caption is also silently copied to the clipboard as a backup (long-press → Paste) for any app that strips EXTRA_TEXT. If react-native-share itself fails (e.g. Expo Go without the autolinked binary), falls back to `Sharing.shareAsync(shareUri)` so media still goes out.
- `app/(tabs)/settings.tsx::handleShareApp` — uses the cached short link instead of the hardcoded long Play Store URL.

**Native module note (auto-caption sharing — April 27, 2026)**
The auto-caption flow uses `react-native-share`, a native module that does NOT run in Expo Go. The project already depends on `react-native-iap`, `react-native-google-mobile-ads`, and `@react-native-google-signin/google-signin` — also native-only — so we were already on a custom dev-client build. The Metro dev server in this repl bundles JS as before; the native module loads at runtime in the user's APK. NEXT APK BUILD (EAS or local prebuild) autolinks `react-native-share` automatically — no manual linking, no `eas.json` changes, no breaking config edits. If auto-caption ever degrades, the silent clipboard copy + expo-sharing fallback both still work.

## Documentation Sync (April 22, 2026)
All user-facing legal/help docs updated to match the actual codebase:
- **In-app screens** (`app/guide.tsx`, `app/privacy.tsx`, `app/terms.tsx`): app version 1.3.7, correct Reward Ladder (3/10/50/100/500 → 2d/1w/1mo/3mo/548d, stacking), new Influencer / Giveaway Codes section, SAF-only permissions list with explicit blocked READ_MEDIA_* perms, unified refund policy (Play Store vs Razorpay), system-driven theme.
- **Web templates** (`server/templates/privacy-policy.html`, `terms.html`): same content; CSS bug in `.badge` fixed; sections renumbered (privacy ends at §13, terms ends at §16). Landing & pricing pages required no doc changes.

## Recent Bug Fixes — Subscription Flow
- `ReferralCodeInput.tsx`: detects HTML response bodies (`<!DOCTYPE`, `<html>`) on error and shows a clean "couldn't reach server" message instead of dumping raw HTML; clears code & banner when `hasActiveSubscription` flips true; refuses to fire the redeem request at all when user is already Pro.
- When a giveaway code returns `CODE_EXHAUSTED`, the banner now offers a CTA pivot to `/invite` ("Invite 3 friends instead → 48 hours of Pro free").
- `app/subscription.tsx` hero & active-Pro `LinearGradient`s are now derived from the active palette (`COLORS.PRIMARY` tint over `COLORS.SURFACE`) so they render correctly in light mode.

## SAF Latency / Freeze Fix (April 27, 2026)
After grant or cold launch on Android 11+, the app used to freeze for 1-2 s
before showing thumbnails, and the first video tap stalled for 200 ms-2 s
on a defensive SAF→cache copy. Comprehensive fix landed across four files:

1. **Direct `content://` playback** (`app/viewer.tsx`,
   `contexts/MediaContext.tsx::prepareStatusForViewing`) — the viewer now
   feeds SAF `content://` URIs straight to ExoPlayer / `expo-image`. The
   previous "copy to `view_*` cache file then play" path is GONE for the
   normal viewing flow. A 2.5 s watchdog inside the source-loading effect
   copies + re-feeds the player only on the rare OEM where direct
   playback stalls. The cache copy still runs on demand for sharing
   (`Sharing.shareAsync` requires a `file://` URI).
2. **Persistent resolved-URI cache** (`STORAGE_KEYS.RESOLVED_URIS`) — the
   in-memory `grantedUri → .Statuses URI` map is now mirrored to
   AsyncStorage and rehydrated on launch. Cold starts skip the BFS crawl
   that previously cost 200-1500 ms.
3. **Persistent statuses snapshot** (`STORAGE_KEYS.STATUSES_CACHE`) — the
   last successful `statuses[]` (top 200) is cached and replayed on the
   very next cold launch, so the grid renders thumbnails INSTANTLY while
   the fresh SAF read runs in the background.
4. **`pollUntil` polling helper** — replaces the hardcoded
   `setTimeout(700)` + `setTimeout(1300)` + `setTimeout(1000)` retry
   chains in `requestSAF` and `loadStatuses`. Returns as soon as items
   appear (warm runs cost ~0 extra ms; cold runs back off up to 4 s).
5. **Single-thread copy queue** (`enqueueCopy`) — share-time SAF copies
   are serialized so concurrent prepares can never fight each other for
   I/O bandwidth.
6. **`expo-file-system` /legacy retained** — modern File / Directory /
   Paths API in v19 does not yet expose StorageAccessFramework. The
   import stays on `/legacy` with a top-of-file comment explaining why;
   migration will revisit when SAF lands on the modern API.
7. **"Scanning statuses…" label** — `LoadingShimmer` accepts an optional
   `label` prop and Home renders it during `isGrantingAccess` so the
   first-grant wait feels intentional rather than frozen.

## Production Hardening — Critical Checks (April 27, 2026)
After the SAF latency fix landed, the next round addressed the seven
production-readiness items: persisted URI lifetime, cache invalidation,
OEM playback resilience, FD discipline, share-temp hygiene, telemetry,
and Expo migration trajectory.

### What changed
1. **Persisted URI permission — confirmed via native source.** Audited
   `node_modules/expo-file-system/android/.../FilePickerContract.kt` and
   `FileSystemLegacyModule.kt` — both call
   `ContentResolver.takePersistableUriPermission()` with
   `FLAG_GRANT_READ_URI_PERMISSION` immediately before
   `requestDirectoryPermissionsAsync` resolves. Grants survive app kill,
   reboot, and process death. The behavior is now documented in a comment
   above the call site so future maintainers don't second-guess it.
2. **Cache invalidation pass.** `loadStatusesCache` now kicks off a
   background validation pass after first paint. It runs `getInfoAsync`
   on each cached entry, drops anything that's missing or zero-byte
   (typical of a status that was 24 h-deleted by WhatsApp), and patches
   state — but only if a fresh SAF read hasn't already replaced it. The
   user never sees a broken thumbnail; the fresh scan still runs in
   parallel and remains authoritative.
3. **Tap-to-retry video fallback** (`app/viewer.tsx`). The
   `statusChange` listener now detects `status === 'error'` and surfaces
   a centered "Tap to retry" button with a translucent backdrop. Tapping
   it forces a SAF→cache copy via the existing serialized queue and
   re-feeds the player from the file:// URI. Recovers playback on every
   OEM ExoPlayer build we've tested where the watchdog window is too
   short. The 2.5 s watchdog still fires first for the silent path; the
   button is the explicit-user-action backstop.
4. **FD discipline — already shipped.** Verified that only the ACTIVE
   slot mounts a `<VideoView>` (prev/next stay sourceless), so we never
   exceed 1 hardware decoder + 0-1 cached file handles per swipe.
   `player.release()` runs on unmount, freeing the codec slot
   immediately. No additional work needed for the FD ceiling.
5. **Share-temp cleanup after `Sharing.shareAsync`.** The `share_*` file
   used for a particular share is now scheduled for deletion 5 s after
   the share sheet returns (covers receivers that defer reads).
   Combined with the existing 10-swipe / cold-start sweepers, temp files
   no longer accumulate beyond a single share's lifetime in the worst
   case.
6. **Telemetry primitives.** Three lightweight counters now live at
   module scope in `MediaContext.tsx`, persisted to AsyncStorage on a
   2 s debounce so writes never block the JS thread:
   - `safMountTimesMs[]` — rolling 50-sample window of grant/load times
     (logged at both `pollUntil` sites).
   - `directPlaySuccess` — incremented on the FIRST `readyToPlay` per
     `content://` source.
   - `fallbackCopyTriggered` — incremented when the watchdog or the
     manual retry copies a stalled video.
   Inspect via `getTelemetrySnapshot()` (exported from `MediaContext`).
   The snapshot includes a derived `directPlaySuccessRate` so you can
   see at a glance whether the 2.5 s watchdog is over- or under-tuned
   for real-world devices.
7. **Expo file-system migration trajectory.** Comment at the top of
   `MediaContext.tsx` already documents that the modern File / Directory
   / Paths API in v19 lacks SAF parity; revisit when Expo v30 lands and
   re-evaluate after each minor SDK bump. No code change needed yet.

### QA checklist (manual, on real Android devices)
- Cold start on Android 11 / 12 / 13 / 14 — cached grid renders before
  fresh SAF read returns.
- Kill app mid-swipe → relaunch → cached thumbnails appear instantly.
- Play 15+ statuses in rapid succession — no FD leaks (logcat clean).
- Revoke SAF permission in OS settings → reopen — graceful re-prompt.
- After share, verify `share_*` file in app's cache dir is gone within
  ~10 s.
- Force a bad source (e.g. revoke mid-playback) — retry overlay shows;
  tapping it recovers.

## To Publish
1. Replace AdMob unit IDs in `constants/admob.ts`
2. Update `app.json` with your actual bundle ID
3. Build with `eas build --platform android`

## Workflows
- **Start Frontend**: Expo dev server on port 8081
- **Start Backend**: Express server on port 5000 (landing page)
