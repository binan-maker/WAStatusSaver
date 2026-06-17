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

export function getActiveMountedCount(): number {
  return _mountedCount;
}

// React.memo: prevents re-renders from unrelated ViewerItem state changes
// (exoPaused, videoPlayerMounted, etc.). On Android 11+ a VideoView re-render
// briefly detaches its SurfaceTexture from ExoPlayer, pausing playback.
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

  // NOTE: No stall-recovery timers here. The previous armStallTimer logic
  // (pause→play at ~1s) was the cause of the Android 11+ freeze, not the
  // cure. On Android 11+ Media3/ExoPlayer the decoder state machine is
  // strict: interrupting it with pause()+play() during codec warm-up
  // (which happens in the first ~1s of playback) leaves the decoder stuck.
  // Android 10 tolerates it because it uses an older ExoPlayer build.
  //
  // The real fix for the content:// streaming issue is prepareStatusForViewing()
  // in MediaContextSAF — videos are ALWAYS copied to a local file:// path
  // before being handed to the player, so there is no buffer-starvation
  // problem to recover from. Stall recovery is unnecessary and harmful.
  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    // 0.5s interval = 2 events/sec. Enough to detect first real frame for
    // the thumbnail-fade callback. Never set below 0.2 — tighter intervals
    // flood the JS thread with bridge events during the most critical codec
    // initialization window (first 0–2s) and cause jank on mid-range devices.
    p.timeUpdateEventInterval = 0.5;
    p.play();
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
      // Only confirm once playback has genuinely advanced past 0.
      if (time > 0) {
        confirmPlaying();
      }
    });

    const statusSub = player.addListener('statusChange', (event: any) => {
      if (event.status === 'error') {
        onError(event.error?.message ?? 'Playback error');
        return;
      }
      // One-time nudge: player finished preparing but hasn't started yet.
      // This covers the Android 11+ surface-attach race where playWhenReady
      // was set before the VideoView's SurfaceTexture was fully attached.
      // This fires AT MOST ONCE per player instance — it is not a loop.
      // Do NOT add player.play() anywhere else: every extra call risks
      // interrupting internal Media3 state transitions.
      if (event.status === 'readyToPlay' && isActiveRef.current && !player.playing) {
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

  // Pause on swipe-away (400 ms debounce); resume + reset on swipe-back.
  // The debounce absorbs transient isActive=false flickers from FlatList
  // reconciliation (one-frame false on the active slide) so the decoder
  // is never interrupted by a render-timing artifact.
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
