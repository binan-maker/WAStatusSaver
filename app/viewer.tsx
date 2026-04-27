import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  FlatList,
  InteractionManager,
  BackHandler,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withDecay, runOnJS } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  useMedia,
  StatusItem,
  SavedItem,
  logDirectPlaySuccess,
  logFallbackCopyTriggered,
} from '@/contexts/MediaContext';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { FONT_SIZE, SPACING, RADIUS } from '@/constants/theme';

import { AdInterstitial } from '@/components/ads/AdInterstitial';
import { AdBanner } from '@/components/ads/AdBanner';
import { BannerAdSize } from 'react-native-google-mobile-ads';

const { width: SW, height: SH } = Dimensions.get('window');

interface ViewerItemProps {
  item: StatusItem | SavedItem;
  isActive: boolean;
  isNearActive: boolean;
  onToggleControls: () => void;
  showControls: boolean;
  controlsOpacity: Animated.Value;
}

function formatTime(millis: number) {
  const totalSeconds = millis / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Soft neutral blurhash shown the instant the viewer mounts. Eliminates
// the black void during the ~50-150 ms SAF stream open + decode window.
// expo-image crossfades automatically (transition={150}) once the real
// bitmap is ready, so the user never sees a flash of black.
const VIEWER_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

function ViewerItem({ item, isActive, isNearActive, onToggleControls, showControls, controlsOpacity }: ViewerItemProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { prepareStatusForViewing } = useMedia();
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  // isVideoVisible is true only after the first frame has rendered to the
  // SurfaceView. It lags behind isVideoReady by 200 ms so the thumbnail never
  // disappears before ExoPlayer has pushed pixels to the screen.
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  // OEM-resilience: when ExoPlayer reports `error` on a content:// URI we
  // surface a "Tap to retry" overlay instead of leaving the user staring
  // at a frozen thumbnail. The retry handler forces a SAF→cache copy and
  // re-feeds the player from file://, which recovers on every device we've
  // seen (Samsung One UI, Xiaomi MIUI, Realme, stock Android).
  const [videoError, setVideoError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  // CUSTOM VIDEO CONTROLS (FIX 2026-04-27):
  //   ExoPlayer's nativeControls={true} overlay was unreliable on Android
  //   11/12 OEM builds — it auto-hid after ~1 s and refused to come back
  //   on tap. We now own the controls entirely in JS so show/hide is
  //   deterministic. videoControlsVisible drives the overlay's render;
  //   isPlaying mirrors player.playing for the play/pause icon;
  //   currentTime / videoDuration drive the time text + progress bar;
  //   userPausedRef tells the stuck-detector to NOT auto-resume after a
  //   user-initiated pause.
  const [videoControlsVisible, setVideoControlsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const userPausedRef = useRef(false);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stuckResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Module-level telemetry latches (per source). directPlayLoggedRef ensures
  // we only count ONE success per content:// URI even if statusChange fires
  // 'readyToPlay' multiple times across re-buffers. fallbackLoggedRef does the
  // same for the watchdog so a single video stall doesn't get double-counted.
  const directPlayLoggedRef = useRef(false);
  const fallbackLoggedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  // Update synchronously every render so every callback sees the latest value
  // without waiting for a useEffect to run after paint.
  isActiveRef.current = isActive;
  const isLoadingSource = useRef(false);
  const isReadyToPlayRef = useRef(false);
  // "Has the player ever reached readyToPlay for the current source?" Latch.
  // Different from isReadyToPlayRef: that one tracks the LIVE status (flips
  // back to false on every mid-playback re-buffer). This one stays true once
  // set, until the source actually changes. The watchdog uses THIS ref to
  // decide whether to fire its fallback-copy path — without it, the watchdog
  // would mistake a brief mid-playback "loading" status (when ExoPlayer
  // pulls more bytes from SAF) for a stalled initial load and forcibly
  // swap the source mid-playback, freezing the video at ~1 second in.
  const hasEverReachedReadyRef = useRef(false);
  // ANDROID 11+ DUPLICATE-REPLACEASYNC FIX:
  // The source-loading effect is keyed on `displayUri`. When the watchdog
  // calls setDisplayUri(cached) AFTER it has already called replaceAsync(cached)
  // itself, the effect re-fires and calls replaceAsync(cached) a SECOND time
  // for the exact same URI. Logs showed: 1848 ms first call, then a duplicate
  // 146 ms call for the same video. We track the last URI handed to ExoPlayer
  // and short-circuit when a duplicate would otherwise be issued. The ref is
  // reset only on real source/item changes (see the source-reset useEffect
  // below), so legitimate source switches still go through.
  const lastReplacedSourceRef = useRef<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once the video surface has rendered its first frame, this stays `true`
  // for the lifetime of the current source. ExoPlayer sometimes emits brief
  // `loading` statusChange events mid-playback (network re-buffer, decoder
  // hiccup, etc.) — without this latch the thumbnail would slap back on top
  // of the playing video and the user would see what looks like a freeze
  // 2 seconds in. We reset this latch only when displayUri actually changes.
  const hasRevealedOnceRef = useRef(false);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const scheduleReveal = useCallback((delayMs: number) => {
    clearRevealTimer();
    revealTimerRef.current = setTimeout(() => {
      console.log(`[Viewer] REVEALING video surface for ${item.name}`);
      hasRevealedOnceRef.current = true;
      setIsVideoVisible(true);
    }, delayMs);
  }, [clearRevealTimer, item.name]);

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id, item.uri]);

  // Player declared BEFORE all effects so every closure captures the same binding.
  // Starts with no source — replaceAsync feeds the file:// URI after SAF copy.
  const player = useVideoPlayer(null, (p) => {
    if (p) {
      p.loop = true;
      p.muted = true;
      if (Platform.OS === 'android') {
        p.staysActiveInBackground = false;
      }
    }
  });

  // ─── CUSTOM VIDEO CONTROLS HELPERS ────────────────────────────────────
  // Defined AFTER useVideoPlayer so closures can reference `player` safely.
  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsHideTimer();
    controlsHideTimerRef.current = setTimeout(() => {
      setVideoControlsVisible(false);
    }, 3500);
  }, [clearControlsHideTimer]);

  const showVideoControls = useCallback(() => {
    setVideoControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    try {
      if (player.playing) {
        // User-initiated pause. Mark the ref so the stuck-detector
        // doesn't auto-resume on the next playingChange event.
        userPausedRef.current = true;
        player.pause();
      } else {
        userPausedRef.current = false;
        player.muted = false;
        player.play();
      }
      // Keep controls visible after the tap so the user sees the new icon.
      showVideoControls();
    } catch (e) {
      console.log('[Viewer] togglePlayPause error:', e);
    }
  }, [player, showVideoControls]);

  const handleVideoSurfaceTap = useCallback(() => {
    if (videoControlsVisible) {
      // Tap while controls are visible → hide them (standard player UX).
      clearControlsHideTimer();
      setVideoControlsVisible(false);
    } else {
      showVideoControls();
    }
  }, [videoControlsVisible, clearControlsHideTimer, showVideoControls]);

  const seekToFraction = useCallback((fraction: number) => {
    if (!player || !videoDuration || videoDuration <= 0) return;
    try {
      const clamped = Math.max(0, Math.min(1, fraction));
      const targetSec = clamped * videoDuration;
      (player as any).currentTime = targetSec;
      setCurrentTime(targetSec);
      showVideoControls();
    } catch (e) {
      console.log('[Viewer] seek error:', e);
    }
  }, [player, videoDuration, showVideoControls]);
  // ──────────────────────────────────────────────────────────────────────

  // Reanimated shared values for smooth pinch-to-zoom on images
  const imageScale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Fully release the hardware decoder on unmount to free the codec slot.
  // player.release() is stronger than replaceAsync(null) — it tears down the
  // ExoPlayer instance entirely, freeing the hardware codec slot immediately.
  useEffect(() => {
    return () => {
      try { player.release(); } catch {}
    };
  }, [player]);

  const tryStartPlayback = useCallback(() => {
    if (
      item.type !== 'video' ||
      !displayUri ||
      !isReadyToPlayRef.current ||  // set false before replaceAsync, true only on readyToPlay
      !isActiveRef.current
    ) return;

    try {
      player.muted = false;
      player.play();
    } catch (e) {
      console.log('Player start error:', e);
    }
  }, [displayUri, item.type, player]);

  // Tap-to-retry handler — runs when the user taps the error overlay.
  // Forces a fresh SAF→cache copy (bypassing the watchdog) and re-feeds
  // the player from the file:// URI. This recovers playback on every OEM
  // ExoPlayer build we've tested. The button shows a spinner while the
  // copy is in flight so the user gets immediate feedback.
  const handleVideoRetry = useCallback(async () => {
    if (item.type !== 'video') return;
    setIsRetrying(true);
    setVideoError(false);
    try {
      const cached = await prepareStatusForViewing(item as StatusItem, { forShare: true });
      if (!cached) {
        setVideoError(true);
        return;
      }
      isReadyToPlayRef.current = false;
      isLoadingSource.current = true;
      // Mirror the watchdog's pattern: mark the dedupe ref BEFORE setDisplayUri
      // so the source-loading effect's re-run with displayUri=cached sees
      // the match and short-circuits, instead of issuing a duplicate
      // replaceAsync(cached) immediately after this one.
      lastReplacedSourceRef.current = cached;
      await player.replaceAsync(cached);
      isLoadingSource.current = false;
      setDisplayUri(cached);
      // Telemetry: explicit user-driven retry counts as a fallback copy.
      if (!fallbackLoggedRef.current) {
        fallbackLoggedRef.current = true;
        logFallbackCopyTriggered();
      }
      tryStartPlaybackRef.current();
    } catch (err) {
      console.error(`[Viewer] handleVideoRetry failed for ${item.name}:`, err);
      setVideoError(true);
    } finally {
      setIsRetrying(false);
    }
  }, [item, player, prepareStatusForViewing]);

  // ── Callback refs for the stable status listener ──────────────────────────
  // The status listener is attached once per player instance and must never be
  // torn down/re-added when displayUri or other state changes — that would miss
  // the readyToPlay event. But the listener needs to call tryStartPlayback and
  // scheduleReveal which change when displayUri changes. Solution: store the
  // latest callback in a ref and call through the ref inside the stable listener.
  // This is the same pattern expo's useEventListener uses internally.
  const tryStartPlaybackRef = useRef(tryStartPlayback);
  const scheduleRevealRef = useRef(scheduleReveal);
  const clearRevealTimerRef = useRef(clearRevealTimer);
  useEffect(() => { tryStartPlaybackRef.current = tryStartPlayback; });
  useEffect(() => { scheduleRevealRef.current = scheduleReveal; });
  useEffect(() => { clearRevealTimerRef.current = clearRevealTimer; });

  // ── Status listener ──────────────────────────────────────────────────────
  // Attached once per player instance. Uses refs for callbacks so it always
  // calls the latest tryStartPlayback (with current displayUri). Also wraps
  // addListener in a try/catch: on Android 11 the native bridge can be
  // uninitialized on the very first render, making addListener undefined.
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!player || typeof player.addListener !== 'function') return;
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = player.addListener('statusChange', ({ status }: { status: string }) => {
        console.log(`[Viewer] Player status for ${item.name}: ${status}`);
        const ready = status === 'readyToPlay';
        isReadyToPlayRef.current = ready;

        // ── Error surface — show retry overlay ─────────────────────────
        // Some OEM ExoPlayer builds (older Xiaomi MIUI, certain Realme
        // ROMs) reject content:// URIs from a foreign SAF tree with an
        // immediate `error` status. Watchdog covers most of these, but
        // for cases where playback fails AFTER the watchdog window we
        // surface a tap-to-retry button instead of leaving the user
        // stuck on a frozen thumbnail.
        if (status === 'error') {
          setVideoError(true);
        }

        // ── Telemetry: count ONE direct-play success per content:// source ──
        // We only credit the FIRST readyToPlay event per source so re-buffers
        // mid-playback don't inflate the success rate. file:// URIs aren't
        // counted (they're already-cached fallbacks, not direct SAF playback).
        if (ready && !directPlayLoggedRef.current && displayUri && displayUri.startsWith('content://')) {
          directPlayLoggedRef.current = true;
          logDirectPlaySuccess();
        }

        if (ready) {
          // Clear any lingering error state — playback recovered.
          setVideoError(false);
          setIsVideoReady(true);
          // Latch: the video has now reached readyToPlay at least once for
          // this source. Mid-playback re-buffers will flip status back to
          // 'loading' but must NOT cause the watchdog to swap the source.
          hasEverReachedReadyRef.current = true;
          // Always call the latest tryStartPlayback via ref — never a stale closure.
          tryStartPlaybackRef.current();
          if (!hasRevealedOnceRef.current) {
            // First-ever readyToPlay for this source: schedule the reveal so
            // ExoPlayer has time to push the very first frame to the surface.
            // 80ms is enough for the SurfaceView to bind and accept frames
            // on Android 11 — was 200ms which added noticeable dead time
            // between "ready" and visible video.
            scheduleRevealRef.current(80);
          } else {
            // Mid-playback re-buffer just finished. Surface is already
            // visible; nothing else to do — DO NOT reschedule reveal,
            // DO NOT touch isVideoVisible.
          }
        } else {
          // Non-ready status (loading / idle / error). Only reset visibility
          // BEFORE the very first frame has been shown. After we've revealed
          // once, brief mid-playback buffer events must NOT slap the
          // thumbnail back on top of the live surface — that's the
          // "freeze 2 seconds in" symptom users were reporting.
          if (!hasRevealedOnceRef.current) {
            setIsVideoReady(false);
            setIsVideoVisible(false);
            clearRevealTimerRef.current();
          }
        }
      });
    } catch (e) {
      console.log('[Viewer] Could not attach statusChange listener:', e);
    }
    return () => {
      try { subscription?.remove(); } catch {}
    };
  }, [player, item.type, item.name]); // stable deps only — callbacks via refs

  // Reset ready + visible flags (and cancel any pending reveal) on source change.
  // Also clear the "has revealed once" latch — the new source needs to earn
  // its own reveal via a fresh readyToPlay → 200ms delay cycle. Also reset
  // the per-source error state and telemetry latches so each new source
  // starts from a clean slate.
  useEffect(() => {
    setIsVideoReady(false);
    setIsVideoVisible(false);
    setVideoError(false);
    hasRevealedOnceRef.current = false;
    // Reset the "ever reached ready" latch on a real source change so the
    // watchdog can do its job for the new source if needed. NOT reset on
    // mid-playback re-buffers — those don't change displayUri.
    hasEverReachedReadyRef.current = false;
    directPlayLoggedRef.current = false;
    fallbackLoggedRef.current = false;
    clearRevealTimer();
  }, [displayUri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the dedupe ref whenever we actually navigate to a new ITEM (not on
  // every displayUri micro-change inside the same item). This guarantees the
  // first replaceAsync for a freshly-mounted/swiped-in source always goes
  // through, even if the URI happens to string-match the previous item.
  useEffect(() => {
    lastReplacedSourceRef.current = null;
  }, [item.id]);

  // ─── CUSTOM VIDEO CONTROLS — listeners + lifecycle ────────────────────
  // Reset all per-item controls state when the user swipes to a new video.
  useEffect(() => {
    userPausedRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setVideoDuration(0);
    setVideoControlsVisible(false);
  }, [item.id]);

  // Subscribe to playingChange. Two jobs:
  //   1. Mirror the live play/pause state into React so the icon updates.
  //   2. STUCK DETECTOR — if the player flips to !playing AFTER having
  //      reached readyToPlay AND the user did NOT initiate a pause, the
  //      OEM ExoPlayer just stalled. Auto-call play() to wake it up.
  //      This is the safety net for the "video freezes after 1 second"
  //      symptom on devices where even a file:// source can stall.
  useEffect(() => {
    if (item.type !== 'video' || !player || typeof player.addListener !== 'function') return;
    let sub: { remove: () => void } | null = null;
    try {
      sub = player.addListener('playingChange', (payload: any) => {
        // Different expo-video versions name this `isPlaying` vs `playing`.
        const nowPlaying = payload?.isPlaying ?? payload?.playing ?? false;
        setIsPlaying(nowPlaying);

        if (
          !nowPlaying &&
          !userPausedRef.current &&
          hasEverReachedReadyRef.current &&
          isActiveRef.current &&
          item.type === 'video'
        ) {
          // Schedule the resume on a micro-delay so we don't fight the
          // same state-change cycle that just flipped us to !playing.
          if (stuckResumeTimerRef.current) clearTimeout(stuckResumeTimerRef.current);
          stuckResumeTimerRef.current = setTimeout(() => {
            stuckResumeTimerRef.current = null;
            if (!isActiveRef.current || userPausedRef.current) return;
            try {
              if (!player.playing) {
                console.log(`[Viewer] Stuck detector: resuming ${item.name} after unexpected pause`);
                player.muted = false;
                player.play();
              }
            } catch {}
          }, 250);
        }
      });
    } catch (e) {
      console.log('[Viewer] playingChange listener attach failed:', e);
    }
    return () => { try { sub?.remove(); } catch {} };
  }, [player, item.type, item.name]);

  // Subscribe to timeUpdate. Throttled to 4 Hz — enough for a smooth
  // progress bar without burning CPU on the JS thread.
  useEffect(() => {
    if (item.type !== 'video' || !player || typeof player.addListener !== 'function') return;
    try { (player as any).timeUpdateEventInterval = 0.25; } catch {}
    let sub: { remove: () => void } | null = null;
    try {
      sub = player.addListener('timeUpdate', (payload: any) => {
        const ct = payload?.currentTime;
        if (typeof ct === 'number') setCurrentTime(ct);
      });
    } catch {}
    return () => { try { sub?.remove(); } catch {} };
  }, [player, item.type]);

  // Capture the duration once the video reaches readyToPlay. We re-read it
  // each time isVideoReady flips so a re-buffer that bumps the duration
  // (rare but possible for variable-bitrate clips) updates the progress bar.
  useEffect(() => {
    if (item.type !== 'video' || !player) return;
    if (!isVideoReady) return;
    try {
      const d = (player as any).duration;
      if (typeof d === 'number' && d > 0 && d !== videoDuration) {
        setVideoDuration(d);
      }
    } catch {}
  }, [player, item.type, isVideoReady, videoDuration]);

  // Auto-show controls briefly the first time the video surface is revealed
  // so the user immediately knows they CAN tap to interact. Hides on the
  // standard 3.5 s timer afterwards.
  useEffect(() => {
    if (item.type !== 'video') return;
    if (isActive && isVideoVisible) {
      showVideoControls();
    }
  }, [isActive, isVideoVisible, item.type, showVideoControls]);

  // Tear down all controls timers on unmount so nothing fires against a
  // released player.
  useEffect(() => {
    return () => {
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
      if (stuckResumeTimerRef.current) clearTimeout(stuckResumeTimerRef.current);
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────

  // ── Source loading ───────────────────────────────────────────────────────
  // Strategy: call replaceAsync as soon as animations finish (InteractionManager),
  // then rely on the 200 ms isVideoVisible reveal delay to guarantee the first
  // frame is on screen before the thumbnail disappears.
  //
  // The old approach (300 ms explicit pre-buffer) tried to delay replaceAsync
  // long enough for the SurfaceView to bind — but that race was non-deterministic.
  // The new approach flips it: start decoding immediately after the animation,
  // and keep the thumbnail up until we KNOW frames are rendering (200 ms post-
  // readyToPlay). This eliminates the black screen unconditionally on all devices.
  useEffect(() => {
    if (item.type !== 'video' || !player || !displayUri) return;
    // ANDROID 11+ HARDWARE DECODER FIX: Only the ACTIVE slot allocates a
    // decoder via replaceAsync. Pre/next slots stay sourceless so the system
    // codec pool never runs out. We hand the URI directly to ExoPlayer
    // (content:// works natively) — replaceAsync against a content:// URI
    // typically fires readyToPlay in 100-400 ms on Android 11. The fallback
    // watchdog below covers any edge-case OEM where direct playback hangs.
    if (!isActive) return;

    let cancelled = false;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    // ── DEDUPE GUARD ────────────────────────────────────────────────────────
    // If we've already handed this exact URI to ExoPlayer for this item,
    // don't replace it again. The watchdog used to set displayUri to the
    // cached file AFTER it had already called replaceAsync(cached) itself,
    // causing a duplicate replaceAsync that wasted 100-300 ms of native work
    // and briefly stalled playback on Android 11. With this short-circuit
    // the second pass is a no-op.
    if (lastReplacedSourceRef.current === displayUri) {
      console.log(`[Viewer] Skipping duplicate replaceAsync for ${item.name}`);
      return;
    }

    isLoadingSource.current = true;
    isReadyToPlayRef.current = false;

    const load = async () => {
      const loadStart = Date.now();
      try {
        // PERF: For cached/local files (file://) skip the animation wait
        // entirely — those load instantly and waiting 250 ms only adds dead
        // time before the first frame. The wait stays for content://
        // sources because handing them to ExoPlayer mid-animation can
        // collide with the JS thread on slow Android 11 devices.
        const isLocalCached = displayUri.startsWith('file://');
        if (!isLocalCached) {
          console.log(`[Viewer] Waiting for animations before load: ${item.name}`);
          await Promise.race([
            new Promise<void>(resolve => InteractionManager.runAfterInteractions(resolve)),
            new Promise<void>(resolve => setTimeout(resolve, 120)),
          ]);
          if (cancelled) return;
        }
        console.log(`[Viewer] Calling replaceAsync for ${item.name} (${Date.now() - loadStart}ms)`);

        // Mark BEFORE awaiting so a watchdog-triggered displayUri update
        // arriving mid-await doesn't re-fire replaceAsync against the same
        // source between this line and the await resolving.
        lastReplacedSourceRef.current = displayUri;
        await player.replaceAsync(displayUri);
        if (cancelled) return;
        console.log(`[Viewer] replaceAsync complete for ${item.name} (${Date.now() - loadStart}ms)`);
        isLoadingSource.current = false;
        tryStartPlaybackRef.current();

        // ─── Watchdog: fall back to file:// copy if ExoPlayer can't ────
        // play the content:// URI directly. Most devices fire readyToPlay
        // within 400 ms; we give it 1 s (was 2.5 s — halved so users
        // never stare at a frozen thumbnail for more than a second before
        // the file:// fallback kicks in). The copy goes through the
        // serialized queue so it never fights another in-flight prepare.
        if (displayUri.startsWith('content://')) {
          watchdogTimer = setTimeout(async () => {
            // Bail if cancelled, OR if the player is currently ready, OR if
            // it has EVER been ready for this source. The "ever ready" check
            // is the critical one: ExoPlayer briefly flips status back to
            // 'loading' during mid-playback re-buffers (every few seconds
            // when streaming SAF bytes). Without this latch the watchdog
            // would mistake a 1.5 s re-buffer for an initial-load stall and
            // forcibly swap the source mid-playback, freezing the video.
            if (cancelled || isReadyToPlayRef.current || hasEverReachedReadyRef.current) return;
            console.log(`[Viewer] Watchdog: direct content:// playback stalled for ${item.name}, falling back to cached copy`);
            try {
              const cached = await prepareStatusForViewing(item as StatusItem, { forShare: true });
              // Re-check the latch AFTER the await — the player might have
              // reached readyToPlay during the cache copy, in which case we
              // must not swap the source out from under a video that's now
              // happily playing.
              if (cancelled || isReadyToPlayRef.current || hasEverReachedReadyRef.current) return;
              if (cached && cached !== displayUri) {
                // Telemetry: count this watchdog→fallback cycle ONCE per
                // source so we can spot devices/installs that hit it
                // chronically (= we should pre-copy upfront for them).
                if (!fallbackLoggedRef.current) {
                  fallbackLoggedRef.current = true;
                  logFallbackCopyTriggered();
                }
                isLoadingSource.current = true;
                // Mark BEFORE the setDisplayUri() below so when the source-
                // loading effect re-runs with displayUri = cached, the dedupe
                // guard at the top sees the match and skips the duplicate
                // replaceAsync. Without this we'd issue a second
                // replaceAsync(cached) for the exact same URI we just loaded.
                lastReplacedSourceRef.current = cached;
                await player.replaceAsync(cached);
                if (cancelled) return;
                isLoadingSource.current = false;
                setDisplayUri(cached);
                tryStartPlaybackRef.current();
                console.log(`[Viewer] Watchdog: switched ${item.name} to cached copy successfully`);
              }
            } catch (err) {
              isLoadingSource.current = false;
              console.error(`[Viewer] Watchdog fallback failed for ${item.name}:`, err);
            }
          }, 1000);
        }
      } catch (e) {
        if (!cancelled) {
          isLoadingSource.current = false;
          console.error(`[Viewer] Player load error for ${item.name} (${Date.now() - loadStart}ms):`, e);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      isLoadingSource.current = false;
      isReadyToPlayRef.current = false;
    };
  // tryStartPlayback intentionally excluded — accessed via tryStartPlaybackRef
  // to avoid cancelling in-flight replaceAsync on every displayUri change.
  }, [displayUri, item.type, player, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reveal timer cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => { clearRevealTimer(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle swipe-to-already-ready-video ──────────────────────────────────
  // Covers two cases:
  // A) User swipes to a nearActive video that already hit readyToPlay while
  //    buffering — isVideoReady=true but isActive was false so reveal was never shown.
  // B) readyToPlay fires while isActive is already true (e.g. fast cache hit
  //    that resolves before the first render's useEffect can run).
  // Both cases are caught by reacting to BOTH isActive and isVideoReady changes.
  useEffect(() => {
    if (item.type !== 'video') return;
    if (isActive && isVideoReady && !isVideoVisible) {
      scheduleRevealRef.current(80);
    }
  }, [isActive, isVideoReady, isVideoVisible, item.type]);

  // ── isActive-false cleanup ───────────────────────────────────────────────
  // Separate from the reveal effect so changes to isVideoReady don't
  // accidentally re-run the cleanup path.
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!isActive) {
      setIsVideoVisible(false);
      clearRevealTimerRef.current();
    }
  }, [isActive, item.type]);

  // ── Active / inactive sync ───────────────────────────────────────────────
  useEffect(() => {
    if (item.type !== 'video' || !player || isLoadingSource.current) return;
    try {
      if (isActive) {
        // Use ref so we always call the latest tryStartPlayback without this
        // effect re-running (and potentially cancelling an in-flight replaceAsync)
        // every time displayUri changes.
        tryStartPlaybackRef.current();
      } else {
        // ANDROID 11+ FIX: Release the hardware decoder the INSTANT this slot
        // becomes inactive — don't wait for `!isNearActive`. With VideoView
        // mounted only on the active page (single-surface policy above), the
        // decoder is useless for prev/next slots and was just blocking the
        // codec pool, preventing the new active video from allocating its
        // own decoder. Pausing + replaceAsync(null) frees the slot synchronously
        // so the next swipe gets a fresh decoder immediately.
        player.muted = true;
        player.pause();
        isReadyToPlayRef.current = false;
        setIsVideoReady(false);
        (player as any).replaceAsync?.(null).catch?.(() => {});
        // CRITICAL: clear the dedupe ref now that the player's source is null.
        // Without this, the next time this slot becomes active, the source-
        // loading effect would see lastReplacedSourceRef === displayUri (the
        // pre-cleanup URI) and SKIP replaceAsync — leaving the player with
        // a null source and the thumbnail frozen forever. This was the
        // "stuck on thumbnail after swipe" bug.
        lastReplacedSourceRef.current = null;
      }
    } catch (e) {
      console.log('Player sync error:', e);
    }
  // tryStartPlayback intentionally excluded — accessed via tryStartPlaybackRef.
  }, [isActive, isNearActive, player, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── URI preparation ──────────────────────────────────────────────────────
  // ANDROID 11+ SAF STREAMING FIX (2026-04-27):
  //   We previously handed the raw content:// URI to ExoPlayer and trusted
  //   it to stream from SAF directly. ExoPlayer DOES open the SAF file
  //   descriptor and play the first ~1 s of buffered data — but as soon as
  //   it needs to refill the buffer, the stream stalls and never recovers
  //   ("video freezes 1 second in" symptom on user-installed APKs). The
  //   watchdog used to mask this with a fallback cache copy, but only for
  //   the initial load — once playback started the watchdog disengaged
  //   (correctly, per FIX J), exposing the same SAF-streaming bug mid-play.
  //
  //   The reliable path is to ALWAYS pre-copy content:// VIDEO sources
  //   into the cache directory and feed the player a file:// URI. file://
  //   gives ExoPlayer a real seekable filesystem fd that it can buffer
  //   from indefinitely. Trade-off: +200-700 ms first-load latency on a
  //   cache miss; cache hits return in ~10 ms. Subsequent plays of the
  //   same status are basically instant. Worth it — broken playback is
  //   strictly worse than slightly-slower-first-load.
  //
  //   Images (item.type === 'image') still use direct content:// — expo-image
  //   handles SAF reliably (single-shot decode, no streaming buffer to refill).
  //   Saved items (file:// already) bypass this entirely.
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        setDisplayUri(null);
        setIsVideoReady(false);
        // DO NOT call replaceAsync(null) here — the active/inactive sync effect
        // handles that. Calling it from two effects simultaneously causes a race
        // that corrupts the player state and produces black screen on Android 11.
        if (item.type === 'video' && player) {
          isReadyToPlayRef.current = false;
          try { player.pause(); } catch {}
        }
      }
      return;
    }

    if (displayUri) return; // already prepared for this slot

    // Non-video OR non-content URI → use immediately, no copy needed.
    if (item.type !== 'video' || !initialSource.startsWith('content://')) {
      setDisplayUri(initialSource);
      return;
    }

    // Video + content:// → await a real file:// copy via the serialized
    // copy queue. Cancellation guard handles the case where the user
    // swipes away mid-copy (effect cleanup runs, cancelled = true).
    let cancelled = false;
    (async () => {
      try {
        const cached = await prepareStatusForViewing(item as StatusItem, { forShare: true });
        if (cancelled) return;
        if (cached && cached.startsWith('file://')) {
          setDisplayUri(cached);
        } else {
          // prepareStatusForViewing now THROWS on copy failure rather than
          // silently returning content://. If we got here with a non-file
          // URI it's safer to surface the retry overlay than to feed
          // ExoPlayer a SAF stream that will freeze ~1 s in.
          console.error(`[Viewer] Pre-copy returned unexpected URI for ${item.name}: ${cached}`);
          setVideoError(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(`[Viewer] Pre-copy failed for ${item.name}, surfacing retry:`, e);
          setVideoError(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [initialSource, item, isNearActive, isActive, prepareStatusForViewing]); // eslint-disable-line react-hooks/exhaustive-deps

  const mediaUri = displayUri || initialSource;

  // Reset zoom and image-loaded state whenever the item identity changes OR
  // whenever this slot becomes inactive. The inactive reset is critical:
  // FlatList recycles cells, so if the user swipes away from a zoomed image
  // and back, the shared values would still hold the old zoom state. Resetting
  // on isActive=false guarantees every (re)entry to a slot starts at scale 1.
  useEffect(() => {
    imageScale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [item.id, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset image-loaded only on item id change (not on every active toggle).
  useEffect(() => {
    setImageLoaded(false);
  }, [item.id]);

  // ── Image gesture handlers ────────────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedScale.value * e.scale, 1), 6);
      imageScale.value = next;
    })
    .onEnd(() => {
      if (imageScale.value < 1.15) {
        imageScale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = imageScale.value;
        // Clamp translation to bounds after scale settles.
        // Both axes use SW (the smaller dimension on portrait phones) so that
        // landscape images — which are letterboxed with short content height —
        // can never be panned fully off-screen.
        const maxX = ((imageScale.value - 1) * SW) / 2;
        const maxY = ((imageScale.value - 1) * SW) / 2;
        if (Math.abs(translateX.value) > maxX) {
          const clampedX = translateX.value > 0 ? maxX : -maxX;
          translateX.value = withSpring(clampedX);
          savedTranslateX.value = clampedX;
        }
        if (Math.abs(translateY.value) > maxY) {
          const clampedY = translateY.value > 0 ? maxY : -maxY;
          translateY.value = withSpring(clampedY);
          savedTranslateY.value = clampedY;
        }
      }
    });

  // Pan is only activated when zoomed in. Translation is clamped so the image
  // never drifts off-screen — providing a proper constrained zoom experience.
  // A resistance factor of 0.72 is applied during the drag to prevent the
  // "watery" / uncontrolled feel. withDecay on release gives a smooth
  // deceleration that respects the clamp bounds.
  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (imageScale.value > 1) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      const scale = imageScale.value;
      const maxX = ((scale - 1) * SW) / 2;
      const maxY = ((scale - 1) * SW) / 2;
      // Resistance factor — dampens direct finger tracking so fast swipes
      // feel controlled rather than sliding out of hand.
      const resistance = 0.72;
      const newX = savedTranslateX.value + e.translationX * resistance;
      const newY = savedTranslateY.value + e.translationY * resistance;
      translateX.value = Math.max(-maxX, Math.min(maxX, newX));
      translateY.value = Math.max(-maxY, Math.min(maxY, newY));
    })
    .onEnd((e) => {
      const scale = imageScale.value;
      const maxX = ((scale - 1) * SW) / 2;
      const maxY = ((scale - 1) * SW) / 2;
      // withDecay gives a natural coast-to-stop after the finger lifts.
      // Velocity is halved so it doesn't shoot across the image.
      // clamp keeps the image within valid bounds at all times.
      translateX.value = withDecay(
        { velocity: e.velocityX * 0.5, deceleration: 0.92, clamp: [-maxX, maxX] },
        () => { savedTranslateX.value = translateX.value; },
      );
      translateY.value = withDecay(
        { velocity: e.velocityY * 0.5, deceleration: 0.92, clamp: [-maxY, maxY] },
        () => { savedTranslateY.value = translateY.value; },
      );
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(200)
    .onEnd((e) => {
      if (imageScale.value > 1) {
        imageScale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom toward the tap point
        const targetScale = 2.5;
        imageScale.value = withSpring(targetScale);
        savedScale.value = targetScale;
        // Center on the tapped area, clamped to bounds (SW for both axes)
        const maxX = ((targetScale - 1) * SW) / 2;
        const maxY = ((targetScale - 1) * SW) / 2;
        const tapX = Math.max(-maxX, Math.min(maxX, (SW / 2 - e.x) * (targetScale - 1)));
        const tapY = Math.max(-maxY, Math.min(maxY, (SH / 2 - e.y) * (targetScale - 1)));
        translateX.value = withSpring(tapX);
        translateY.value = withSpring(tapY);
        savedTranslateX.value = tapX;
        savedTranslateY.value = tapY;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onToggleControls)();
    });

  const imageGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
  );

  const videoTapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onToggleControls)();
  });

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: imageScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <View style={styles.itemContainer}>
      {item.type === 'image' ? (
        <GestureDetector gesture={imageGesture}>
          <Reanimated.View style={[StyleSheet.absoluteFill, imageAnimatedStyle]}>
            <Image
              source={{ uri: mediaUri }}
              style={styles.image}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
              priority={isActive ? 'high' : 'low'}
              recyclingKey={item.id}
              allowDownscaling
              decodeFormat="rgb"
              placeholder={VIEWER_PLACEHOLDER}
              placeholderContentFit="cover"
              onLoadStart={() => setImageLoaded(false)}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                console.error(`[Viewer] Image LOAD ERROR for ${item.name}:`, e);
              }}
            />
            {/* Spinner overlay only while the SAF stream is being opened.
                Once the placeholder is on screen there is no black void,
                so we skip the heavy shimmer and just show a soft indicator. */}
            {!imageLoaded && (
              <View style={styles.imageSpinnerOverlay} pointerEvents="none">
                <ActivityIndicator color={COLORS.PRIMARY} size="large" />
              </View>
            )}
          </Reanimated.View>
        </GestureDetector>
      ) : (
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.videoWrap}>
              {/*
                VideoView is mounted when isNearActive (prev/current/next).
                nativeControls={true} → ExoPlayer's built-in seek bar, play/pause,
                duration are shown automatically. The thumbnail overlay above it
                has pointerEvents="none" so all touches fall through to the native
                controls even while the thumbnail is still covering the surface.

                replaceAsync fires after InteractionManager (animation done).
                The thumbnail stays up 200 ms past readyToPlay (isVideoVisible)
                so ExoPlayer has filled its frame pipeline before we reveal.
                player.release() on unmount frees the hardware codec slot.
              */}
              {/*
                ANDROID 11+ HARDWARE DECODER FIX:
                VideoView is now mounted ONLY when this slot is the ACTIVE
                page — never for prev/next. Android 11/12 phones typically
                have a 1-2 instance hardware H.264 decoder budget; mounting
                3 VideoViews simultaneously (prev/cur/next) was exhausting
                that pool, causing the next swipe's video to silently fail
                to allocate a decoder and freeze on the thumbnail forever.
                Single live surface = guaranteed decoder availability =
                no more "video not playing after swipe" lockups.
              */}
              {isActive && (
                <VideoView
                  key={item.id}
                  player={player}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  nativeControls={false}
                />
              )}

              {/*
                CUSTOM CONTROLS TAP LAYER (FIX 2026-04-27):
                Transparent full-surface tap target sitting directly above the
                VideoView. Replaces ExoPlayer's flaky nativeControls. Tapping
                here toggles our JS-owned overlay (play/pause + time + progress).
                Only mounted while the video surface is actually visible and
                playable — never over the thumbnail or the retry overlay.
              */}
              {isActive && isVideoVisible && !videoError && (
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={handleVideoSurfaceTap}
                  accessibilityLabel="Show video controls"
                />
              )}

              {/*
                Thumbnail overlay: stays visible until isVideoVisible.
                pointerEvents="none" so all taps fall through to native VideoView controls.
                Shows a play button badge so users can always see it's a playable video
                and have a visible affordance even while ExoPlayer is warming up.
              */}
              {(!isActive || !isVideoVisible) && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Image
                    source={{ uri: initialSource }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                    recyclingKey={item.id}
                    videoTimestamp={500}
                  />
                  {/* Play badge — always visible while thumbnail is up so
                      users know this is a video and see a control target */}
                  {isActive && !isVideoReady && !videoError && (
                    <View style={styles.videoPlayBadge} pointerEvents="none">
                      <View style={styles.videoPlayBadgeInner}>
                        <Ionicons name="play" size={28} color="#fff" />
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Spinner during buffering — sits above thumbnail, below native controls. */}
              {/* Hidden when the retry overlay is showing so we don't double-stack. */}
              {isNearActive && !isVideoReady && !videoError && (
                <View style={styles.videoSpinnerWrap} pointerEvents="none">
                  <ActivityIndicator
                    color={COLORS.PRIMARY}
                    size="large"
                  />
                </View>
              )}

              {/*
                CUSTOM VIDEO CONTROLS OVERLAY (FIX 2026-04-27):
                Owned entirely in JS — guaranteed responsive on every Android
                OEM. Shows: large center play/pause button + time readout +
                tap-to-seek progress bar. Auto-hides after 3.5 s of inactivity
                but ALWAYS reappears on the next tap because we own the
                videoControlsVisible state. Only mounted while the video is
                ready, visible, active, and not showing an error overlay.
              */}
              {isActive && isVideoVisible && videoControlsVisible && !videoError && (
                <>
                  <View style={styles.videoCustomControlsCenter} pointerEvents="box-none">
                    <TouchableOpacity
                      style={styles.videoCustomPlayBtn}
                      onPress={togglePlayPause}
                      activeOpacity={0.85}
                      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
                    >
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={42}
                        color="#fff"
                        style={isPlaying ? undefined : { marginLeft: 4 }}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.videoCustomBottomBar} pointerEvents="box-none">
                    <Text style={styles.videoCustomTimeText}>
                      {formatTime(currentTime * 1000)} / {formatTime(videoDuration * 1000)}
                    </Text>
                    <TouchableOpacity
                      style={styles.videoCustomProgressTouch}
                      activeOpacity={1}
                      onPress={(e) => {
                        const x = e.nativeEvent.locationX;
                        const w = SW - SPACING.LG * 2;
                        if (w > 0) seekToFraction(x / w);
                      }}
                      accessibilityLabel="Seek bar"
                    >
                      <View style={styles.videoCustomProgressBg}>
                        <View
                          style={[
                            styles.videoCustomProgressFill,
                            {
                              width: videoDuration > 0
                                ? `${Math.max(0, Math.min(100, (currentTime / videoDuration) * 100))}%`
                                : '0%',
                            },
                          ]}
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/*
                Tap-to-retry overlay — shown when ExoPlayer reports `error`.
                Receives touches (no pointerEvents="none") so the user can
                actively recover from a stalled video on the rare OEM that
                refuses our content:// URI even after the watchdog copy.
              */}
              {isActive && videoError && (
                <View style={styles.videoRetryOverlay}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleVideoRetry}
                    disabled={isRetrying}
                    style={styles.videoRetryBtn}
                    accessibilityLabel="Tap to retry playback"
                  >
                    {isRetrying ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="refresh-circle" size={32} color="#FFFFFF" />
                        <Text style={styles.videoRetryText}>Tap to retry</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
      )}
    </View>
  );
}

export default function ViewerScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const params = useLocalSearchParams<{ id: string; isSaved?: string }>();
  const { id, isSaved: isSavedParam } = params;
  
  const insets = useSafeAreaInsets();
  const { 
    statuses, 
    savedItems, 
    saveStatus, 
    shareStatus, 
    isStatusSaved, 
    deleteFromSaved,
    loadStatuses,
    hasPermission,
    onImageSwipe,
    dismissInterstitial,
    showInterstitial,
    prepareStatusForViewing,
  } = useMedia();

  const isSavedView = isSavedParam === '1';
  const prevIdRef = useRef<string | null>(null);

  // Safeguard: Load statuses if they are empty (e.g. on deep link or refresh)
  useEffect(() => {
    if (!isSavedView && statuses.length === 0 && hasPermission) {
      loadStatuses();
    }
  }, [isSavedView, statuses.length, hasPermission, loadStatuses]);

  // ── Android hardware-back handling ─────────────────────────────────────
  // expo-router will pop the stack on hardware back by default, but on some
  // OEMs (older MIUI / OneUI) the gesture handler / FlatList pager swallows
  // the press and the user has to tap back several times before the route
  // actually pops. Owning the handler here guarantees ONE press = one pop.
  // We return `true` to mark the event as handled so RN doesn't double-fire
  // the default handler on top of router.back().
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  const items = useMemo(() => {
    if (isSavedView) {
      const startItem = savedItems.find(s => s.id === id || decodeURIComponent(s.id) === id);
      if (!startItem) return savedItems;
      return savedItems.filter(s => s.type === startItem.type);
    }
    
    const startItem = statuses.find(s => s.id === id || decodeURIComponent(s.id) === id);
    
    if (!startItem) {
      return [];
    }
    
    return statuses.filter(s => s.type === startItem.type);
  }, [isSavedView, savedItems, statuses, id]);

  const initialIndex = useMemo(() => {
    const idx = items.findIndex(item => item.id === id || decodeURIComponent(item.id) === id);
    return idx === -1 ? 0 : idx;
  }, [items, id]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const prevIndex = useRef(initialIndex);
  
  // Update currentIndex and scroll to it when initialIndex changes
  useEffect(() => {
    if (prevIdRef.current !== id) {
      prevIdRef.current = id;
      if (items.length > 0 && initialIndex >= 0) {
        setCurrentIndex(initialIndex);
        prevIndex.current = initialIndex;
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: initialIndex,
            animated: false,
          });
        }, 50);
      }
    }
  }, [initialIndex, items.length, id]);

  const currentItem = items[currentIndex];

  // Prefetch the prev/current/next IMAGES so the user never sees a blank
  // frame on swipe. Image.prefetch warms expo-image's memory-disk cache;
  // the next swipe then renders instantly from RAM instead of paying the
  // Android 11 ContentResolver tax on every navigation.
  //
  // VIDEOS no longer get pre-copied here. The previous prepareStatusForViewing
  // pre-copy added 200 ms-2 s of SAF I/O per neighbor and routinely fought
  // the active video's own setup for I/O bandwidth, ironically making the
  // CURRENT video slower to start. Now videos are fed straight to ExoPlayer
  // as content:// URIs (see the URI-prep effect above) — no copy, no queue
  // contention. The watchdog covers any device where direct playback fails.
  useEffect(() => {
    const cur = items[currentIndex];
    const next1 = items[currentIndex + 1];
    const prev1 = items[currentIndex - 1];

    if (cur && cur.type === 'image') {
      const curUri = 'localUri' in cur ? (cur as SavedItem).localUri : cur.uri;
      Image.prefetch(curUri, 'memory-disk').catch(() => {});
    }
    if (next1 && next1.type === 'image') {
      const nUri = 'localUri' in next1 ? (next1 as SavedItem).localUri : next1.uri;
      Image.prefetch(nUri, 'memory-disk').catch(() => {});
    }
    if (prev1 && prev1.type === 'image') {
      const pUri = 'localUri' in prev1 ? (prev1 as SavedItem).localUri : prev1.uri;
      Image.prefetch(pUri, 'memory-disk').catch(() => {});
    }

    const timer = setTimeout(() => {
      const next2 = items[currentIndex + 2];
      if (next2 && next2.type === 'image') {
        const n2Uri = 'localUri' in next2 ? (next2 as SavedItem).localUri : next2.uri;
        Image.prefetch(n2Uri, 'memory-disk').catch(() => {});
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [currentIndex, items]);

  const [showControls, setShowControls] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSaved = isSavedView || (currentItem && isStatusSaved(currentItem.id));

useEffect(() => {
  setShowControls(true);
  controlsOpacity.setValue(1);
}, [currentIndex, currentItem]);

function animateControls(show: boolean) {
  Animated.timing(controlsOpacity, {
    toValue: show ? 1 : 0,
    duration: 300,
    useNativeDriver: true,
  }).start();
}

const toggleControls = useCallback(() => {
  const next = !showControls;
  setShowControls(next);
  animateControls(next);
}, [showControls, controlsOpacity]);



  const handleSave = useCallback(async () => {
    if (!currentItem || isSaved || isSaving) return;
    setIsSaving(true);
    const success = await saveStatus(currentItem);
    setIsSaving(false);
  }, [currentItem, isSaved, isSaving, saveStatus]);

  const handleShare = useCallback(async () => {
    if (!currentItem) return;
    await shareStatus(currentItem);
  }, [currentItem, shareStatus]);

  const handleDelete = useCallback(async () => {
    if (!isSavedView || !currentItem) return;
    Alert.alert('Delete', 'Remove this status from saved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const savedItem = savedItems.find(s => s.id === currentItem.id);
          if (savedItem) {
            await deleteFromSaved(savedItem);
            if (items.length <= 1) {
              router.back();
            }
          }
        },
      },
    ]);
  }, [isSavedView, currentItem, savedItems, deleteFromSaved, items.length]);

  // Single source of truth for index changes: only onMomentumScrollEnd. The
  // previous version also fired from onScrollEndDrag → onScroll, which caused
  // setCurrentIndex to be called twice per swipe on Android 11, triggering a
  // double re-render of every ViewerItem and producing the "stuck/laggy" feel
  // on fast flicks. Momentum-end fires once when the page snaps into place.
  const handleIndexSettled = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SW);
    if (index < 0 || index >= items.length) return;
    if (index === prevIndex.current) return;

    setCurrentIndex(index);
    setShowControls(true);
    controlsOpacity.setValue(1);
    if (items[index]?.type === 'image') {
      onImageSwipe();
    }
    prevIndex.current = index;
  }, [items, onImageSwipe, controlsOpacity]);

  if (!currentItem) return null;

  const isVideoItem = currentItem.type === 'video';

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex > 0 ? initialIndex : undefined}
        getItemLayout={(_, index) => ({
          length: SW,
          offset: SW * index,
          index,
        })}
        onMomentumScrollEnd={handleIndexSettled}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ViewerItem
            item={item}
            isActive={index === currentIndex}
            isNearActive={Math.abs(index - currentIndex) <= 1}
            onToggleControls={toggleControls}
            showControls={showControls}
            controlsOpacity={controlsOpacity}
          />
        )}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
        }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        // ANDROID 11+ FIX: Constant `false` here (the viewer is the ONE place
        // we keep clipped subviews mounted). Was previously toggling between
        // image and video items per page, which forced FlatList to recreate
        // its cell wrappers and destroyed the live VideoView's SurfaceView
        // mid-swipe — causing the dreaded "stuck on black thumbnail then
        // jumps" stutter. With windowSize={3} the memory footprint is still
        // capped at 3 slides while keeping swipe-back literally instant
        // (the bitmap is already on-screen, just translated horizontally —
        // the same pattern Google Photos uses for its pager).
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={50}
      />

      {/* ── Top bar: back + counter. Always visible for video; toggleable for images ── */}
      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            // Top bar is ALWAYS visible for both images and videos. Toggling
            // it for images caused the back button to require two taps on
            // Android 11: the first tap was eaten by the gesture detector to
            // re-show controls, the second finally hit Back. Always-visible
            // top bar matches Instagram/WhatsApp behavior and guarantees a
            // single-tap back.
            opacity: 1,
            zIndex: 150,
          },
        ]}
        // box-none so taps on empty top-bar area still fall through to the
        // image gesture detector below, but the back button itself always
        // receives its own touches.
        pointerEvents="box-none"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topCounter}>{currentIndex + 1} / {items.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* ── VIDEO: Instagram Reels-style right-side action buttons. Always visible. ── */}
      {isVideoItem && (
        <View style={[styles.reelsSidebar, { bottom: insets.bottom + 100 }]} pointerEvents="box-none">
          {/* Save */}
          {!isSavedView && (
            <TouchableOpacity style={styles.reelsBtn} onPress={handleSave} disabled={isSaved || isSaving}>
              <View style={[styles.reelsCircle, isSaved && { backgroundColor: COLORS.PRIMARY + 'CC' }]}>
                {isSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name={isSaved ? 'checkmark-circle' : 'download-outline'} size={26} color="#fff" />}
              </View>
              <Text style={styles.reelsLabel}>{isSaved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
          )}

          {/* Share */}
          <TouchableOpacity style={styles.reelsBtn} onPress={handleShare}>
            <View style={styles.reelsCircle}>
              <Ionicons name="share-social-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.reelsLabel}>Share</Text>
          </TouchableOpacity>

          {/* WhatsApp */}
          <TouchableOpacity style={styles.reelsBtn} onPress={handleShare}>
            <View style={styles.reelsCircle}>
              <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
            </View>
            <Text style={styles.reelsLabel}>WhatsApp</Text>
          </TouchableOpacity>

          {/* Delete (saved view only) */}
          {isSavedView && (
            <TouchableOpacity style={styles.reelsBtn} onPress={handleDelete}>
              <View style={[styles.reelsCircle, { backgroundColor: COLORS.ERROR + 'CC' }]}>
                <Ionicons name="trash-outline" size={26} color="#fff" />
              </View>
              <Text style={styles.reelsLabel}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── IMAGE: horizontal bottom bar with buttons + banner ad. Toggleable. ── */}
      {!isVideoItem && (
        <Animated.View
          style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, opacity: controlsOpacity, pointerEvents: showControls ? 'auto' : 'none', zIndex: 150 }]}
        >
          <View style={styles.viewerAdContainer}>
            <AdBanner size={BannerAdSize.BANNER} style={{ height: 50 }} />
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isSaved ? COLORS.PRIMARY + '33' : COLORS.PRIMARY }]}
            onPress={handleSave}
            disabled={isSaved || isSaving || isSavedView}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={isSaved ? 'checkmark-circle' : 'download'}
                size={20}
                color={isSaved ? COLORS.PRIMARY : '#fff'}
              />
            )}
            <Text style={[styles.actionText, isSaved && { color: COLORS.PRIMARY }]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>

          {isSavedView && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.ERROR + '22' }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={COLORS.ERROR} />
              <Text style={[styles.actionText, { color: COLORS.ERROR }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      <AdInterstitial
        visible={showInterstitial}
        onClose={dismissInterstitial}
        countdown={5}
      />
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  itemContainer: {
    width: SW,
    height: SH,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SW,
    height: SH,
  },
  imageSpinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoWrap: {
    width: SW,
    height: SH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: SW,
    height: SH,
  },
  videoSpinnerWrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBadgeInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.8)',
    // Slight left padding to visually center the play triangle
    paddingLeft: 4,
  },
  videoRetryOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.LG,
    gap: SPACING.SM,
    minWidth: 160,
    minHeight: 48,
    justifyContent: 'center',
  },
  videoRetryText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
  },
  // Custom video controls overlay (FIX 2026-04-27 — replaces nativeControls).
  videoCustomControlsCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCustomPlayBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  videoCustomBottomBar: {
    position: 'absolute',
    left: SPACING.LG,
    right: SPACING.LG,
    bottom: SPACING.XL + 24,
    flexDirection: 'column',
    gap: SPACING.SM,
  },
  videoCustomTimeText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 3,
  },
  videoCustomProgressTouch: {
    paddingVertical: 12, // Generous tap target above and below the visible bar
  },
  videoCustomProgressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  videoCustomProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  skipBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 150,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 2,
  },
  progressKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.PRIMARY,
    marginLeft: -7,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    minWidth: 35,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.SM,
  },
  topTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Nunito_600SemiBold',
  },
  topCounter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: SPACING.SM,
    flexWrap: 'wrap',
  },
  viewerAdContainer: {
    width: '100%',
    height: 50,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM + 2,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 80,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  /* ── Instagram Reels-style right-side vertical action buttons (video only) ── */
  reelsSidebar: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 22,
    zIndex: 200,
  },
  reelsBtn: {
    alignItems: 'center',
    gap: 5,
  },
  reelsCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  reelsLabel: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.MD,
  },
  errorText: {
    color: '#fff',
    fontSize: FONT_SIZE.MD,
    fontFamily: 'Nunito_600SemiBold',
  },
});
