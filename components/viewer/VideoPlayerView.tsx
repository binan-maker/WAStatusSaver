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
 * SURFACE TYPE: TextureView (useTextureView={true})
 * ──────────────────────────────────────────────────
 * Both SurfaceView and TextureView show 40-50× onReadyForDisplay fires,
 * confirming the issue is NOT React rerenders (those are isolated by
 * StableVideo + ViewerItem memo). The surface recreation is happening
 * inside the native Android/ExoPlayer layer.
 *
 * TextureView is preferred for diagnosis because:
 *   • Its surface lifecycle (onSurfaceTextureAvailable / Destroyed) is
 *     visible in Logcat via the RNV-SURFACE plugin logs.
 *   • SurfaceHolder.Callback (SurfaceView) fires at a lower level and
 *     is harder to correlate with ExoPlayer state.
 *
 * To observe native surface events, build with the
 * plugins/with-rnv-surface-logs.js config plugin registered in app.json
 * and filter Logcat by "RNV-SURFACE".
 *
 * RERENDER ISOLATION
 * ──────────────────
 * VideoPlayerView itself is React.memo-wrapped (outer shell).
 * The <Video> element is further isolated inside StableVideo, a second
 * React.memo layer that only updates when fileUri or paused actually change.
 * This means any rerender that somehow reaches VideoPlayerView (e.g. a
 * stable-prop rerender caused by a parent memo miss) still cannot reach
 * the native <Video> node.
 *
 * PAUSE / RESUME:
 *   react-native-video uses a declarative `paused` prop.
 *   A 400 ms debounce absorbs FlatList transient flickers.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Video, {
  OnLoadData,
  OnProgressData,
  OnVideoErrorData,
  OnBufferData,
  OnPlaybackStateChangedData,
  OnAudioFocusChangedData,
  OnBandwidthUpdateData,
} from 'react-native-video';

interface VideoPlayerViewProps {
  fileUri: string;
  isActive: boolean;
  onPlaying: () => void;
  onError: (message: string) => void;
}

// ─── StableVideoProps ─────────────────────────────────────────────────────────
// All callbacks are created once and never change — they are passed into
// StableVideo at mount time only. StableVideo re-renders ONLY when fileUri
// or paused changes. This is the innermost isolation layer for the native
// <Video> node.
interface StableVideoProps {
  fileUri: string;
  paused: boolean;
  onLoad: (d: OnLoadData) => void;
  onReadyForDisplay: () => void;
  onBuffer: (d: OnBufferData) => void;
  onProgress: (d: OnProgressData) => void;
  onEnd: () => void;
  onError: (d: OnVideoErrorData) => void;
  onPlaybackStateChanged: (d: OnPlaybackStateChangedData) => void;
  onAudioFocusChanged: (d: OnAudioFocusChangedData) => void;
  onBandwidthUpdate: (d: OnBandwidthUpdateData) => void;
}

