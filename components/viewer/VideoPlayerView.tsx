/**
 * VideoPlayerView — isolated expo-video player component.
 *
 * WHY ISOLATED:
 * useVideoPlayer's setup callback fires synchronously during construction,
 * guaranteeing play() is registered before any status events fire.
 * key={fileUri} on the parent mount forces a fresh player for every new URI.
 *
 * ANDROID SAF PLAYBACK STRATEGY:
 * Two events matter on Android:
 *
 *   1. statusChange → readyToPlay
 *      Source is buffered. Surface MAY not be fully attached yet on some OEM
 *      builds. Call play() here to set playWhenReady=true in ExoPlayer, plus
 *      schedule a 300 ms retry nudge for OEMs that need a second call.
 *
 *   2. playingChange → isPlaying: true
 *      Video frames are ACTUALLY advancing. This is the only reliable signal
 *      that playback is working. Fire onPlaying() here so the parent can
 *      fade out the thumbnail poster.
 *
 * The setup-callback play() + the isActive effect play() are kept as early
 * intent signals, but neither is trusted as the "actually playing" gate.
 *
 * URI CONTRACT: fileUri MUST be a file:// URI.
 */
import React, { useEffect, useRef } from 'react';
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
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    const clearRetry = () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };

    const scheduleRetry = () => {
      clearRetry();
      retryTimer.current = setTimeout(() => {
        if (!hasCalledOnPlaying.current && isActiveRef.current) {
          try { player.play(); } catch {}
          retryTimer.current = setTimeout(() => {
            if (!hasCalledOnPlaying.current && isActiveRef.current) {
              try { player.play(); } catch {}
            }
          }, 400);
        }
      }, 300);
    };

    const statusSub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        if (isActiveRef.current) {
          try { player.play(); } catch {}
        }
        scheduleRetry();
      } else if (event.status === 'error') {
        clearRetry();
        onError((event as any).error?.message ?? 'Playback error');
      } else if (event.status === 'idle' || event.status === 'loading') {
        clearRetry();
      }
    });

    const playingSub = player.addListener('playingChange', (event: any) => {
      if (event.isPlaying && !hasCalledOnPlaying.current) {
        hasCalledOnPlaying.current = true;
        clearRetry();
        onPlaying();
      }
    });

    if ((player as any).status === 'readyToPlay' && isActiveRef.current) {
      try { player.play(); } catch {}
      scheduleRetry();
    }
    if ((player as any).playing && !hasCalledOnPlaying.current) {
      hasCalledOnPlaying.current = true;
      onPlaying();
    }

    return () => {
      statusSub.remove();
      playingSub.remove();
      clearRetry();
      try { player.release(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      if (isActive) player.play();
      else player.pause();
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
