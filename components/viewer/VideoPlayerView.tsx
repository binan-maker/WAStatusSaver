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
 * paused = !isActive || appState !== 'active'
 * isActive changes are debounced 400 ms to absorb FlatList transient flickers.
 * appState changes are applied immediately (background → paused instantly).
 *
 * LOGGING — 4 tags only:
 *   [PAUSE-REASON]  — why paused changed (isActive / appState / finalPaused)
 *   [VIDEO-PROP]    — paused prop value reaching <Video> (detects flip-flop)
 *   [VIDEO] READY   — onReadyForDisplay fireCount (detects surface recreation)
 *   [VIDEO-STATE]   — onPlaybackStateChanged isPlaying / isSeeking
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, AppState, AppStateStatus } from 'react-native';
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
  const manuallyPaused = false; // no manual-pause UI in this app

  // ── Track OS lifecycle ───────────────────────────────────────────────────
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      setAppState(next);
    });
    return () => sub.remove();
  }, []);

  // ── Pause logic ──────────────────────────────────────────────────────────
  // paused = slide not active OR app not in foreground.
  // isActive changes are debounced 400 ms to absorb FlatList transient flips.
  // appState changes (background) are applied immediately via the effect above.
  const [paused, setPaused] = useState(!isActive || appState !== 'active');
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (isActive) {
      setPaused(appState !== 'active');
    } else {
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (!isActiveRef.current) setPaused(true);
      }, 400);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply appState changes immediately on top of the isActive-based paused.
  useEffect(() => {
    if (appState !== 'active') {
      setPaused(true);
    } else if (isActiveRef.current) {
      setPaused(false);
    }
  }, [appState]);

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

  // ── [PAUSE-REASON] ───────────────────────────────────────────────────────
  // Logs every time the pause decision changes. Key diagnostic:
  //   If finalPaused flips true/false in sync with appState → AppState loop.
  //   If finalPaused stays false while video freezes → below-RN issue.
  useEffect(() => {
    console.log(
      `[PAUSE-REASON]\n     activeItem=${isActive}\n     appState=${appState}\n     manuallyPaused=${manuallyPaused}\n     finalPaused=${paused}`,
    );
  }, [paused, isActive, appState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── [VIDEO-PROP] ─────────────────────────────────────────────────────────
  // Logs every time the paused prop value reaching <Video> actually changes.
  // If this shows paused=true / paused=false alternating → the pause loop
  // is coming from JS. If it stays paused=false during the freeze → native.
  const prevPausedRef = useRef<boolean | null>(null);
  if (prevPausedRef.current !== paused) {
    prevPausedRef.current = paused;
    console.log('[VIDEO-PROP]', { paused, isActive, appState, manuallyPaused });
  }

  const hasCalledOnPlaying = useRef(false);
  useEffect(() => {
    hasCalledOnPlaying.current = false;
  }, [isActive]);

  // ── Stable callbacks ([] deps — never cause StableVideo re-render) ────────

  const readyForDisplayCount = useRef(0);
  const handleReadyForDisplay = useCallback(() => {
    readyForDisplayCount.current += 1;
    // [VIDEO] READY — fireCount > 1 means surface is being recreated.
    console.log(`[VIDEO] READY ${Date.now()} fireCount=${readyForDisplayCount.current}`);
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

  const handlePlaybackStateChanged = useCallback((data: OnPlaybackStateChangedData) => {
    // [VIDEO-STATE] — isPlaying=false during steady playback means ExoPlayer
    // was externally paused (audio focus, AppState, surface detach).
    console.log(
      `[VIDEO-STATE]\n       isPlaying=${data.isPlaying}\n       isSeeking=${(data as any).isSeeking ?? 'n/a'}`,
    );
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
