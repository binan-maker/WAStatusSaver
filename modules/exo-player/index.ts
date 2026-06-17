/**
 * ExoPlayer — JS wrapper for the native Media3/ExoPlayer view module.
 *
 * CONTRACT: fileUri MUST be a file:// URI. The native layer emits
 * onPlayerError immediately if a non-file:// URI is passed.
 * Always use SafReaderModule.copyFileToCache() before calling this.
 *
 * Available only on Android custom dev-client / EAS builds (native module).
 * Returns null on iOS, web, and any Android build where ExoPlayerPackage
 * was not compiled in.
 *
 * ── HOW AVAILABILITY IS DETECTED ─────────────────────────────────────────────
 * requireNativeComponent in Fabric (new arch) does NOT validate the native
 * side at module-load time.  It creates a component stub that is registered
 * with NativeComponentRegistry; absence of the underlying view manager is
 * only detected during React's completeWork phase — at render time — when
 * Fabric calls ReactNativeViewConfigRegistry.get() and throws
 * "View config not found for component ExoPlayerView".
 *
 * UIManager.hasViewManagerConfig() queries the NATIVE UIManager registry
 * synchronously at module-load time.  If the Java ExoPlayerViewManager class
 * is not compiled and registered, it returns false immediately — before any
 * render attempt.  We use this as the primary gate:
 *
 *   hasViewManagerConfig → false  → NativeExoPlayerView stays null
 *                                    isAvailable() → false
 *                                    ExoPlayerView renders nothing
 *                                    ViewerItem goes straight to expo-video
 *                                    No ERROR ever appears in the log
 *
 *   hasViewManagerConfig → true   → requireNativeComponent runs
 *                                    isAvailable() → true
 *                                    ExoPlayerView renders the native TextureView
 *
 * ExoPlayerBoundary is kept as a belt-and-suspenders catch for any OEM where
 * the registry check is unreliable, but it should never be needed in practice.
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

// Check the native UIManager registry BEFORE calling requireNativeComponent.
// hasViewManagerConfig is synchronous and safe to call at module load time.
// Returns false when ExoPlayerPackage is not compiled into the current build.
let NativeExoPlayerView: ReturnType<typeof requireNativeComponent<NativeExoPlayerProps>> | null = null;

if (Platform.OS === 'android') {
  const nativeAvailable = (() => {
    try {
      return UIManager.hasViewManagerConfig('ExoPlayerView');
    } catch {
      return false;
    }
  })();

  if (nativeAvailable) {
    try {
      NativeExoPlayerView = requireNativeComponent<NativeExoPlayerProps>('ExoPlayerView');
    } catch {
      NativeExoPlayerView = null;
    }
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
 * True only when UIManager confirms ExoPlayerViewManager is registered in the
 * native UIManager registry AND requireNativeComponent succeeded.
 *
 * Checked at module-load time — safe to use as an initial value for useState
 * without any async work.
 */
export function isAvailable(): boolean {
  return NativeExoPlayerView !== null;
}
