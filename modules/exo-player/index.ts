/**
 * ExoPlayer — JS wrapper for the native Media3/ExoPlayer view module.
 *
 * CONTRACT: fileUri MUST be a file:// URI. The native layer emits
 * onPlayerError immediately if a non-file:// URI is passed.
 * Always use SafReaderModule.copyFileToCache() before calling this.
 *
 * Available only on Android custom dev-client / EAS builds (native module).
 * Returns null on iOS and web.
 *
 * WHY requireNativeComponent without UIManager.getViewManagerConfig:
 * UIManager.getViewManagerConfig is unreliable in Fabric (new arch) — it may
 * return null even when the view manager IS compiled and registered, because
 * Fabric uses its own view config registry that is populated differently from
 * UIManager. requireNativeComponent is the correct entry point; it delegates
 * to NativeComponentRegistry internally. If the native view is absent at
 * render time, Fabric throws "View config not found" — that error is caught
 * by the ExoPlayerBoundary in ViewerItem (not by this module).
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
  onPlayerReady?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
  onPlayerError?: (event: NativeSyntheticEvent<{ error: string }>) => void;
}

// requireNativeComponent does NOT verify the native side at module load time —
// it creates a component class that delegates to the registered view manager.
// Absence of the native view manager is only detected at first render (Fabric
// throws "View config not found"). ExoPlayerBoundary in ViewerItem catches that.
let NativeExoPlayerView: ReturnType<typeof requireNativeComponent<NativeExoPlayerProps>> | null = null;
if (Platform.OS === 'android') {
  try {
    NativeExoPlayerView = requireNativeComponent<NativeExoPlayerProps>('ExoPlayerView');
  } catch {
    // requireNativeComponent should not throw at module level, but guard anyway.
    NativeExoPlayerView = null;
  }
}

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

/**
 * True on Android where requireNativeComponent succeeded at module load time.
 * Does NOT guarantee the native view manager is compiled — use ExoPlayerBoundary
 * to catch render-time failures gracefully.
 */
export function isAvailable(): boolean {
  return NativeExoPlayerView !== null;
}
