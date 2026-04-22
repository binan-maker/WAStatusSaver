[x] DUAL-STORE PAYMENT ARCHITECTURE FIXED:
  - google-play/index.ts: removed server-route export (was causing Metro to bundle firebase-admin → fs crash)
  - metro.config.js: added blockList for server/, payment-providers/server routes (prevents any server-only code from entering RN bundle)
  - server/firebase-admin.ts: deleted duplicate (canonical copy kept at server/config/firebase-admin.ts)
  - hooks/useSubscriptionStatus.ts: converted to thin re-export wrapper of hooks/subscription/useSubscriptionStatus.ts (provider-agnostic, uses payment-providers/ abstraction, no hardcoded Razorpay/Google Play if/else)
  - payment-providers/index.ts: Razorpay active for Indus/other stores; Google Play commented out for Play Store (flip 2 lines to switch — NO if/else in runtime code)
  - payment-providers/server.ts: same switch pattern on server side
  - privacy-policy.html: now covers both Razorpay (Indus/other) and Google Play Billing (Play Store) in sections 2, 3, 4, and 5
[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] RE-IMPORT: npm install completed; both Start Backend (port 5000) and Start Frontend (Metro) workflows running.
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
[x] REPLIT MIGRATION - Resolved git merge conflicts in app.json (kept versionCode 38 + blockedPermissions from HEAD). Installed missing packages (cross-env, tsx, expo, @expo/cli). Both backend (port 5000) and Expo Metro bundler are running successfully.
[x] DEEP SAF FIX - Three-layer fix for persistent "no statuses" even after refresh and app cache clear:
  - Root cause 1: SAF_INITIAL_URIS pointed to hidden .Statuses folder — Android ignores hints to hidden directories on many devices. Changed to point to the non-hidden WhatsApp/Media folder which all devices honor reliably.
  - Root cause 2: Destructive error handler in readFromSAF permanently deleted the SAF URI from AsyncStorage on ANY exception (timing errors, first mount, etc.) forcing user to re-grant forever. Now just logs the error and returns [] — permissions are never touched on failure.
  - Root cause 3: BFS couldn't find .Statuses if the OS didn't list it as a child (hidden folder not visible in directory listings on some Android versions). Added direct child URI construction using Android's tree+document format — bypasses the listing entirely and accesses .Statuses by building its URI directly from the granted tree.
  - resolveStatusesUri now returns null (instead of the wrong folder) on full failure, so readFromSAF knows to return [] rather than reading the wrong folder and silently getting no valid files.
[x] REFRESH BUTTON + PERSISTENT EMPTY STATE FIX - Fixed two critical bugs that caused images/videos to never appear after granting permission:
  - Root cause: resolveStatusesUri was caching FAILED BFS results (when .Statuses wasn't found on first try due to mount lag). Every subsequent call (including refresh button) hit the stale cache and returned the wrong folder forever — only a full app restart cleared the in-memory cache.
  - Fix 1: Removed the fallback cache.set() — BFS failures are never cached, so the next call always retries the full folder walk.
  - Fix 2: refresh() now clears the entire BFS cache before loading — the refresh button always re-walks the folder tree fresh.
  - Fix 3: loadStatuses() auto-retries once (after 1 second) if SAF URIs are present but 0 items are returned — handles the app-reopen scenario where the indexer is still slow.
[x] DUAL-STORE PAYMENT SPLIT - Razorpay (Indus App Store) and Google Play Billing fully separated into payment-providers/razorpay/ and payment-providers/google-play/. Switch by editing 2 lines in payment-providers/index.ts + payment-providers/server.ts, then deleting the unused folder. Firebase UID used as subscription key in both providers for cross-device access.
[x] RE-IMPORT MIGRATION COMPLETE - npm install succeeded, both Start Backend (port 5000) and Start Frontend (Metro) workflows running cleanly.
[x] THEME ROLLOUT COMPLETED - Resolved unmerged conflict in app/_layout.tsx (kept ThemeProvider wrapping). Fixed `ReferenceError: COLORS` in app/guide.tsx by using TagColorKey strings + resolving against active palette in render. Migrated remaining static `import COLORS from "@/constants/colors"` files (app/signin.tsx, app/subscription.tsx, components/subscription/SubscriptionPlansCard.tsx) to `useThemeColors()` + `createStyles(COLORS)` pattern so dark/light theme switching works app-wide. Bumped tab bar TAB_HEIGHT 54 → 64 so the in-app nav bar is no longer collapsed against the device system bar.
[x] RE-IMPORT MIGRATION 2026-04-22 - npm install completed; both Start Backend (port 5000) and Start Frontend (Metro bundler) running cleanly.
[x] SAF FIRST-GRANT BUG FIX - Fixed the "dead home page after granting folder permission" bug with 4 layered fixes:
  - Graceful Delay: 700ms settling wait after user taps "Use this folder" before reading SAF folder (Android SAF mount lag fix)
  - Auto-Retry: If 0 items found after settling delay, automatically retries once after 1.3s (Android hidden folder indexer delay fix)
  - isGrantingAccess state: New state flag keeps UI in shimmer/loading mode during entire grant+read cycle, so empty state NEVER flashes (race condition fix)
  - BFS Cache Clear: resolvedUriCache is invalidated on each new grant so fresh path resolution always runs (stale path trap fix)
  - Also resolved remaining git merge conflicts in MediaContext.tsx and index.tsx
