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
 * RERENDER ISOLATION
 * ──────────────────
 * VideoPlayerView is React.memo-wrapped (outer shell).
 * The <Video> element is further isolated inside StableVideo, a second
 * React.memo layer that re-renders ONLY when fileUri or paused changes.
 *
 * PAUSE / RESUME
 * ──────────────
 * paused = !isActive
 * isActive changes are debounced 400 ms to absorb FlatList transient flickers.
 *
 * AppState is intentionally NOT used in pause logic.
 * Root-cause analysis showed that NavigationBar API calls in _layout.tsx were
 * causing Android to oscillate window-focus (FOCUS→BLUR→FOCUS) on every render,
 * which React Native translates into rapid active→background→active AppState
 * events. Using AppState here caused a continuous pause/resume loop during
 * playback. react-native-video pauses itself natively when the app is truly
 * backgrounded, so the AppState guard is redundant and harmful.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Video, {
  OnVideoErrorData,
  OnPlaybackStateChangedData,
} from 'react-native-video';

interface VideoPlayerViewProps {
  fileUri: string;
  isActive: boolean;
  onPlaying: () => void;
  onError: (message: string) => void;
}

interface StableVideoProps {
  fileUri: string;
  paused: boolean;
  onReadyForDisplay: () => void;
  onEnd: () => void;
  onError: (d: OnVideoErrorData) => void;
  onPlaybackStateChanged: (d: OnPlaybackStateChangedData) => void;
}

// ─── Module-level constants — never recreated, always same reference ──────────
const BUFFER_CONFIG = {
  minBufferMs: 15000,
  maxBufferMs: 50000,
  bufferForPlaybackMs: 2500,
  bufferForPlaybackAfterRebufferMs: 5000,
} as const;

const STABLE_STYLE = StyleSheet.absoluteFill;

// ─── StableVideo ──────────────────────────────────────────────────────────────
// Inner isolation layer. Re-renders ONLY when fileUri or paused changes.
// All callbacks are created once in the outer VideoPlayerView and never change.
const StableVideo = React.memo(function StableVideo(p: StableVideoProps) {
  const source = useMemo(() => ({ uri: p.fileUri }), [p.fileUri]);
  const videoRef = useRef<{ seek: (time: number) => void } | null>(null);

  // Manual loop: seek(0) on end rather than repeat={true}.
  // repeat={true} uses ExoPlayer's built-in looping which fires
  // END → SEEK(0) → BUFFERING → PLAYING at every boundary, causing
  // the surface to detach/reattach and onReadyForDisplay to repeat.
  const handleEndInternal = useCallback(() => {
    videoRef.current?.seek(0);
    p.onEnd();
  // p.onEnd is useCallback([]) in VideoPlayerView — always the same ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Video
      ref={videoRef as any}
      source={source}
      style={STABLE_STYLE}
      resizeMode="contain"
      repeat={false}
      paused={p.paused}
      muted={false}
      controls={false}
      useTextureView={true}
      bufferConfig={BUFFER_CONFIG}
      progressUpdateInterval={500}
      onReadyForDisplay={p.onReadyForDisplay}
      onEnd={handleEndInternal}
      onError={p.onError}
      onPlaybackStateChanged={p.onPlaybackStateChanged}
      ignoreSilentSwitch="ignore"
      playInBackground={false}
    />
  );
}, (prev, next) =>
  prev.fileUri === next.fileUri &&
  prev.paused === next.paused
);

// ─── Mounted instance counter (exported for debugging) ────────────────────────
let _mountedCount = 0;
export function getActiveMountedCount(): number { return _mountedCount; }

// ─── VideoPlayerView ──────────────────────────────────────────────────────────
export const VideoPlayerView = React.memo(function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  // ── Pause logic ──────────────────────────────────────────────────────────
  // paused = slide is not the active one in the FlatList pager.
  // isActive changes are debounced 400 ms to absorb FlatList transient flips.
  //
  // AppState is intentionally excluded — see module-level comment.
  const [paused, setPaused] = useState(!isActive);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (isActive) {
      setPaused(false);
    } else {
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (!isActiveRef.current) setPaused(true);
      }, 400);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const hasCalledOnPlaying = useRef(false);
  useEffect(() => {
    hasCalledOnPlaying.current = false;
  }, [isActive]);

  // ── Stable callbacks ([] deps — never cause StableVideo re-render) ────────

  const handleReadyForDisplay = useCallback(() => {
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  // onPlaying is stable in ViewerItem
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = useCallback(() => {}, []);

  const handleError = useCallback((e: OnVideoErrorData) => {
    onError(e.error?.errorString ?? 'Playback error');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlaybackStateChanged = useCallback((_data: OnPlaybackStateChangedData) => {
    // no-op — kept so the prop is still wired for future diagnostics
  }, []);

  return (
    <StableVideo
      fileUri={fileUri}
      paused={paused}
      onReadyForDisplay={handleReadyForDisplay}
      onEnd={handleEnd}
      onError={handleError}
      onPlaybackStateChanged={handlePlaybackStateChanged}
    />
  );
});
