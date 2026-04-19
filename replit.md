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
- **Payments**: Razorpay checkout with server-side order creation and signature verification

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
  feedback/                 # AppNotice, MilestoneRatingCard, NoticeBoardCard
  common/                   # AppLoadingScreen, ErrorBoundary, ErrorFallback, KeyboardAwareScrollViewCompat

hooks/                      # Domain-grouped custom hooks
  ads/                      # useAppOpenAd, useFreeAdsState
  subscription/             # useSubscriptionStatus
  feedback/                 # useAppNotice, useMilestoneRating
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
- Required secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON`
- Optional env var: `FIREBASE_PROJECT_ID` if not included in the service account JSON
- Firestore collections used: `subscriptions`, `paymentOrders`, `users/{deviceId}/payments`

## To Publish
1. Replace AdMob unit IDs in `constants/admob.ts`
2. Update `app.json` with your actual bundle ID
3. Build with `eas build --platform android`

## Workflows
- **Start Frontend**: Expo dev server on port 8081
- **Start Backend**: Express server on port 5000 (landing page)