const StableVideo = React.memo(function StableVideo(p: StableVideoProps) {
  const renderCount = useRef(0);
  renderCount.current += 1;
  if (renderCount.current > 1) {
    console.log(
      `[RNV] StableVideo RERENDER #${renderCount.current}`,
      `paused=${p.paused} uri=${p.fileUri.slice(-40)}`,
      renderCount.current > 2 ? '⚠️ UNEXPECTED — check memo deps' : '',
    );
  }

  // Manual loop: seek to 0 on end instead of relying on the native `repeat` prop.
  //
  // WHY: react-native-video's `repeat={true}` uses ExoPlayer's built-in looping.
  // At every loop boundary ExoPlayer internally fires END → SEEK(0) → BUFFERING →
  // PLAYING. During the BUFFERING phase the surface (TextureView or SurfaceView)
  // detaches and reattaches, causing:
  //   • onReadyForDisplay to fire repeatedly (observed: fireCount 1–19)
  //   • onPlaybackStateChanged to oscillate isPlaying true→false→true
  //   • onAudioFocusChanged to fire (hasAudioFocus=false) at the loop seam
  //   • a visible freeze on every loop
  //
  // With repeat={false} + manual seek(0), ExoPlayer never exits the PLAYING
  // state at the loop boundary, the surface remains live, and none of the
  // above events fire at the seam.
  const videoRef = useRef<{ seek: (time: number) => void } | null>(null);

  const handleEndInternal = useCallback(() => {
    console.log('[RNV] END→seek(0) manual loop — avoiding native repeat surface churn');
    videoRef.current?.seek(0);
    p.onEnd();
  // p.onEnd is useCallback([]) in VideoPlayerView — always the same ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Video
      ref={videoRef as any}
      source={{ uri: p.fileUri }}
      style={StyleSheet.absoluteFill}
      resizeMode="contain"
      repeat={false}
      paused={p.paused}
      muted={false}
      controls={false}
      useTextureView={false}
      bufferConfig={{
        minBufferMs: 15000,
        maxBufferMs: 50000,
        bufferForPlaybackMs: 2500,
        bufferForPlaybackAfterRebufferMs: 5000,
      }}
      progressUpdateInterval={100}
      onLoad={p.onLoad}
      onReadyForDisplay={p.onReadyForDisplay}
      onBuffer={p.onBuffer}
      onProgress={p.onProgress}
      onEnd={handleEndInternal}
      onError={p.onError}
      onPlaybackStateChanged={p.onPlaybackStateChanged}
      onAudioFocusChanged={p.onAudioFocusChanged}
      onBandwidthUpdate={p.onBandwidthUpdate}
      ignoreSilentSwitch="ignore"
      playInBackground={false}
    />
  );
}, (prev, next) =>
  prev.fileUri === next.fileUri &&
  prev.paused === next.paused
  // callbacks are created once via useCallback([]) — always the same refs
);

// ─── diagnostic helper ────────────────────────────────────────────────────────
function ts(): string {
  return `T+${Date.now() % 1_000_000}ms`;
}

let _mountedCount = 0;
export function getActiveMountedCount(): number { return _mountedCount; }

export const VideoPlayerView = React.memo(function VideoPlayerView({
  fileUri,
  isActive,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  // ── Render counter ──────────────────────────────────────────────────────────
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(
    `[RNV] VideoPlayerView render #${renderCount.current} ${ts()}`,
    `paused=${!isActive} isActive=${isActive}`,
    renderCount.current > 1 ? '(rerender)' : '(initial)',
  );

  const [paused, setPaused] = useState(!isActive);
  const hasCalledOnPlaying = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const lastProgressTime = useRef<number>(-1);
  const lastProgressWallClock = useRef<number>(Date.now());

  useEffect(() => {
    _mountedCount++;
    console.log(
      `[RNV] MOUNT ${ts()}`,
      '\n  uri:', fileUri,
      '\n  isActive:', isActive,
      '\n  totalMounted:', _mountedCount,
    );
    return () => {
      _mountedCount--;
      console.log(
        `[RNV] UNMOUNT ${ts()}`,
        '\n  uri:', fileUri,
        '\n  totalMounted:', _mountedCount,
      );
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
      console.log(`[RNV] IS-ACTIVE→true ${ts()} — clearing paused`);
      setPaused(false);
    } else {
      console.log(`[RNV] IS-ACTIVE→false ${ts()} — debouncing pause 400ms`);
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (!isActiveRef.current) {
          console.log(`[RNV] PAUSED (debounce fired) ${ts()}`);
          setPaused(true);
        }
      }, 400);
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── All callbacks are stable ([] deps) — never cause StableVideo rerender ──

  const handleLoad = useCallback((data: OnLoadData) => {
    console.log(
      `[RNV] LOAD ${ts()}`,
      '\n  duration:', data.duration,
      '\n  naturalSize:', JSON.stringify(data.naturalSize),
      '\n  audioTracks:', data.audioTracks?.length ?? 0,
    );
  }, []);

  const readyForDisplayCount = useRef(0);
  const handleReadyForDisplay = useCallback(() => {
    readyForDisplayCount.current += 1;
    console.log(
      `[RNV] READY-FOR-DISPLAY ${ts()}`,
      `fireCount=${readyForDisplayCount.current}`,
      readyForDisplayCount.current > 1 ? '⚠️ REPEATED — surface recreation or re-attach' : '',
    );
    // Guard: only call onPlaying once per mount
    if (hasCalledOnPlaying.current) return;
    hasCalledOnPlaying.current = true;
    onPlaying();
  // onPlaying is a useCallback([thumbnailOpacity]) in ViewerItem — stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuffer = useCallback((data: OnBufferData) => {
    const stall =
      data.isBuffering && lastProgressTime.current >= 0
        ? ` (stalled at ${lastProgressTime.current.toFixed(3)}s, wall+${Date.now() - lastProgressWallClock.current}ms)`
        : '';
    console.log(`[RNV] BUFFER ${data.isBuffering} ${ts()}${stall}`);
  }, []);

  const handleProgress = useCallback((data: OnProgressData) => {
    const wall = Date.now();
    const delta = data.currentTime - lastProgressTime.current;
    const wallDelta = wall - lastProgressWallClock.current;
    lastProgressTime.current = data.currentTime;
    lastProgressWallClock.current = wall;
    console.log(
      `[RNV] PROGRESS ${ts()}`,
      `t=${data.currentTime.toFixed(3)}s`,
      `Δv=${delta >= 0 ? '+' : ''}${delta.toFixed(3)}s`,
      `Δw=${wallDelta}ms`,
      `play=${data.playableDuration?.toFixed(1) ?? '?'}s`,
    );
  }, []);

  const handleEnd = useCallback(() => {
    console.log(`[RNV] END ${ts()} (repeat restart)`);
  }, []);

  const handleError = useCallback((e: OnVideoErrorData) => {
    console.log(`[RNV] ERROR ${ts()}`, JSON.stringify(e, null, 2));
    onError(e.error?.errorString ?? 'Playback error');
  // onError is useCallback([]) in ViewerItem — stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlaybackStateChanged = useCallback((data: OnPlaybackStateChangedData) => {
    console.log(
      `[RNV] PLAYBACK-STATE ${ts()}`,
      `isPlaying=${data.isPlaying}`,
      `pos=${lastProgressTime.current.toFixed(3)}s`,
      `readyForDisplayCount=${readyForDisplayCount.current}`,
      !data.isPlaying ? '⚠️ PAUSED/STOPPED — check surface, audio focus, or loop seam' : '',
    );
  }, []);

  const handleAudioFocusChanged = useCallback((data: OnAudioFocusChangedData) => {
    console.log(
      `[RNV] AUDIO-FOCUS ${ts()}`,
      `hasAudioFocus=${data.hasAudioFocus}`,
      `pos=${lastProgressTime.current.toFixed(3)}s`,
      !data.hasAudioFocus
        ? '⚠️ FOCUS LOST — ExoPlayer will self-pause; if no user action this is the loop seam or OS interruption'
        : '✓ FOCUS GAINED — ExoPlayer will resume',
    );
  }, []);

  const handleBandwidthUpdate = useCallback((data: OnBandwidthUpdateData) => {
    console.log(`[RNV] BANDWIDTH ${ts()}`, JSON.stringify(data));
  }, []);

  // ── Prop-change tracking — log every time fileUri or isActive changes ───────
  const prevFileUriRef = useRef(fileUri);
  const prevIsActiveRef = useRef(isActive);
  if (prevFileUriRef.current !== fileUri) {
    console.log(`[RNV] PROP CHANGE fileUri: ${prevFileUriRef.current?.slice(-30)} → ${fileUri.slice(-30)}`);
    prevFileUriRef.current = fileUri;
  }
  if (prevIsActiveRef.current !== isActive) {
    console.log(`[RNV] PROP CHANGE isActive: ${prevIsActiveRef.current} → ${isActive} ${ts()}`);
    prevIsActiveRef.current = isActive;
  }

  // ── Config dump — once per mount ────────────────────────────────────────────
  const configDumped = useRef(false);
  if (!configDumped.current) {
    configDumped.current = true;
    console.log(
      `[RNV] CONFIG DUMP`,
      '\n  uri:', fileUri,
      '\n  paused (initial):', !isActive,
      '\n  repeat: FALSE (manual seek(0) on onEnd — avoids ExoPlayer loop-boundary surface churn)',
      '\n  controls: false',
      '\n  muted: false',
      '\n  useTextureView: FALSE (SurfaceView)',
      '\n  resizeMode: contain',
      '\n  progressUpdateInterval: 100ms',
      '\n  ignoreSilentSwitch: ignore',
      '\n  bufferConfig: min=15s max=50s playback=2.5s rebuffer=5s',
    );
  }

  return (
    <StableVideo
      fileUri={fileUri}
      paused={paused}
      onLoad={handleLoad}
      onReadyForDisplay={handleReadyForDisplay}
      onBuffer={handleBuffer}
      onProgress={handleProgress}
      onEnd={handleEnd}
      onError={handleError}
      onPlaybackStateChanged={handlePlaybackStateChanged}
      onAudioFocusChanged={handleAudioFocusChanged}
      onBandwidthUpdate={handleBandwidthUpdate}
    />
  );
});
