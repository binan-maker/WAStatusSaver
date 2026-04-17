[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] FIX 1 - SESSION CACHE BLOAT: cleanupCacheFiles now accepts a maxAgeMs param; onImageSwipe runs a 30-min light cleanup every 10 swipes in the background
[x] FIX 2 - WORK PROFILE BLINDSPOT: requestSAF accepts manual=true param; permissions screen shows "Using dual WhatsApp or Work Profile? Browse manually" dashed button that opens SAF picker at storage root
[x] FIX 3 - DUPLICATE SAVE WASTE: saveStatus checks savedItems for matching id OR filename before copying; returns true immediately if file already exists, preventing gallery duplicates
[x] FIX 4 - ZOMBIE VIDEO DECODER: ViewerItem unmount useEffect calls player.replaceAsync(null) to explicitly release the hardware decoder when the viewer closes
[x] PAYMENT HARDENING - ALL 4 CRITICAL BUGS FIXED
[x] CHAMPION'S ROADMAP - Firebase optimization, ProGuard, Rating Prompt, Push Notifications
[x] ROUND 3 - ALL 4 FIXES DONE:
  - expo-video-thumbnails REMOVED from package.json and MediaCard.tsx. expo-image (Glide) renders the first frame natively.
  - Video black screen initially FIXED with always-mounted VideoView + thumbnail overlay.
  - Image zoom REBUILT with GestureDetector + Reanimated: pinch-to-zoom 6x, pan when zoomed, double-tap 2.5x, single-tap toggles controls.
  - Firebase cost SLASHED: smart cache TTL (6h Pro / 30m Free), polling extended to 30 min.
[x] DEEP FORENSIC AUDIT - ALL 7 BUGS FIXED:
  - Stucky Swipe: removeClippedSubviews={true} in FlatList.
  - Laggy Toggle: doubleTap maxDuration 250ms → 200ms.
  - Ghost Pro: paidUntil expiry check in cache guard AND cold-start restore.
  - One-Time Rating: modulo check (% 10), "Never" is the only permanent dismissal.
  - Dead Clipboard: expo-clipboard replaces deprecated react-native Clipboard.
  - Dead Weight: expo-video-thumbnails removed from package.json.
[x] HARDWARE DECODER TRAP - CRITICAL FIX:
  - VideoView is now conditionally rendered only when isNearActive (max 3 surfaces live at once: prev/current/next).
  - Thumbnail Overlay pattern: thumbnail always shown on top until readyToPlay fires — no black flash during decoder warmup.
  - Existing replaceAsync(null) calls in player sync effects ensure decoder is released when isNearActive → false.
[x] BANK-GRADE PAYMENT HARDENING - 3 FIXES (2 already done, 3 new):
  - Cross-Device: ALREADY DONE — server already uses authUser.uid as Firestore key, not deviceId.
  - Currency Rounding: ALREADY DONE — amountToPaise() already uses Math.round().
  - Race-Condition Shield (NEW): PAYMENT_INTENT_KEY saved to AsyncStorage BEFORE opening Razorpay checkout. Cleared after Phase 3 saves full pending record. Intent expires after 24h.
  - Intent Recovery (NEW): On startup, if intent exists but no pending record, calls /api/payments/razorpay/recover-order. Server queries Razorpay API directly (no client signature needed), activates subscription, shows "Pro Activated" alert.
  - Webhook Endpoint (NEW): POST /api/payments/razorpay/webhook handles payment.captured server-to-server. Verifies HMAC signature with RAZORPAY_WEBHOOK_SECRET, idempotent (skips already-verified orders), activates subscription even if user's phone is offline.
  - Recover-Order Endpoint (NEW): POST /api/payments/razorpay/recover-order queries Razorpay for captured payments on an order, activates subscription server-side, stamps source="recovery" in payment history.
  - One-time setup needed: Add webhook URL in Razorpay dashboard + set RAZORPAY_WEBHOOK_SECRET env var.
[x] MIGRATION COMPLETE - npm packages installed, backend running on port 5000, Expo Metro bundler running and ready for device scanning
[x] PRO RESTORE FIX - useSubscriptionStatus now triggers refresh(true) whenever user UID changes (sign-in event), restoring Pro status immediately on reinstall/re-login using Firebase UID lookup
[x] BADGE TEXT FIX - Removed maxWidth:90 and numberOfLines={1} from plan badge in subscription.tsx; "Most Popular", "Great Deal", "Best Value" now render fully
[x] WEBSITE LINKS - Added tappable "Read full Privacy Policy online" + "Terms & Conditions" links to bottom of app/privacy.tsx; "Read full Terms online" + "Privacy Policy" links to bottom of app/terms.tsx, opening binan-maker.github.io/StatusVault pages
[x] PRO AD LEAK FIXED - Comprehensive race-condition fix across all 5 ad systems (AppOpen, Interstitial, Banner, Rewarded, AdAppOpen legacy):
  - useFreeAdsState now exposes `loading` flag from subscription check
  - All ad hooks/components block loading AND showing until subscriptionLoading=false
  - Any already-loaded ad singleton is destroyed immediately when Pro is confirmed
  - _layout.tsx sign-in interstitial gated on !isFreeAds && !adsLoading
  - AdReward stops auto-loading for Pro users (SupportDeveloperAd uses customAdUnitId to bypass)
[x] VIDEO BLACK SCREEN FIX - Root cause: 200ms fixed delay fired during screen slide-in animation (~300ms) on tap-to-open. Replaced with InteractionManager.runAfterInteractions + 150ms buffer. Now waits for navigation animation to fully complete before replaceAsync, matching the pre-warmed surface scenario that made swipe work reliably.
[x] QUARTERLY PLAN ERROR EXPOSED - "Server Busy" now shows the actual server error message so root cause of 3-month plan rejection is visible to user when next attempted.
[x] SETTINGS REWARD AD CARD HIDDEN FOR PRO - "Get Free Ads Access" section and RewardAdButton in settings.tsx are now wrapped in {!isSubscribed && ...} so Pro users see a clean settings page with no ad-related prompts.
