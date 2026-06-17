/**
 * VideoPlayerView — expo-video player for a single viewer slide.
 *
 * ── WHY React.memo ───────────────────────────────────────────────────────────
 * ViewerItem re-renders frequently due to unrelated state changes (exoPaused,
 * videoPlayerMounted, thumbnailOpacity animations, etc.).  Without memo, each
 * ViewerItem re-render also re-renders VideoPlayerView, which re-renders the
 * native VideoView underneath it.  On Android 11+ a VideoView re-render
 * temporarily detaches its SurfaceTexture from ExoPlayer.  ExoPlayer loses its
 * render surface, stops producing frames, and emits playingChange=false with a
 * full buffer — the "freeze after 1 second" symptom.  React.memo stops this:
 * if fileUri / isActive / callbacks haven't changed, VideoPlayerView is skipped
 * entirely.  The URI-type log fires on every render; with memo it should appear
 * exactly ONCE per mount.  Seeing it twice means props changed unexpectedly.
 *
 * ── PLAYBACK STRATEGY ────────────────────────────────────────────────────────
 * p.play() in useVideoPlayer sets playWhenReady=true before the surface
 * attaches.  ExoPlayer holds that flag and starts automatically once the
 * SurfaceTexture is ready.  A secondary nudge fires from statusChange=
 * readyToPlay for Android 11+ devices where the surface sometimes attaches
 * after the status event fires.
 *
 * ── RECOVERY ─────────────────────────────────────────────────────────────────
 * On Android 11+, playingChange=false can fire unexpectedly while the video
 * has buffer and no error (SurfaceTexture lifecycle issue or audio-focus blip).
 * A single-shot 500 ms delayed play() re-nudges ExoPlayer.  The 500 ms gap
 * prevents interrupting codec initialization — the repeated-timer approach
 * that caused the old play→freeze→play loop.  A ref flag ensures this fires
 * at most once per player instance per active session.
 *
 * ── PAUSE DEBOUNCE ───────────────────────────────────────────────────────────
 * isActive can briefly flip false→true within a single React render batch
 * (e.g. when a background setStatuses() call shifts item indices).  A 400 ms
 * debounce absorbs those flickers: real swipe-aways keep isActive=false long
 * enough for the timeout to fire; render-only flickers cancel it.
 *
 * ── NATIVE CONTROLS ──────────────────────────────────────────────────────────
 * nativeControls=false — the Android MediaController overlay was removed.
 * On Android 11+ it could temporarily steal audio focus and trigger a pause.
 * The viewer's own controls overlay handles any UI the user needs.
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
// Tracks how many VideoPlayerView instances are alive at once.
// Should always be 1 (the active slide). If you see 2+ the FlatList window
// is mounting too many players simultaneously — that competes for the hardware
// decoder and causes freezes.
let _mountedCount = 0;

/**
 * Returns the number of VideoPlayerView instances currently mounted.
 * ViewerItem reads this BEFORE mounting a new player so it can delay
 * the mount until any existing player has had time to unmount (32 ms
 * debounce), guaranteeing totalActive never exceeds 1.
 */
export function getActiveMountedCount(): number {
  return _mountedCount;
}

// ── React.memo wrapper ────────────────────────────────────────────────────────
// Props: fileUri (changes on new slide via key=), isActive, onPlaying (stable
// useCallback ref), onError (stable useCallback ref).
// When ViewerItem re-renders without changing these props, VideoPlayerView is
// skipped — no VideoView re-render, no SurfaceTexture disruption.
export const VideoPlayerView = React.memo(function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const hasCalledOnPlaying = useRef(false);
  // Skips the isActive effect on first mount — useVideoPlayer initializer
  // already called p.play(), a second call interrupts codec initialization.
  const didMountRef = useRef(false);
  // Pause debounce timer.
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Single-shot recovery flag — allows at most one recovery play() per active
  // session. Resets when isActive goes true (new swipe-to slide).
  const recoveryFiredRef = useRef(false);

  // ── URI diagnostic log ────────────────────────────────────────────────────
  // Fires on every render. With React.memo should appear ONCE per mount.
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
    // Sets playWhenReady=true — ExoPlayer starts as soon as the surface
    // attaches. The statusChange=readyToPlay handler provides a secondary
    // nudge for Android 11+ where the surface may arrive asynchronously.
    p.play();
  });

  const confirmPlaying = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  }, [onPlaying]);

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

    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
      if ((event.currentTime ?? 0) > 0) confirmPlaying();
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
      // Android 11+ secondary nudge: player became ready but hasn't started.
      // This covers the race where playWhenReady=true was set in the
      // initializer before the VideoView's SurfaceTexture was available.
      // The statusChange event fires on the player thread where the surface
      // IS attached, so play() here is safe and won't interrupt buffering.
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

      if (event.isPlaying) {
        // Playback is live — reset the recovery gate so a future unexpected
        // stop (after a real frame advance) can trigger one more recovery.
        recoveryFiredRef.current = false;
        return;
      }

      // isPlaying went false while this slide is active with no error and
      // available buffer — unexpected stop (Android 11+ SurfaceTexture blip
      // or audio-focus transient loss).  Schedule a single recovery play()
      // 500 ms later.  500 ms gap prevents interrupting codec init (the
      // repeated-timer approach that caused the old play→freeze loop).
      if (isActiveRef.current && !recoveryFiredRef.current) {
        recoveryFiredRef.current = true;
        setTimeout(() => {
          const buffered = player.bufferedPosition ?? 0;
          const stillStopped = !player.playing && player.status === 'readyToPlay';
          const stillActive = isActiveRef.current;
          console.log(
            '[VideoPlayer] recovery check: stillActive=' + stillActive +
            ' stillStopped=' + stillStopped +
            ' buffered=' + buffered.toFixed(2),
          );
          if (stillActive && stillStopped && buffered > 0.1) {
            console.log('[VideoPlayer] recovery → play()');
            try { player.play(); } catch {}
          }
        }, 500);
      }
    });

    return () => {
      timeUpdateSub.remove();
      statusSub.remove();
      playingSub.remove();
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      try { player.release(); } catch {}
      _mountedCount--;
      console.log('[VideoPlayer] UNMOUNTED totalActive=' + _mountedCount);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause when swiped away; resume + reset thumbnail gate on swipe-back.
  //
  // Skips the initial mount (useVideoPlayer initializer already called p.play()).
  //
  // Pause is DEBOUNCED 400 ms — isActive can briefly flip false during a render
  // batch caused by a background setStatuses() call. Real swipe-aways stay
  // false long enough; render flickers cancel the timer before it fires.
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
      recoveryFiredRef.current = false;
      // Only call play() when not already playing — calling it on an active
      // ExoPlayer interrupts its buffer-fill pipeline on Android 11+.
      try { if (!player.playing) player.play(); } catch {}
    } else {
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
