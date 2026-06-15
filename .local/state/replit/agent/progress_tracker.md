[x] 1. Install the required packages — npm install completed (1105 packages, patch-package applied with 1 warning).
[x] 2. Restart the workflow to see if the project is working — Start Frontend running; Metro bundler ready, QR code visible.
[x] 3. External auth — no external auth present. App is fully offline (Firebase Auth/Google Sign-In were removed in a prior migration).
[x] 4. External integrations — no active external integrations. Firebase, AdMob, Razorpay, Google Play IAP all removed in prior migration. Remaining references are text-only (legal/policy page copy) with no import statements.
[x] 5. Verify the project works end-to-end — Metro bundler running cleanly on exp:// dev domain; all external service imports eliminated; workflows stable.
[x] 6. Import complete — StatusVault is a React Native / Expo Android app. It runs on Replit as a Metro dev server. Scan the QR code in the preview panel with Expo Go on an Android device to test the app.

--- HISTORY ---
[x] FIX X — VIDEO STALL INFINITE LOOP FIX (2026-06-14)
  - Root cause: stallCountRef resets to 0 whenever currentTime briefly advances
      after a stall#1 seek (crossing the +0.05s threshold). This restarted the
      full escalation chain from scratch after every cold restart, creating an
      infinite loop: stall#1→seek→stall#1→stall#2→stall#3→cold restart→repeat.
  - Fix: Added coldRestartCountRef (never reset by progress, only by item change)
      that tracks how many cold restarts have been attempted per item.
      In stall#3 handler: if coldRestartCountRef.current >= 1, skip the cold
      restart and go straight to setVideoError(true) instead of looping.
      After a successful cold restart: coldRestartCountRef.current += 1 BEFORE
      resetting stallCountRef, so the next escalation cycle knows a restart
      was already tried.
  - Reset: coldRestartCountRef.current = 0 only on item.id change (swipe).
  - Result: worst-case flow is now stall#1→seek, stall#2→pause/resume,
      stall#3→cold restart, stall#1→seek, stall#2→pause/resume,
      stall#3→error overlay (6 stall windows ~9s total), then stops.

[x] FIX W — NATIVE JAVA SAF SCANNER — FINAL FREEZE FIX (2026-06-14)
[x] FIX V — REMOVE IN-APP VIDEO PLAYBACK ON ANDROID 11+ (2026-05-01)
[x] FIX U — STATUS BAR, BLINKING & PERFORMANCE FIXES (2026-05-01)
[x] FIX T — HARDWARE DECODER STALL ESCALATION (2026-05-01)
[x] FIX S — 5-LAYER VIDEO PLAYBACK FALLBACK SYSTEM (2026-05-01)
[x] FIX R — VIDEO PLAYS 1 SEC THEN FREEZES (manual loop) (2026-04-28)
[x] FIX Q — ADMOB POLICY-SAFE TEST/PROD ID SWITCHING (2026-04-28)
[x] FIX P — PRODUCTION-SAFE CONSOLE GATING (2026-04-28)
[x] FIX O — TAB BAR NEEDS 2-3 TAPS TO NAVIGATE (ANDROID) (2026-04-28)
[x] FIX N — VIDEO LOOPS INTERFERING WITH PLAYBACK + DOUBLE-PLAY RACE (2026-04-28)
[x] FIX M — VIDEO PAUSE/PLAY LOOP + MISSING NATIVE CONTROLS + SWIPE STUCK (2026-04-28)
[x] FIX L — AUTO-CAPTION SHARING VIA react-native-share (2026-04-27)
[x] FIX K — CONTENT:// SAF STREAMING PRE-COPY VIDEO TO CACHE (2026-04-27)
[x] FIX J — WATCHDOG INTERRUPTS MID-PLAYBACK RE-BUFFER (2026-04-27)
[x] FIX I — SILENCE EXPECTED MEDIA_LIBRARY PERMISSION NOISE (2026-04-27)
[x] FIX H REGRESSION — DEDUPE REF NOT RESET ON INACTIVE (2026-04-27)
[x] FIX H — DUPLICATE replaceAsync + HARDWARE BACK BUTTON (2026-04-27)
[x] FIX G — TAP → "OOPS! GO TO HOME SCREEN" CRASH (2026-04-27)
[x] FIX F — Metro inlineRequires (metro.config.js)
[x] FIX E — Video Stuck on Thumbnail / No Controls
[x] FIX D — Home Page Crash ("something went wrong")
[x] FIX C — Zero-Delay Share (MediaContext.tsx - shareStatus)
[x] FIX B — Zero-Delay Save (MediaContext.tsx - saveStatus)
[x] FIX A — Touch Drop Prevention (index.tsx + MediaCard.tsx)
[x] OFFLINE MIGRATION COMPLETE (2026-06-14)
[x] RE-IMPORT MIGRATIONS (2026-04-27, 2026-04-28 x2)
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
