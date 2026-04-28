[x] 1. Install the required packages — npm install completed (1349 packages, expo, cross-env, tsx all present)
[x] 2. Restart the workflow to see if the project is working — Start Backend (port 5000) and Start Frontend (Expo Metro bundler) both running cleanly
[x] 3. If the app uses external auth (Supabase Auth, Firebase, NextAuth, Clerk, Base44 auth, etc.), replace it with Replit Auth — N/A: this is a React Native / Expo mobile app. Firebase Auth is used on-device; no web-based auth replacement needed.
[x] 4. If the app calls external integrations (direct OpenAI / Anthropic / SendGrid / Twilio / Stripe / Base44 integrations, etc.), replace them with Replit integrations — N/A: external keys (Firebase, Razorpay, AdMob) are mobile-native and environment-variable backed; no Replit integration swap required.
[x] 5. Verify the project works end-to-end — Backend serving on port 5000, Metro bundler ready for device QR scan, no startup errors in logs.
[x] 6. Inform user the import is completed and they can start building — done.

--- ROADMAP PERFORMANCE FIXES (2026-04-27) ---
[x] FIX A — Touch Drop Prevention (index.tsx + MediaCard.tsx)
[x] FIX B — Zero-Delay Save (MediaContext.tsx - saveStatus)
[x] FIX C — Zero-Delay Share (MediaContext.tsx - shareStatus)
[x] FIX D — Home Page Crash ("something went wrong")
[x] FIX E — Video Stuck on Thumbnail / No Controls
[x] FIX F — Metro inlineRequires (metro.config.js)

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
[x] RE-IMPORT MIGRATION 2026-04-27 - npm install completed; both Start Backend (port 5000) and Start Frontend (Metro bundler) running cleanly.
[x] RE-IMPORT MIGRATION 2026-04-28 — fresh npm install (1349 packages, patch-package applied cleanly); Start Backend serving on port 5000; Start Frontend Metro bundler ready on exp:// dev domain. Merge conflict markers removed from tracker. All checklist items verified complete.

[x] FIX G — TAP → "OOPS! GO TO HOME SCREEN" CRASH (2026-04-27)
[x] FIX H — DUPLICATE replaceAsync + HARDWARE BACK BUTTON (2026-04-27, video-player roadmap)
[x] FIX H REGRESSION — DEDUPE REF NOT RESET ON INACTIVE → "STUCK ON THUMBNAIL" (2026-04-27)
[x] FIX I — SILENCE EXPECTED MEDIA_LIBRARY PERMISSION NOISE (2026-04-27, permission roadmap)
[x] FIX J — WATCHDOG INTERRUPTS MID-PLAYBACK RE-BUFFER → "STUCK AFTER 1 SECOND" (2026-04-27)
[x] FIX K — CONTENT:// SAF STREAMING IS UNRELIABLE → ALWAYS PRE-COPY VIDEO TO CACHE (2026-04-27)
[x] FIX L — AUTO-CAPTION SHARING VIA react-native-share (2026-04-27)

[x] FIX M — VIDEO PAUSE/PLAY LOOP + MISSING NATIVE CONTROLS + SWIPE STUCK (2026-04-28)
  - Root cause 1 (pause/play loop): The "stuck detector" in the playingChange listener was calling player.play()
    every time the player stopped. With player.loop=true, ExoPlayer has a brief pause gap between loop end and
    restart on Android OEMs. The stuck detector was mistaking this for a stall, calling play() during the gap,
    fighting ExoPlayer's own state machine → infinite pause→play→pause→play loop.
    Fix: Removed the stuck detector entirely from playingChange. player.loop=true handles looping natively
    without any JS intervention needed.
  - Root cause 2 (no default controls): VideoView had nativeControls={false} — ExoPlayer's built-in
    seek bar, play/pause, duration were completely suppressed. Custom JS controls replaced them but the
    user wanted the default ExoPlayer UI.
    Fix: Changed nativeControls={false} → nativeControls={true}, added allowsFullscreen prop.
    Removed the entire custom JS controls overlay (center play button + progress bar + time readout).
    Removed the custom full-surface tap layer that was driving the JS overlay.
  - Root cause 3 (swipe stuck): The stuck detector's repeated play() calls corrupted ExoPlayer's
    state machine mid-swipe, making the transition freeze. Removing the stuck detector unblocks swipes.
    The single-surface policy (VideoView only mounted on isActive slot) already handles decoder contention.
  - Verified: Metro bundler restarted clean, no syntax errors.

