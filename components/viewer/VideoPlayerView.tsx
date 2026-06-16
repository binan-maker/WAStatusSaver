/**
 * VideoPlayerView — expo-video player for a single viewer slide.
 *
 * ── WHY THIS COMPONENT EXISTS ────────────────────────────────────────────────
 * key={displayUri} in the parent forces a completely fresh player (and fresh
 * useVideoPlayer hook) for every new file:// URI.  That avoids stale-player
 * state across slides.
 *
 * ── ANDROID 11+ OEM SURFACE BUG ─────────────────────────────────────────────
 * On many Android 11+ OEM builds (Samsung, Xiaomi, Realme, Oppo …) the
 * SurfaceTexture that expo-video creates for the VideoView can briefly detach
 * and reattach during the first GPU layout pass.  ExoPlayer reacts to the
 * detach by pausing itself (playingChange → isPlaying:false) and then does NOT
 * auto-resume when the surface reattaches.  This is the "plays 1 ms then
 * freezes" report: one frame renders, surface detaches, ExoPlayer freezes.
 *
 * THREE-LAYER DEFENCE:
 *
 *   1. timeUpdate  — fires every 250 ms whenever frames are advancing.
 *      currentTime > 0  means real rendering is happening → confirmPlaying().
 *      This is the most reliable cross-OEM signal.
 *
 *   2. playingChange → isPlaying:false recovery
 *      If the video WAS confirmed playing and then stops unexpectedly while the
 *      slide is still active, we force-resume after 80 ms (surface reattach
 *      window).  This directly cancels the OEM freeze.
 *
 *   3. Nudge schedule — calls player.play() at [50, 200, 500, 1000, 1800, 3000]
 *      ms after mount.  Handles OEMs where the surface attaches AFTER
 *      readyToPlay fires.  Nudges stop the moment confirmPlaying() is called.
 *
 * ── SWIPE-BACK FIX ───────────────────────────────────────────────────────────
 * When isActive flips true→false (swipe away) the parent resets thumbnailOpacity
 * to 1.  When the user swipes back (false→true), we reset hasCalledOnPlaying so
 * onPlaying() can fire again, fading the thumbnail out once more.
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

export function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const hasCalledOnPlaying = useRef(false);
  // Timestamp of the last surface-detach recovery attempt.
  // We enforce a 4-second cooldown between recoveries so that normal ExoPlayer
  // buffering events (isPlaying:false during rebuffer) never trigger player.play().
  // Without a cooldown, the loop is:
  //   buffer → isPlaying:false → recovery → play() → buffer → isPlaying:false → …
  // With a 4-second cooldown only genuine long freezes get a recovery kick.
  const lastRecoveryTime = useRef(0);
  const nudgeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    // timeUpdate fires every 250 ms ONLY when frames are actually advancing.
    // This is our most reliable "video is truly playing" signal.
    p.timeUpdateEventInterval = 0.25;
    // Set playWhenReady=true immediately — ExoPlayer will start as soon as the
    // surface attaches, without needing a second play() call from JS.
    p.play();
  });

  const clearNudges = () => {
    nudgeTimers.current.forEach(clearTimeout);
    nudgeTimers.current = [];
  };

  // Stable callback — safe to capture in the [] effect.
  const confirmPlaying = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    clearNudges();
    onPlaying();
  }, [onPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // ── Layer 1: timeUpdate ───────────────────────────────────────────────────
    // currentTime > 0 means ExoPlayer IS rendering frames to the screen.
    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
      if ((event.currentTime ?? 0) > 0) confirmPlaying();
    });

    // ── Layer 2: playingChange ────────────────────────────────────────────────
    // • isPlaying: true  → backup confirmation (some OEMs skip timeUpdate).
    // • isPlaying: false → RECOVERY: only if the video was confirmed playing,
    //   the slide is still active, AND at least 4 seconds have elapsed since
    //   the last recovery attempt.
    //
    // WHY 4-SECOND COOLDOWN instead of a per-event gate:
    //   ExoPlayer fires isPlaying:false on every rebuffer (~1 s on slow
    //   connections).  player.play() itself causes a brief isPlaying:false
    //   while ExoPlayer re-prepares.  A per-event gate (recoveryFired) resets
    //   on the next isPlaying:true, so the loop still runs every few seconds.
    //   A time-based cooldown ensures at most one forced play() per 4 s window,
    //   which stops the play→freeze→play→freeze cycle while still kicking a
    //   genuinely frozen video back to life.
    const playingSub = player.addListener('playingChange', (event: any) => {
      if (event.isPlaying) {
        confirmPlaying();
      } else if (hasCalledOnPlaying.current && isActiveRef.current) {
        const now = Date.now();
        if (now - lastRecoveryTime.current > 4000) {
          lastRecoveryTime.current = now;
          setTimeout(() => {
            if (isActiveRef.current) {
              try { player.play(); } catch {}
            }
          }, 80);
        }
      }
    });

    const statusSub = player.addListener('statusChange', (event: any) => {
      if (event.status === 'error') {
        clearNudges();
        onError(event.error?.message ?? 'Playback error');
      }
    });

    // Fast path: player already playing before our listeners attached.
    if ((player as any).playing) {
      confirmPlaying();
    }

    // ── Layer 3: nudge schedule ───────────────────────────────────────────────
    // SurfaceView attachment on Android can lag behind readyToPlay by hundreds
    // of ms.  We fire play() at escalating delays so we hit the moment the
    // surface IS ready.  Stops immediately when confirmPlaying() fires.
    const nudgeDelays = [50, 200, 500, 1000, 1800, 3000];
    nudgeTimers.current = nudgeDelays.map((delay) =>
      setTimeout(() => {
        if (!hasCalledOnPlaying.current && isActiveRef.current) {
          try { player.play(); } catch {}
        }
      }, delay),
    );

    return () => {
      timeUpdateSub.remove();
      playingSub.remove();
      statusSub.remove();
      clearNudges();
      try { player.release(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pause / resume + swipe-back reset ────────────────────────────────────
  // When isActive goes true→false: pause (parent also resets thumbnailOpacity→1).
  // When isActive goes false→true: reset hasCalledOnPlaying so onPlaying() fires
  // again, which fades the thumbnail back out.
  useEffect(() => {
    try {
      if (isActive) {
        // Allow onPlaying() to fire again after a swipe-back so the thumbnail
        // fades correctly on resume (parent reset opacity to 1 on inactive).
        hasCalledOnPlaying.current = false;
        lastRecoveryTime.current = 0; // Reset cooldown — fresh activation window
        player.play();
      } else {
        player.pause();
      }
    } catch {}
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={false}
      contentFit="contain"
    />
  );
}
