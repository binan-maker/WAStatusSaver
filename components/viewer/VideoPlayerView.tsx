/**
 * VideoPlayerView — expo-video wrapper for the status viewer.
 *
 * ANDROID 11+ FREEZE ROOT CAUSE & FIX
 * ────────────────────────────────────
 * The original code called player.play() in THREE places:
 *   1. useVideoPlayer initializer  → sets playWhenReady=true immediately
 *   2. statusChange → readyToPlay  → second play() when ready
 *   3. timeUpdate stall recovery   → pause()+play() at ~1s
 *
 * On Android 11+ Media3, the decoder warm-up takes 800ms–1.5s. During
 * this window the SurfaceTexture is being attached to ExoPlayer's codec.
 * Any play()/pause() call that arrives while the surface is mid-attach
 * can leave the Media3 pipeline stuck — the decoder acquires its input
 * buffer slot but never gets the signal to start draining it.
 *
 * Fix: play() is called in EXACTLY ONE place — the readyToPlay handler.
 * The initializer does NOT call p.play(). The stall recovery is gone.
 * On swipe-back, player.play() is safe because readyToPlay has already
 * fired (the MediaItem is still loaded) — no surface re-attachment race.
 *
 * timeUpdateEventInterval = 0.5s (2 events/sec). Enough for the
 * thumbnail-fade callback. The old 0.1s (10/sec) flooded the JS thread
 * during the codec init window and worsened jank on mid-range devices.
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

let _mountedCount = 0;
export function getActiveMountedCount(): number { return _mountedCount; }

export const VideoPlayerView = React.memo(function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const hasCalledOnPlaying = useRef(false);
  const didMountRef = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether readyToPlay has fired for the current file.
  // Reset on swipe-back so that if the player was released and re-mounted
  // for a new URI, play() will be called again via readyToPlay.
  const readyFiredRef = useRef(false);

  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    p.timeUpdateEventInterval = 0.5;
    // DO NOT call p.play() here.
    // Calling play() before the SurfaceTexture is attached causes Android 11+
    // Media3 to enter a broken state where the decoder prepares and renders
    // one frame but never advances. readyToPlay fires after surface attachment
    // is complete and is the only safe point to begin playback.
  });

  const confirmPlaying = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  }, [onPlaying]);

  useEffect(() => {
    _mountedCount++;

    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
      const time = event.currentTime ?? 0;
      if (time > 0) confirmPlaying();
    });

    const statusSub = player.addListener('statusChange', (event: any) => {
      if (event.status === 'error') {
        onError(event.error?.message ?? 'Playback error');
        return;
      }
      if (event.status === 'readyToPlay' && isActiveRef.current && !readyFiredRef.current) {
        // Play exactly once per file load, after Media3 confirms the
        // decoder and surface are both fully ready.
        readyFiredRef.current = true;
        try { player.play(); } catch {}
      }
    });

    return () => {
      timeUpdateSub.remove();
      statusSub.remove();
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      try { player.release(); } catch {}
      _mountedCount--;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause on swipe-away (400ms debounce absorbs FlatList transient flickers);
  // resume on swipe-back. readyToPlay has already fired for this file so a
  // direct play() call is safe here — no second surface-attach race.
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
      // readyFiredRef stays true — file is already loaded, play() is safe.
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
      contentFit="cover"
    />
  );
});
