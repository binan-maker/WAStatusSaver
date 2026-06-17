/**
 * VideoPlayerView — react-native-video wrapper for the status viewer.
 *
 * ARCHITECTURE
 * ────────────
 * This component is only ever mounted when its slide IS the active one
 * (ViewerItem gates on `!!displayUri && isActive`). It is unmounted on
 * swipe-away. Therefore:
 *   • paused is always false — no pause logic needed
 *   • no AppState listener — we unmount instead of pause
 *   • no isActive prop — if we're mounted, we're active
 *
 * BUFFER CONFIG — local file:// only
 * ────────────────────────────────────
 * ExoPlayer's default bufferForPlaybackAfterRebufferMs is 5000 ms.
 * Any tiny I/O hiccup (GC, kernel scheduler blip) makes ExoPlayer wait
 * 5 full seconds before resuming → the "stucks runs stucks runs" loop.
 * For an on-disk file:// there is no network to buffer against.
 * These values eliminate the freeze entirely:
 *   bufferForPlaybackMs: 50         start after 50 ms of data (vs 2500)
 *   bufferForPlaybackAfterRebufferMs: 100  resume in 100 ms (vs 5000)
 *   minBufferMs: 1000 / maxBufferMs: 5000  keep memory pressure low
 *
 * ISOLATION
 * ─────────
 * StableVideo is a second React.memo layer. It re-renders ONLY when
 * fileUri changes (= different item or tap-to-retry). All callbacks are
 * created at module level or with [] deps so they never cause re-renders.
 */
import React, { useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Video, { type OnVideoErrorData } from 'react-native-video';

export interface VideoPlayerViewProps {
  fileUri: string;
  onPlaying: () => void;
  onError: (message: string) => void;
}

interface StableVideoProps {
  fileUri: string;
  onReadyForDisplay: () => void;
  onError: (d: OnVideoErrorData) => void;
}

// ─── Buffer config — tuned for local file:// playback ─────────────────────────
const BUFFER_CONFIG = {
  minBufferMs: 1000,
  maxBufferMs: 5000,
  bufferForPlaybackMs: 50,
  bufferForPlaybackAfterRebufferMs: 100,
} as const;

const STABLE_STYLE = StyleSheet.absoluteFill;

// ─── StableVideo ──────────────────────────────────────────────────────────────
const StableVideo = React.memo(function StableVideo(p: StableVideoProps) {
  const source = useMemo(() => ({ uri: p.fileUri }), [p.fileUri]);

  return (
    <Video
      source={source}
      style={STABLE_STYLE}
      resizeMode="contain"
      paused={false}
      repeat={true}
      muted={false}
      controls={false}
      useTextureView={true}
      bufferConfig={BUFFER_CONFIG}
      reportBandwidth={false}
      onReadyForDisplay={p.onReadyForDisplay}
      onError={p.onError}
      ignoreSilentSwitch="ignore"
      playInBackground={false}
      preventsDisplaySleepDuringVideoPlayback={true}
    />
  );
}, (prev, next) => prev.fileUri === next.fileUri);

// ─── VideoPlayerView ──────────────────────────────────────────────────────────
export const VideoPlayerView = React.memo(function VideoPlayerView({
  fileUri,
  onPlaying,
  onError,
}: VideoPlayerViewProps) {
  const handleReadyForDisplay = useCallback(() => {
    onPlaying();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = useCallback((e: OnVideoErrorData) => {
    onError(e.error?.errorString ?? 'Playback error');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StableVideo
      fileUri={fileUri}
      onReadyForDisplay={handleReadyForDisplay}
      onError={handleError}
    />
  );
});
