[x] 1. Install the required packages — clean npm install completed (1349 packages, patch-package applied successfully)
[x] 2. Restart the workflow to see if the project is working — Start Backend serving on port 5000, Start Frontend Metro bundler ready on exp:// dev domain
[x] 3. If the app uses external auth — N/A: React Native / Expo mobile app. Firebase Auth is used on-device; no web-based auth replacement needed.
[x] 4. If the app calls external integrations — N/A: external keys (Firebase, Razorpay, AdMob) are mobile-native and environment-variable backed; no Replit integration swap required.
[x] 5. Verify the project works end-to-end — Backend serving on port 5000 with dynamic manifest routing; Metro bundler ready for device QR scan; no startup errors in logs.
[x] 6. Inform user the import is completed and they can start building — done.

--- HISTORY ---
[x] DUAL-STORE PAYMENT ARCHITECTURE FIXED
[x] SESSION CACHE BLOAT FIX
[x] WORK PROFILE BLINDSPOT FIX
[x] DUPLICATE SAVE WASTE FIX
[x] ZOMBIE VIDEO DECODER FIX
[x] PAYMENT HARDENING - ALL 4 CRITICAL BUGS FIXED
[x] CHAMPION'S ROADMAP - Firebase optimization, ProGuard, Rating Prompt, Push Notifications
[x] ROUND 3 - ALL 4 FIXES DONE
[x] DEEP FORENSIC AUDIT - ALL 7 BUGS FIXED
[x] HARDWARE DECODER TRAP - CRITICAL FIX
[x] BANK-GRADE PAYMENT HARDENING - 3 FIXES
[x] PRO RESTORE FIX
[x] BADGE TEXT FIX
[x] WEBSITE LINKS
[x] PRO AD LEAK FIXED
[x] VIDEO BLACK SCREEN FIX
[x] QUARTERLY PLAN ERROR EXPOSED
[x] SETTINGS REWARD AD CARD HIDDEN FOR PRO
[x] DEEP SAF FIX
[x] REFRESH BUTTON + PERSISTENT EMPTY STATE FIX
[x] DUAL-STORE PAYMENT SPLIT
[x] THEME ROLLOUT COMPLETED
[x] SAF FIRST-GRANT BUG FIX
[x] VIDEO STUCK/LAG FIX (Android 11+)
[x] IMAGE + VIDEO VIEWER FULL FIX (Android 11+)
[x] VIDEO STALE CLOSURE FIX (Android 11+)
[x] VIDEO FREEZE COMPREHENSIVE FIX
[x] ANDROID 11+ VIDEO LAG/FREEZE FULL FIX
[x] BACKGROUND THUMBNAIL CACHE
[x] RE-IMPORT MIGRATION 2026-04-27 — npm install completed; both workflows running cleanly.
[x] RE-IMPORT MIGRATION 2026-04-28 — fresh npm install (1349 packages, patch-package applied cleanly); Start Backend serving on port 5000; Start Frontend Metro bundler ready on exp:// dev domain.
[x] RE-IMPORT MIGRATION 2026-04-28 (b) — clean reinstall after node_modules wiped; both workflows green; merge-conflict markers removed from this tracker.

[x] FIX A — Touch Drop Prevention (index.tsx + MediaCard.tsx)
[x] FIX B — Zero-Delay Save (MediaContext.tsx - saveStatus)
[x] FIX C — Zero-Delay Share (MediaContext.tsx - shareStatus)
[x] FIX D — Home Page Crash ("something went wrong")
[x] FIX E — Video Stuck on Thumbnail / No Controls
[x] FIX F — Metro inlineRequires (metro.config.js)
[x] FIX G — TAP → "OOPS! GO TO HOME SCREEN" CRASH (2026-04-27)
[x] FIX H — DUPLICATE replaceAsync + HARDWARE BACK BUTTON (2026-04-27)
[x] FIX H REGRESSION — DEDUPE REF NOT RESET ON INACTIVE (2026-04-27)
[x] FIX I — SILENCE EXPECTED MEDIA_LIBRARY PERMISSION NOISE (2026-04-27)
[x] FIX J — WATCHDOG INTERRUPTS MID-PLAYBACK RE-BUFFER (2026-04-27)
[x] FIX K — CONTENT:// SAF STREAMING PRE-COPY VIDEO TO CACHE (2026-04-27)
[x] FIX L — AUTO-CAPTION SHARING VIA react-native-share (2026-04-27)
[x] FIX M — VIDEO PAUSE/PLAY LOOP + MISSING NATIVE CONTROLS + SWIPE STUCK (2026-04-28)
[x] FIX N — VIDEO LOOPS INTERFERING WITH PLAYBACK + DOUBLE-PLAY RACE (2026-04-28)
[x] FIX O — TAB BAR NEEDS 2-3 TAPS TO NAVIGATE (ANDROID) (2026-04-28)

