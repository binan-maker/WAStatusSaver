/**
 * ExoPlayer — JS wrapper for the native Media3/ExoPlayer view module.
 *
 * CONTRACT: fileUri MUST be a file:// URI. The native layer will emit
 * an onPlayerError immediately if a content:// URI is passed.
 * Always use SafReaderModule.copyFileToCache() before calling this.
 *
 * Available only on Android custom dev-client / EAS builds (native module).
 * Returns null on iOS, web, and Expo Go (where the native view is not linked).
 *
 * WHY UIManager.getViewManagerConfig:
 * requireNativeComponent('ExoPlayerView') does NOT throw at module-load time
 * even when the native view manager is absent — it returns a reference that
 * looks valid. The crash only occurs later when React (Fabric) tries to render
 * it and cannot find the view config in the registry. We use UIManager to
 * probe the registry at startup so isAvailable() is accurate and ExoPlayerView
 * never reaches React.createElement with an unregistered name.
 */
import React from 'react';
import {
  requireNativeComponent,
  UIManager,
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
  onPlayerReady?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
  onPlayerError?: (event: NativeSyntheticEvent<{ error: string }>) => void;
}

// Probe UIManager first so we never call requireNativeComponent for an absent
// view — which would silently succeed but crash at render time under Fabric.
function resolveNativeView(): ReturnType<typeof requireNativeComponent<NativeExoPlayerProps>> | null {
  if (Platform.OS !== 'android') return null;
  try {
    if (!UIManager.getViewManagerConfig('ExoPlayerView')) return null;
    return requireNativeComponent<NativeExoPlayerProps>('ExoPlayerView');
  } catch {
    return null;
  }
}

const NativeExoPlayerView = resolveNativeView();

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

  return React.createElement(NativeExoPlayerView, {
    fileUri,
    paused,
    muted,
    style,
    onPlayerReady: onPlayerReady
      ? (_e: NativeSyntheticEvent<Record<string, never>>) => onPlayerReady()
      : undefined,
    onPlayerError: onPlayerError
      ? (e: NativeSyntheticEvent<{ error: string }>) =>
          onPlayerError(e.nativeEvent?.error ?? 'Playback error')
      : undefined,
  });
}

/** True only when the native ExoPlayerView is registered (EAS / custom dev-client build). */
export function isAvailable(): boolean {
  return NativeExoPlayerView !== null;
}
