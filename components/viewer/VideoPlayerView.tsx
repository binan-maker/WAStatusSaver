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

// How long without a timeUpdate frame before calling play() as stall recovery.
// 500 ms: fast enough to recover before the user swipes away, long enough to
// avoid interrupting codec initialization (which is what caused the old
// play→freeze→play loop when recovery was triggered too eagerly).
const STALL_TIMEOUT_MS = 500;
// Maximum recovery attempts per active session (resets on isActive → true).
const MAX_RECOVERY_ATTEMPTS = 3;

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
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallCountRef = useRef(0);

  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
p.timeUpdateEventInterval = 0.1;    p.play();
  });

  const confirmPlaying = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  }, [onPlaying]);

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const lastTimeRef = useRef(0);

const armStallTimer = useCallback(() => {
  clearStallTimer();

  if (stallCountRef.current >= MAX_RECOVERY_ATTEMPTS) return;

  stallTimerRef.current = setTimeout(() => {
    stallTimerRef.current = null;

    if (!isActiveRef.current) return;

    const currentTime = player.currentTime ?? 0;

    if (
      player.status === 'readyToPlay' &&
      currentTime <= lastTimeRef.current + 0.05
    ) {
      stallCountRef.current++;

      try {
        player.pause();
      } catch {}

      setTimeout(() => {
        try {
          player.play();
        } catch {}
      }, 100);

      armStallTimer();
    }
  }, 1000);
}, [player]);

  useEffect(() => {
    _mountedCount++;

    // Arm immediately — catches cases where the player loads but never starts.
    armStallTimer();

    
    const timeUpdateSub = player.addListener('timeUpdate', (event: any) => {
  const time = event.currentTime ?? 0;

  lastTimeRef.current = time;

  if (time > 0) {
    confirmPlaying();
    armStallTimer();
  }
});

    const statusSub = player.addListener('statusChange', (event: any) => {
      if (event.status === 'error') {
        onError(event.error?.message ?? 'Playback error');
        return;
      }
      // One-time nudge: player is ready but hasn't started yet.
      // Covers Android 11+ race where playWhenReady was set before the
      // VideoView's SurfaceTexture was attached.
      if (event.status === 'readyToPlay' && isActiveRef.current && !player.playing) {
        try { player.play(); } catch {}
      }
    });

    const playingSub = player.addListener('playingChange', (_event: any) => {
      // Do NOT call player.play() here. playingChange fires for internal
      // ExoPlayer transitions (audio-focus handoffs, codec warm-up) that
      // resolve on their own. Interfering with play() here causes the
      // play→freeze→play stutter loop. Stall recovery is handled above via
      // timeUpdate — it only fires when real frames stop advancing.
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pause on swipe-away (400 ms debounce); resume + reset on swipe-back.
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
      stallCountRef.current = 0;
      armStallTimer();
      try { if (!player.playing) player.play(); } catch {}
    } else {
      clearStallTimer();
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