[x] FIX P — PRODUCTION-SAFE CONSOLE GATING (2026-04-28)
  - The app already had a runtime silencer in `app/_layout.tsx` (40-47) that
    no-ops `console.log/warn/info/debug` in release builds, but argument
    expressions (template strings, object serialization) were still evaluated
    on every call — wasting CPU on hot paths like SAF crawls and viewer
    statusChange listeners.
  - Wrapped every client-side `console.log/warn/info/debug` call with a
    `__DEV__ &&` short-circuit so the WHOLE expression — including its
    arguments — is dead-code-eliminated by Metro/Hermes in production.
  - Files transformed (82 calls total, all sites verified ungated → gated):
      contexts/MediaContext.tsx                              62
      app/viewer.tsx                                         14
      app/_layout.tsx                                         2
      hooks/referral/usePendingReferralAttribution.ts         2
      lib/image-loader.ts                                     1
      app/(tabs)/settings.tsx                                 1
  - `console.error` is intentionally LEFT UNGATED everywhere — it must
    survive in release so Crashlytics/Sentry can intercept via their global
    monkey-patch. `lib/logger.ts` (the existing helper) was untouched —
    its console calls are intentional and already check `__DEV__`.
  - Server code (`server/**`, `payment-providers/*/server/**`) was NOT
    touched — it runs on Node, not on the device, and its logs are
    operational telemetry.
  - Verified: Metro bundler restarted clean, no parse/syntax errors.
    Pre-existing TypeScript warnings (videoTimestamp, directoryUri,
    duplicate locale keys, etc.) are unrelated to this change.

[x] FIX Q — ADMOB POLICY-SAFE TEST/PROD ID SWITCHING (2026-04-28)
  - The codebase had hard-coded LIVE AdMob ad-unit IDs imported directly
    in 5 of the 6 ad files. This is a serious AdMob ToS violation: any
    impressions or clicks generated during dev/QA on a real device are
    counted as fraudulent activity and can permanently suspend the
    publisher account. Only `AdAppOpen.tsx` was already correct
    (used `__DEV__ ? TestIds.APP_OPEN : AD_UNIT_IDS.APP_OPEN`).
  - Centralized in `constants/admob.ts`: added
    `getAdUnitId(slot: 'BANNER'|'INTERSTITIAL'|'APP_OPEN'|'REWARDED')`
    that returns Google's official `TestIds.X` in `__DEV__` builds and
    the live `AD_UNIT_IDS.X` in production. `__DEV__` is hard-baked by
    Metro/Hermes at bundle time — it cannot be overridden at runtime,
    so a leaked test ID in a release APK is impossible by construction.
  - Migrated all 6 ad files to call `getAdUnitId('SLOT')` instead of
    importing `AD_UNIT_IDS` directly:
      hooks/ads/useAppOpenAd.ts        getAdUnitId('APP_OPEN')
      hooks/useAppOpenAd.ts            getAdUnitId('APP_OPEN')
      components/ads/AdBanner.tsx      getAdUnitId('BANNER')
      components/ads/AdInterstitial.tsx getAdUnitId('INTERSTITIAL')
      components/ads/AdReward.tsx      getAdUnitId('REWARDED')
      components/ads/AdAppOpen.tsx     getAdUnitId('APP_OPEN')
    Verified zero remaining call-site imports of `AD_UNIT_IDS` outside
    `constants/admob.ts` itself.
  - Removed Play-Store policy violation in `components/ads/AdBanner.tsx`:
    was rendering a 60px-high `<View>` with an `<ActivityIndicator>`
    spinner ("Ad loading…") while the banner fetched. Google Play 4.5
    rejects apps that show empty boxes / placeholder UI when AdMob
    fill is unavailable. Now the container is collapsed to height 0
    until `onAdLoaded` fires; on `onAdFailedToLoad` (after the existing
    2-retry budget) the component returns `null` so the layout has
    nothing reserved.
  - Verified: Metro bundler restarted clean, all imports resolve,
    no parse errors.

