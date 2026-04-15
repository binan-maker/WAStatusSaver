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
app/
  _layout.tsx          # Root layout with fonts, providers
  (tabs)/
    _layout.tsx        # Tab bar (3 tabs)
    index.tsx          # Statuses home
    saved.tsx          # Saved gallery
    settings.tsx       # Settings
  viewer.tsx           # Fullscreen viewer
  permissions.tsx      # Permission setup
  guide.tsx            # User guide
  privacy.tsx          # Privacy policy

components/
  AdBanner.tsx         # Banner ad placeholder
  AdInterstitial.tsx   # Interstitial ad modal
  EmptyState.tsx       # Empty state UI
  LoadingShimmer.tsx   # Skeleton loading
  MediaCard.tsx        # Image/video grid card

contexts/
  MediaContext.tsx     # Core media state management

constants/
  colors.ts            # Theme colors
  theme.ts             # Spacing, typography, layout
  admob.ts             # AdMob unit IDs (replace before publish)
server/
  payment-routes.ts    # Razorpay + Firestore payment endpoints
  firebase-admin.ts    # Firebase Admin initialization
shared/
  subscription-plans.ts # Shared subscription plan definitions
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
