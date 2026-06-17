/**
 * VideoPlayerView — react-native-video wrapper for the status viewer.
 *
 * WHY react-native-video (not expo-video)
 * ────────────────────────────────────────
 * Diagnosis from test screens A / B / C on a real Android 11+ device:
 *
 *   Screen A — expo-video   + file:// (copy path) → fully frozen (0 s)
 *   Screen B — expo-video   + content://          → freeze at ~1 s
 *   Screen C — react-native-video + content://    → plays (stutters at 1 s
 *                                                    buffer boundary)
 *
 * Conclusion: expo-video / Media3 is broken on this device.
 * Fix: replace the player library while keeping the already-correct
 *      copy-to-cache flow in ViewerItem (content:// → file://).
 *
 * PLAYBACK PATH (unchanged in ViewerItem):
 *   SAF content:// → prepareStatusForViewing → file:// cache → this component
 *
 * PAUSE / RESUME:
 *   react-native-video uses a declarative `paused` prop.
 *   A 400 ms debounce (same as before) absorbs FlatList transient flickers
 *   so we don't pause on a scroll that immediately bounces back.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Video, { OnLoadData, OnVideoErrorData } from 'react-native-video';

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
  const [paused, setPaused] = useState(!isActive);
  const hasCalledOnPlaying = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    _mountedCount++;
    return () => {
      _mountedCount--;
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (isActive) {
      hasCalledOnPlaying.current = false;
      setPaused(false);
    } else {
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (!isActiveRef.current) setPaused(true);
      }, 400);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReadyForDisplay = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  }, [onPlaying]);

  const handleError = useCallback((e: OnVideoErrorData) => {
    onError(e.error?.errorString ?? 'Playback error');
  }, [onError]);

  return (
    <Video
      source={{ uri: fileUri }}
      style={StyleSheet.absoluteFill}
      resizeMode="contain"
      repeat
      paused={paused}
      muted={false}
      controls={false}
      onReadyForDisplay={handleReadyForDisplay}
      onError={handleError}
      ignoreSilentSwitch="ignore"
      playInBackground={false}
    />
  );
});
