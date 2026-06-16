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
  // Pending recovery timer.  Strategy: when isPlaying:false fires, we do NOT
  // immediately call player.play() — instead we wait 300 ms to see if ExoPlayer
  // self-recovers (normal buffering refill).  If isPlaying:true fires within
  // those 300 ms we cancel the timer (no-op).  If the player is STILL stopped
  // after 300 ms it is a genuine freeze (surface detach / OEM GPU stall) and we
  // force-resume.  This prevents both:
  //   • immediate recovery → buffering → recovery → loop  (old 80 ms behaviour)
  //   • 4-second gap → user sees a 3-second hard freeze  (previous fix)
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    // • isPlaying: true  → cancel any pending recovery (ExoPlayer self-healed)
    //   and confirm playing.
    // • isPlaying: false → arm a 300 ms recovery timer.  If the player comes
    //   back on its own before 300 ms (normal buffering), the timer is cancelled.
    //   If it is STILL stopped after 300 ms it is a genuine surface-detach /
    //   OEM GPU freeze — we force-resume.
    //
    //   This "wait-and-cancel" pattern avoids both failure modes:
    //     1. Immediate recovery (80 ms) — player.play() interrupts the buffer
    //        refill, which itself fires isPlaying:false → new recovery → loop.
    //     2. Long cooldown (4 s) — genuine freeze is not recovered for 4 s so
    //        the user sees a hard freeze for several seconds.
    const playingSub = player.addListener('playingChange', (event: any) => {
      if (event.isPlaying) {
        // Player came back — cancel any pending recovery, it is not needed.
        if (recoveryTimer.current) {
          clearTimeout(recoveryTimer.current);
          recoveryTimer.current = null;
        }
        confirmPlaying();
      } else if (hasCalledOnPlaying.current && isActiveRef.current) {
        // Arm recovery — will fire only if player is STILL stopped at 300 ms.
        if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
        recoveryTimer.current = setTimeout(() => {
          recoveryTimer.current = null;
          if (isActiveRef.current && hasCalledOnPlaying.current) {
            try { player.play(); } catch {}
          }
        }, 300);
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
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
        recoveryTimer.current = null;
      }
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
        if (recoveryTimer.current) {
          clearTimeout(recoveryTimer.current);
          recoveryTimer.current = null;
        }
        player.play();
      } else {
        // Cancel any pending recovery when leaving this slide.
        if (recoveryTimer.current) {
          clearTimeout(recoveryTimer.current);
          recoveryTimer.current = null;
        }
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