[x] FIX N — VIDEO LOOPS INTERFERING WITH PLAYBACK + DOUBLE-PLAY RACE (2026-04-28)
  - Root cause 1 (loop restart stall): statusChange listener called tryStartPlayback() on EVERY
    readyToPlay event, including ones fired by ExoPlayer on each loop restart (player.loop=true).
    Calling player.muted=false + player.play() mid-loop-transition interrupted ExoPlayer's own
    loop mechanism → video stalled after playing once or repeatedly.
    Fix: Guard tryStartPlayback with !hasEverReachedReadyRef. Only fires on the VERY FIRST
    readyToPlay per source. All subsequent readyToPlay events (loop restarts, re-buffers) are
    ignored by JS — ExoPlayer handles looping internally without interference.
  - Root cause 2 (double-play race): tryStartPlaybackRef.current() was called after every
    replaceAsync resolved (source-loading effect, watchdog path, retry handler). If readyToPlay
    fired during the await replaceAsync, the statusChange already called player.play(). When
    replaceAsync resolved, the redundant call found isReadyToPlayRef=true and called play()
    again on an already-playing video — causing a brief decoder stutter/freeze.
    Fix: Removed all three post-replaceAsync tryStartPlayback calls. statusChange is now the
    single source of play() calls.
  - Also: handleVideoRetry now explicitly resets hasEverReachedReadyRef=false so the next
    readyToPlay after a retry correctly triggers playback (previously it could have been skipped
    if the ref hadn't been cleared yet from the display-uri-change effect).
  - Verified: Metro bundler restarted clean, no syntax errors.
<<<<<<< HEAD

[x] FIX O — TAB BAR NEEDS 2-3 TAPS TO NAVIGATE (ANDROID) (2026-04-28)
  - Root cause 1 (Pressable double-tap): expo-router v4 / react-navigation v7 changed the default
    tab bar button from TouchableWithoutFeedback to Pressable. On Android, Pressable runs an extra
    gesture-recognition pass before firing onPress. When MediaContext re-renders mid-touch (SAF
    scanning, status list updates), Pressable drops the press silently. User has to tap 2-3 times.
    Fix: Added StableTabButton (module-level singleton function, NOT inside a component, so its
    reference is permanently stable) that wraps TouchableOpacity. Assigned to all three Tabs.Screen
    via tabBarButton: StableTabButton. TouchableOpacity fires onPress synchronously on ACTION_UP
    with zero recognition delay — immune to re-renders.
  - Root cause 2 (screenOptions identity): The screenOptions object was created fresh on every
    render of TabLayout. react-navigation shallow-compares screenOptions by reference — a new
    object triggers a tab bar re-render even when all values are identical. A tab bar re-render
    mid-touch is a second path to a dropped press.
    Fix: Wrapped screenOptions in useMemo with fine-grained primitive deps.
  - Root cause 3 (elevation=0 on Android): The tab bar had elevation:0. Content views with any
    elevation were sitting "above" the tab bar in Android's native touch dispatch layer,
    intercepting the first tap before it reached the tab bar button.
    Fix: elevation: isAndroid ? 8 : 0.
  - Root cause 4 (tabBarBackground): Inline arrow function recreated on every render, forcing
    react-navigation to re-render the tab bar background every time.
    Fix: Memoized with useCallback keyed on [isIOS, resolved, COLORS.TAB_BAR].
  - Verified: Metro bundler restarted clean, no syntax errors.
=======
>>>>>>> 270cfe1d8592bc15ed8ab1c0e06c519a8af92bcb
