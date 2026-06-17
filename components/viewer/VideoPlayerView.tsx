/**
 * VideoPlayerView — expo-video wrapper for the status viewer.
 *
 * ANDROID 11+ FREEZE: ROOT CAUSE & FIX
 * ─────────────────────────────────────
 * The freeze at ~1s was caused by `armStallTimer` calling pause()→play() during
 * Media3's codec warm-up window. That recovery loop is GONE.
 *
 * PLAY STRATEGY: call player.play() once in the useVideoPlayer initializer.
 * This sets Media3's internal `playWhenReady = true`. Media3 holds that flag
 * and executes play() only after BOTH conditions are satisfied:
 *   1. Media is loaded (moov atom parsed, decoder configured)
 *   2. SurfaceTexture is attached to the codec
 * This is the only correct and safe sequence on Android 11+ — there is no
 * "double play" race because the second condition (surface) is checked
 * internally by Media3, not by JS.
 *
 * The previous approach of waiting for statusChange → readyToPlay and THEN
 * calling play() introduced a race: on some Android 11+ OEM builds readyToPlay
 * fires before the SurfaceTexture is fully attached to the VideoView, meaning
 * play() is called too early and the decoder never starts. Setting
 * playWhenReady=true in the initializer is safer because Media3 re-evaluates
 * the flag every time the surface state changes.
 *
 * VIDEO SIZE: contentFit="contain" shows the full video frame without any
 * cropping or zoom, matching the original WhatsApp status dimensions.
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
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    // timeUpdate at 0.5s is enough to detect playback start for the thumbnail
    // fade. The old 0.1s interval (10 events/sec) flooded the JS bridge during
    // the codec init window and increased jank on mid-range devices.
    p.timeUpdateEventInterval = 0.5;
    // Sets playWhenReady = true. Media3 will NOT start playback immediately —
    // it holds this flag until the decoder is ready AND the SurfaceTexture is
    // attached to the codec output surface. Both conditions must be met.
    // This is the correct, race-free way to trigger autoplay on Android 11+.
    p.play();
  });

  const confirmPlaying = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  }, [onPlaying]);

  // Mount/unmount lifecycle: register with the global decoder-gate counter,
  // attach event listeners, and release the decoder when the slide unmounts.
  useEffect(() => {
    _mountedCount++;

    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
      // currentTime > 0 means the decoder is actually producing frames.
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
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      try { player.release(); } catch {}
      _mountedCount--;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause on swipe-away (400ms debounce absorbs FlatList transient flickers
  // of ~16ms so we don't pause during a scroll that lands back on this slide).
  // Resume immediately on swipe-back: player is already loaded, play() is safe.
  useEffect(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (isActive) {
      hasCalledOnPlaying.current = false;
      try { if (!player.playing) player.play(); } catch {}
    } else {
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (!isActiveRef.current) try { player.pause(); } catch {}
      }, 400);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={false}
      // "contain" = show the full video frame at its natural aspect ratio,
      // no cropping, no zoom. The user sees the status exactly as WhatsApp
      // recorded it, with black letterbox bars if the aspect ratio differs
      // from the screen.
      contentFit="contain"
    />
  );
});
