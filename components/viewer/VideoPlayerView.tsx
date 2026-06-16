/**
 * VideoPlayerView — expo-video player for a single viewer slide.
 *
 * ── WHY THIS COMPONENT EXISTS ────────────────────────────────────────────────
 * key={displayUri} in the parent forces a completely fresh player (and fresh
 * useVideoPlayer hook) for every new file:// URI.  That avoids stale-player
 * state across slides.
 *
 * ── PLAYBACK STRATEGY ────────────────────────────────────────────────────────
 * p.play() inside useVideoPlayer sets ExoPlayer's playWhenReady=true before
 * the surface attaches.  ExoPlayer holds that flag and starts automatically
 * the moment the SurfaceTexture is ready — no external nudge needed.
 *
 * Previous versions added recovery timers and nudge schedules that called
 * player.play() repeatedly after mount.  Those extra calls interrupted
 * ExoPlayer's internal buffer-fill pipeline, causing the play→freeze→play
 * loop on Android 11+.  Removing them lets ExoPlayer manage its own startup
 * and buffering without JS interference.
 *
 * ── THUMBNAIL FADE ───────────────────────────────────────────────────────────
 * timeUpdate fires every 250 ms ONLY when frames are actually advancing to the
 * screen (currentTime > 0).  That is the signal we use to fade the poster
 * thumbnail out.  It is more reliable than playingChange because it confirms
 * real rendering, not just an internal ExoPlayer state flip.
 *
 * ── SWIPE-BACK ───────────────────────────────────────────────────────────────
 * When isActive flips false→true the parent has already reset thumbnailOpacity
 * to 1, so we reset hasCalledOnPlaying so onPlaying() can fire again and fade
 * the thumbnail back out.
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

export function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const hasCalledOnPlaying = useRef(false);
  // True after first render — prevents calling player.play() twice on mount.
  // useVideoPlayer initializer already sets playWhenReady=true; a second play()
  // call from the isActive effect interrupts ExoPlayer's buffer-fill pipeline
  // and causes the play→freeze symptom on Android 11+.
  const didMountRef = useRef(false);

  // ── URI diagnostic log ────────────────────────────────────────────────────
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
    // attaches.  No further play() calls are needed from JS.
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
    console.log('[VideoPlayer] MOUNTED totalActive=' + _mountedCount + (
      _mountedCount > 1 ? ' ⚠️ MULTIPLE PLAYERS' : ''
    ));

    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
      if ((event.currentTime ?? 0) > 0) confirmPlaying();
    });

    const statusSub = player.addListener('statusChange', (event: any) => {
      // Log every status change so buffering stalls are visible in logcat.
      console.log(
        '[VideoPlayer] statusChange status=' + event.status +
        ' currentTime=' + (player.currentTime?.toFixed(2) ?? '?') +
        ' buffered=' + (player.bufferedPosition?.toFixed(2) ?? '?'),
      );
      if (event.status === 'error') {
        onError(event.error?.message ?? 'Playback error');
      }
    });

    const playingSub = player.addListener('playingChange', (event: any) => {
      // This log catches play→pause→play loops triggered by external code.
      // If you see rapid alternating true/false here WITHOUT user interaction
      // that is the recovery-loop root cause.
      console.log(
        '[VideoPlayer] playingChange isPlaying=' + event.isPlaying +
        ' currentTime=' + (player.currentTime?.toFixed(2) ?? '?'),
      );
    });

    return () => {
      timeUpdateSub.remove();
      statusSub.remove();
      playingSub.remove();
      try { player.release(); } catch {}
      _mountedCount--;
      console.log('[VideoPlayer] UNMOUNTED totalActive=' + _mountedCount);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause when swiped away; resume + reset thumbnail gate on swipe-back.
  // Skip the initial mount: useVideoPlayer's initializer already called p.play(),
  // so running play() again here interrupts ExoPlayer's buffer-fill and causes
  // the play→freeze symptom at ~0.7 s on Android 11+.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    try {
      if (isActive) {
        hasCalledOnPlaying.current = false;
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
