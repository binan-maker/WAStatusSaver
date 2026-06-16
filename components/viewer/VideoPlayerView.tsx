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
 *
 * ANDROID SAF PLAY FIX:
 * On Android 11+ (SAF path), both the setup-callback play() and the
 * isActive-effect play() fire before ExoPlayer has prepared the source and
 * before the native VideoView surface is attached. On many OEM builds these
 * early calls are silently dropped. The readyToPlay status event is the first
 * moment where BOTH the source is buffered AND the surface is attached, so we
 * call player.play() there to guarantee actual playback starts.
 */
import React, { useEffect, useRef } from 'react';
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
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

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
        // Re-issue play() here — this is the first reliable moment on Android
        // where both the ExoPlayer source is buffered AND the native VideoView
        // surface is attached. The earlier play() calls in the setup callback
        // and isActive effect both fire before the surface exists, and are
        // silently dropped on many Android OEM builds (visible symptom: video
        // "ready" but frozen on first frame / thumbnail stuck).
        if (isActiveRef.current) {
          try { player.play(); } catch {}
        }
        onReady();
      } else if (event.status === 'error') {
        onError((event as any).error?.message ?? 'Playback error');
      }
    });

    // Catch the case where readyToPlay fired before the listener was added
    // (can happen when the file is already in ExoPlayer's buffer cache).
    if ((player as any).status === 'readyToPlay') {
      if (isActiveRef.current) {
        try { player.play(); } catch {}
      }
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
