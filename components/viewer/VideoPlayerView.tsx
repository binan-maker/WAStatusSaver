/**
 * VideoPlayerView — expo-video player for a single viewer slide.
 *
 * ── WHY React.memo ───────────────────────────────────────────────────────────
 * ViewerItem re-renders frequently due to unrelated state changes (exoPaused,
 * videoPlayerMounted, thumbnailOpacity, etc.).  Without memo, each ViewerItem
 * re-render also re-renders VideoPlayerView, which re-renders the native
 * VideoView underneath it.  On Android 11+ a VideoView re-render temporarily
 * detaches its SurfaceTexture from ExoPlayer — the player loses its render
 * target, stops producing frames, and emits playingChange=false with a full
 * buffer (the "freeze after 1 second" symptom).  React.memo stops this: if
 * fileUri / isActive / callbacks haven't changed, VideoPlayerView is skipped.
 * The URI-type log fires on every render; with memo it should appear exactly
 * ONCE per mount.  Seeing it twice means props changed unexpectedly.
 *
 * ── PLAYBACK STRATEGY ────────────────────────────────────────────────────────
 * p.play() in useVideoPlayer sets playWhenReady=true.  ExoPlayer starts as
 * soon as the surface attaches.  A one-time nudge from statusChange=readyToPlay
 * covers Android 11+ devices where the surface arrives asynchronously.
 *
 * ── STALL WATCHDOG ───────────────────────────────────────────────────────────
 * On Android 11+ ExoPlayer can intermittently emit playingChange=false while
 * the video is internally transitioning (audio-focus handoff, codec warm-up).
 * Using playingChange=false as the recovery trigger is WRONG — it fires for
 * normal internal transitions and calling play() on those interrupts the codec
 * pipeline, producing the play→freeze→play stutter loop.
 *
 * Instead we watch timeUpdate, which only fires when real frames are advancing
 * to the screen (currentTime > 0).  If timeUpdate stops firing for 1.5 s while
 * the slide is active and the player is in a ready state, we call play() once.
 * A per-session counter (max 3) prevents runaway recovery even in degenerate
 * cases.  The timer is cleared every time a frame is confirmed (timeUpdate)
 * and cancelled whenever the slide becomes inactive.
 *
 * ── PAUSE DEBOUNCE ───────────────────────────────────────────────────────────
 * isActive can briefly flip false→true within a single React render batch
 * (background setStatuses() shifting item indices).  A 400 ms debounce absorbs
 * those flickers — real swipe-aways keep isActive=false long enough to fire;
 * render-only flickers cancel it.
 *
 * ── NATIVE CONTROLS ──────────────────────────────────────────────────────────
 * nativeControls=false — the Android MediaController was removed.  On Android
 * 11+ it could transiently steal audio focus and trigger a pause.  The viewer
 * overlay handles any UI the user needs.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoPlayerViewProps {
  fileUri: string;
  isActive: boolean;
  onPlaying: () => void;
  onError: (message: string) => void;
}

// ── Mount counter (module-level) ──────────────────────────────────────────────
let _mountedCount = 0;

export function getActiveMountedCount(): number {
  return _mountedCount;
}

// ── Stall watchdog timing ─────────────────────────────────────────────────────
// How long without a timeUpdate frame before we call play() as recovery.
const STALL_TIMEOUT_MS = 1500;
// Maximum recovery attempts per player instance (prevents runaway loops).
const MAX_RECOVERY_ATTEMPTS = 3;

export const VideoPlayerView = React.memo(function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const hasCalledOnPlaying = useRef(false);
  // Skip isActive effect on first mount — useVideoPlayer initializer already
  // called p.play(); a second call interrupts codec initialization.
  const didMountRef = useRef(false);
  // Pause debounce timer.
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stall watchdog ────────────────────────────────────────────────────────
  // Cleared every time timeUpdate fires (frames advancing → not stalled).
  // Fires if no frame advances for STALL_TIMEOUT_MS while slide is active.
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // How many recovery play() calls have been made this session.  Resets when
  // isActive becomes true (new view session).  Capped at MAX_RECOVERY_ATTEMPTS.
  const stallCountRef = useRef(0);

  // ── URI diagnostic log ────────────────────────────────────────────────────
  // With React.memo this should fire exactly once per mount (props stable).
  // Seeing it twice means a prop changed — investigate the caller.
  const uriType = fileUri.startsWith('file://')
    ? 'FILE'
    : fileUri.startsWith('content://')
    ? 'CONTENT⚠️'
    : 'OTHER⚠️';
  console.log('[VideoPlayer] URI type=' + uriType + ' uri=' + fileUri.slice(0, 100));

  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    // timeUpdate fires every 250 ms only when frames are advancing.
    p.timeUpdateEventInterval = 0.25;
    // Sets playWhenReady=true.  ExoPlayer starts when the surface attaches.
    // The statusChange=readyToPlay handler provides a one-time nudge for
    // Android 11+ where the surface may arrive asynchronously.
    p.play();
  });

  const confirmPlaying = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  }, [onPlaying]);

  // ── Stall watchdog helpers ─────────────────────────────────────────────────
  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const armStallTimer = useCallback(() => {
    clearStallTimer();
    if (stallCountRef.current >= MAX_RECOVERY_ATTEMPTS) return;
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      const buffered = player.bufferedPosition ?? 0;
      const ready = player.status === 'readyToPlay';
      const stopped = !player.playing;
      const active = isActiveRef.current;
      console.log(
        '[VideoPlayer] stall watchdog fired:' +
        ' active=' + active +
        ' ready=' + ready +
        ' stopped=' + stopped +
        ' buffered=' + buffered.toFixed(2) +
        ' attempt=' + (stallCountRef.current + 1) + '/' + MAX_RECOVERY_ATTEMPTS,
      );
      if (active && ready && stopped && buffered > 0.1) {
        stallCountRef.current++;
        console.log('[VideoPlayer] stall recovery → play()');
        try { player.play(); } catch {}
        // Re-arm so we can detect if the recovery itself stalls.
        armStallTimer();
      }
    }, STALL_TIMEOUT_MS);
  }, [player, clearStallTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // ── Mount log ─────────────────────────────────────────────────────────
    _mountedCount++;
    const mountTag = _mountedCount > 1
      ? ' ⚠️ MULTIPLE PLAYERS — decoder conflict!'
      : ' ✅ sole player';
    console.log(
      '[VideoPlayer] MOUNTED totalActive=' + _mountedCount + mountTag +
      ' uri=' + fileUri.slice(fileUri.lastIndexOf('/') + 1, fileUri.lastIndexOf('/') + 40),
    );

    // Arm the initial stall watchdog — if no frame advances within 1.5 s of
    // mount and the player is ready, something went wrong.
    armStallTimer();

    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
      if ((event.currentTime ?? 0) > 0) {
        confirmPlaying();
        // Frames are advancing — player is healthy.  Reset the stall watchdog
        // so it only fires if frames genuinely stop again.
        armStallTimer();
      }
    });

    const statusSub = player.addListener('statusChange', (event: any) => {
      console.log(
        '[VideoPlayer] statusChange status=' + event.status +
        ' currentTime=' + (player.currentTime?.toFixed(2) ?? '?') +
        ' buffered=' + (player.bufferedPosition?.toFixed(2) ?? '?') +
        (event.status === 'error' ? ' error=' + (event.error?.message ?? 'unknown') : ''),
      );
      if (event.status === 'error') {
        onError(event.error?.message ?? 'Playback error');
        return;
      }
      // One-time nudge when the player becomes ready but hasn't started.
      // This covers the Android 11+ surface-arrives-after-playWhenReady race.
      // We do NOT use this for ongoing recovery — see stall watchdog above.
      if (event.status === 'readyToPlay' && isActiveRef.current && !player.playing) {
        console.log('[VideoPlayer] readyToPlay but not playing → nudge play()');
        try { player.play(); } catch {}
      }
    });

    const playingSub = player.addListener('playingChange', (event: any) => {
      console.log(
        '[VideoPlayer] playingChange isPlaying=' + event.isPlaying +
        ' currentTime=' + (player.currentTime?.toFixed(2) ?? '?') +
        ' buffered=' + (player.bufferedPosition?.toFixed(2) ?? '?'),
      );
      // NOTE: Do NOT call player.play() here in response to isPlaying=false.
      // playingChange fires for internal ExoPlayer transitions (audio-focus
      // handoffs, codec warm-up pauses) that resolve on their own.  Calling
      // play() on those transitions interrupts the codec pipeline and creates
      // the play→freeze→play stutter loop.  The stall watchdog above handles
      // genuine stalls safely via timeUpdate instead.
    });

    return () => {
      timeUpdateSub.remove();
      statusSub.remove();
      playingSub.remove();
      clearStallTimer();
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      try { player.release(); } catch {}
      _mountedCount--;
      console.log('[VideoPlayer] UNMOUNTED totalActive=' + _mountedCount);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause when swiped away; resume + reset on swipe-back.
  // Debounced 400 ms — real swipe-aways stay false long enough to fire;
  // render flickers cancel before firing.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    if (isActive) {
      hasCalledOnPlaying.current = false;
      stallCountRef.current = 0; // Reset stall counter for new view session.
      armStallTimer();            // Start watchdog for this view session.
      // Only call play() when not already playing — calling it on an active
      // ExoPlayer interrupts its buffer-fill pipeline on Android 11+.
      try { if (!player.playing) player.play(); } catch {}
    } else {
      clearStallTimer(); // No watchdog needed when slide is inactive.
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (!isActiveRef.current) {
          try { player.pause(); } catch {}
        }
      }, 400);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={false}
      contentFit="contain"
    />
  );
});
