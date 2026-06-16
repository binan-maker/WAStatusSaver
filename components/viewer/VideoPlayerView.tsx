/**
 * VideoPlayerView — isolated expo-video player component.
 *
 * WHY A SEPARATE COMPONENT:
 * expo-video's useVideoPlayer takes a source at initialisation time and the
 * setup callback fires synchronously, so play() is guaranteed to be called
 * before the player reaches readyToPlay. Calling replace() + play() in
 * separate useEffect hooks after the parent sets displayUri is racy:
 *   - statusChange may fire before the listener useEffect runs
 *   - play() may fire before replace() finishes swapping the source
 *
 * Isolating the player here and using key={displayUri} on the parent mount
 * point means every new URI gets a fresh player — no ordering issues, no
 * stale source, no missed events.
 *
 * URI CONTRACT: fileUri MUST be a file:// URI. SAF content:// URIs are
 * always copied to a file:// cache by prepareStatusForViewing() before
 * this component is ever mounted.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoPlayerViewProps {
  fileUri: string;
  isActive: boolean;
  onReady: () => void;
  onError: (message: string) => void;
}

export function VideoPlayerView({
  fileUri,
  isActive,
  onReady,
  onError,
}: VideoPlayerViewProps) {
  // Pass source directly to useVideoPlayer — this is the ONLY correct way to
  // guarantee the source + play() are set before any status events fire.
  // The setup callback is called synchronously during player creation.
  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  // Status listener: subscribe AND check current status immediately so we
  // never miss a readyToPlay event that fired before this useEffect ran.
  useEffect(() => {
    const sub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        onReady();
      } else if (event.status === 'error') {
        onError((event as any).error?.message ?? 'Playback error');
      }
    });

    // Catch the case where readyToPlay fired before the listener was added
    // (can happen when the file is already in ExoPlayer's buffer cache).
    if ((player as any).status === 'readyToPlay') {
      onReady();
    }

    return () => {
      sub.remove();
      try { player.release(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Play / pause based on whether this item is the active slide.
  useEffect(() => {
    try {
      if (isActive) {
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
