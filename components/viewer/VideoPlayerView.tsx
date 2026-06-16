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

export function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // ── URI diagnostic log ────────────────────────────────────────────────────
  // Remove once the freeze root-cause is confirmed.
  console.log(
    '[VideoPlayerView] uri_type=' +
      (fileUri.startsWith('file://') ? 'FILE' : fileUri.startsWith('content://') ? 'CONTENT⚠️' : 'OTHER⚠️') +
      ' uri=' + fileUri.slice(0, 100),
  );

  const hasCalledOnPlaying = useRef(false);

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
    // timeUpdate fires every 250 ms only when frames are actually rendering.
    // currentTime > 0 is the most reliable cross-OEM "video is on screen" signal.
    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
      if ((event.currentTime ?? 0) > 0) confirmPlaying();
    });

    const statusSub = player.addListener('statusChange', (event: any) => {
      if (event.status === 'error') {
        onError(event.error?.message ?? 'Playback error');
      }
    });

    return () => {
      timeUpdateSub.remove();
      statusSub.remove();
      try { player.release(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause when swipped away; resume + reset thumbnail gate on swipe-back.
  useEffect(() => {
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