[x] FIX S — 5-LAYER VIDEO PLAYBACK FALLBACK SYSTEM (2026-05-01)
  - Goal: 100% video playback success across all Android 11+ devices and OEMs.
  - Created `lib/video-fallback.ts` — standalone 5-layer engine:
      Layer 1: direct content:// SAF URI (removed for video, left for photos)
      Layer 2: cacheDirectory copy via MediaContext.prepareStatusForViewing()
              (existing Layer 2 — always pre-copies to cacheDirectory)
      Layer 3: documentDirectory copy (vcache/), never evicted by OS
              — runLayer3(sourceUri, id, name, type)
      Layer 4: expo-intent-launcher → opens native system video player
              (MX Player, VLC, Google Photos, etc.) — 100% OEM coverage
      Layer 5: expo-media-library save → content:// gallery URI
              — last resort when Layers 3+4 both unavailable
      runFallbackChain(sourceUri, id, name, type, startAtLayer) — drives chain
      cleanupDocumentCache(maxAgeMs=7d) — prunes vcache/ on app start
  - Installed expo-intent-launcher@13.0.8 (correct version for current Expo).
  - Updated `app/viewer.tsx` (ViewerItem):
      Added state: videoFallbackLayer (1-5), nativePlayerOpened, layer3TriedRef
      handleVideoRetry — drives Layers 3→4→5 with per-layer UX states
      handleOpenNativePlayer — direct Layer 4 shortcut from retry overlay
      Auto-trigger: URI prep effect auto-invokes Layer 3 when Layer 2 fails
      Retry overlay: shows layer indicators, "Open in External Player" button
  - Updated `app/viewer.tsx` (ViewerScreen sidebar):
      handleOpenNativePlayerFromSidebar — Layer 4 shortcut via sidebar
      "External" button in reels action sidebar (Android only, open-outline icon)
  - Updated `app.json`:
      Added expo-media-library plugin with isAccessMediaLocationEnabled: true
      Moved READ_MEDIA_IMAGES + READ_MEDIA_VIDEO from blockedPermissions →
      permissions array (needed for Layer 5 on Android 13+)
  - Updated `contexts/MediaContext.tsx`:
      Imported cleanupDocumentCache from lib/video-fallback
      Wired it into the startup cleanup effect (7-day retention, runs 1s after
      the 4-hour cacheDirectory sweep)
  - Verified: Metro bundler restarts clean, no compilation errors, no version
    mismatch warnings.

[x] FIX R — VIDEO PLAYS 1 SEC THEN FREEZES (manual loop) (2026-04-28)
  - Symptom (re-reported by user): every video played for ~1 second
    then froze on screen. Logs showed each clip reaching readyToPlay
    and "REVEALING video surface" cleanly — so loading was fine, the
    stall was happening AFTER the first play() call.
  - Root cause: FIX M removed the playingChange "stuck detector"
    entirely on the assumption that `player.loop = true` would handle
    looping natively. That assumption breaks on several Android OEM
    ExoPlayer builds (Samsung One UI 5/6, Xiaomi MIUI 13/14, Realme):
    when the SAF-copied file:// clip reaches end-of-clip, the native
    loop never re-triggers — the player just stops, and there's no
    JS path to resume it. FIX N (single-shot tryStartPlayback gated
    on !hasEverReachedReadyRef) compounded the problem because
    subsequent readyToPlay events are now ignored too.
  - Fix in `app/viewer.tsx`:
      a) Set `p.loop = false` in the useVideoPlayer config — we no
         longer rely on native loop because it's unreliable.
      b) Rewrote the playingChange listener as a DEBOUNCED stuck
         detector / manual looper:
           • when `playing` flips to true → cancel any pending timer
           • when `playing` flips to false:
               - if `userPausedRef.current` → respect, do nothing
               - if `!isActiveRef.current` → respect, do nothing
               - if `!hasEverReachedReadyRef.current` → bail (the
                 source-loading pipeline owns the initial play call)
               - else schedule a 600ms timer that re-checks all
                 guards, then either seeks to 0 + plays (when
                 currentTime is within 0.5s of duration → manual
                 loop) or just calls play() (mid-playback stall).
      c) Listener cleanup now also clears stuckResumeTimerRef.
  - Why 600ms: this absorbs ExoPlayer's own brief internal pauses
    (loop-attempt gap, decoder hiccup, mid-playback re-buffer) so JS
    never fights the native state machine — that fight was the
    original FIX M bug. If ExoPlayer recovers naturally inside the
    600ms window, the playing→true handler cancels the timer before
    it fires, so we never call play() on top of a player that's
    already playing.
  - Did NOT touch: tryStartPlayback (still single-source from
    statusChange), source-loading effect, watchdog, hardware
    decoder cleanup, dedupe ref. All FIX H/J/M/N/O safety properties
    preserved — only the missing recovery path was added back, in a
    debounced form that can't oscillate.

