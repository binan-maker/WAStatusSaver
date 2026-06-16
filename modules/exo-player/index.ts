/**
 * ExoPlayer — JS wrapper for the native Media3/ExoPlayer view module.
 *
 * CONTRACT: fileUri MUST be a file:// URI. The native layer will emit
 * an onPlayerError immediately if a content:// URI is passed.
 * Always use SafReaderModule.copyFileToCache() before calling this.
 *
 * Available only on Android custom dev-client / EAS builds (native module).
 * Returns null on iOS and web (app has no video path there).
 */
import React from 'react';
import {
  requireNativeComponent,
  Platform,
  ViewStyle,
  NativeSyntheticEvent,
} from 'react-native';

// ── Native component shape (matches ExoPlayerViewManager props/events) ────────

interface NativeExoPlayerProps {
  fileUri: string;
  paused?: boolean;
  muted?: boolean;
  style?: ViewStyle;
  onPlayerReady?: (event: NativeSyntheticEvent<{}>) => void;
  onPlayerError?: (event: NativeSyntheticEvent<{ error: string }>) => void;
}

const NativeExoPlayerView =
  Platform.OS === 'android'
    ? requireNativeComponent<NativeExoPlayerProps>('ExoPlayerView')
    : null;

// ── Public JS interface ───────────────────────────────────────────────────────

export interface ExoPlayerViewProps {
  /** Must be a file:// URI — never content://. Copy SAF URIs first. */
  fileUri: string;
  paused?: boolean;
  muted?: boolean;
  style?: ViewStyle;
  onPlayerReady?: () => void;
  onPlayerError?: (error: string) => void;
}

export function ExoPlayerView({
  fileUri,
  paused = false,
  muted = false,
  style,
  onPlayerReady,
  onPlayerError,
}: ExoPlayerViewProps): React.ReactElement | null {
  if (!NativeExoPlayerView) return null;

  return (
    <NativeExoPlayerView
      fileUri={fileUri}
      paused={paused}
      muted={muted}
      style={style}
      onPlayerReady={onPlayerReady ? (_e) => onPlayerReady() : undefined}
      onPlayerError={
        onPlayerError
          ? (e) => onPlayerError(e.nativeEvent?.error ?? 'Playback error')
          : undefined
      }
    />
  );
}

/** True when the native module is available (custom dev-client / EAS build). */
export function isAvailable(): boolean {
  return NativeExoPlayerView !== null;
}
