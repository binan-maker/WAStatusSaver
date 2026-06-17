/**
 * VideoPlayerView — expo-video wrapper for the status viewer.
 *
 * ARCHITECTURE
 * ────────────
 * Only ever mounted when its slide IS the active one (ViewerItem gates on
 * `!!displayUri && isActive`). Unmounted on swipe-away, so:
 *   • the player is always in playing state — no pause/resume logic needed
 *   • a fresh player is created on every mount — no source-swap needed
 *
 * ISOLATION
 * ─────────
 * React.memo with a custom equality check so re-renders only happen when
 * fileUri changes (= different item or tap-to-retry).
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export interface VideoPlayerViewProps {
  fileUri: string;
  onPlaying: () => void;
  onError: (message: string) => void;
}

export const VideoPlayerView = React.memo(function VideoPlayerView({
  fileUri,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const player = useVideoPlayer(fileUri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay') {
        onPlaying();
      } else if (status === 'error') {
        onError((error as any)?.message ?? 'Playback error');
      }
    });
    return () => sub.remove();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}, (prev, next) => prev.fileUri === next.fileUri);
