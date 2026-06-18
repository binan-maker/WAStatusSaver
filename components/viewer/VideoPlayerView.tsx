/**
 * VideoPlayerView — react-native-video wrapper for the status viewer.
 *
 * ARCHITECTURE
 * ────────────
 * Only ever mounted when its slide IS the active one (ViewerItem gates on
 * `!!displayUri && isActive`). Unmounted on swipe-away. Therefore:
 *   • paused / muted are fully controlled by the parent (ViewerItem)
 *   • no AppState listener — we unmount instead of pause on background
 *
 * BUFFER CONFIG — local file:// only
 * ────────────────────────────────────
 * ExoPlayer's default bufferForPlaybackAfterRebufferMs is 5000 ms.
 * Any tiny I/O hiccup makes ExoPlayer wait 5 full seconds before resuming.
 * For an on-disk file:// there is no network to buffer against.
 * These values eliminate the freeze:
 *   bufferForPlaybackMs: 50         start after 50 ms of data (vs 2500)
 *   bufferForPlaybackAfterRebufferMs: 100  resume in 100 ms (vs 5000)
 *   minBufferMs: 1000 / maxBufferMs: 5000  keep memory pressure low
 *
 * ISOLATION
 * ─────────
 * StableVideo is a second React.memo layer. Re-renders ONLY when fileUri,
 * paused, or muted change — never from progress ticks or control visibility
 * toggles. All callbacks are stable (module-level or [] deps).
 *
 * RE-RENDER SAFETY WITH useTextureView
 * ──────────────────────────────────────
 * Passing paused/muted as props means StableVideo re-renders on each
 * play/pause/mute toggle. With useTextureView={true}, Android uses a
 * TextureView instead of SurfaceView. TextureView does NOT recreate its
 * surface on parent re-renders — only on unmount/remount. So toggling
 * paused/muted is safe and produces no black-screen flash.
 */
import React, { useCallback, useMemo, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Video, {
  type OnVideoErrorData,
  type OnProgressData,
  type OnLoadData,
  type VideoRef,
} from 'react-native-video';

export interface VideoPlayerViewRef {
  seek: (time: number) => void;
}

export interface VideoPlayerViewProps {
  fileUri: string;
  paused: boolean;
  muted: boolean;
  onPlaying: () => void;
  onError: (message: string) => void;
  onProgress: (currentTime: number, duration: number) => void;
  onLoad: (duration: number) => void;
}

interface StableVideoProps {
  fileUri: string;
  paused: boolean;
  muted: boolean;
  videoRef: React.RefObject<VideoRef | null>;
  onReadyForDisplay: () => void;
  onError: (d: OnVideoErrorData) => void;
  onProgress: (d: OnProgressData) => void;
  onLoad: (d: OnLoadData) => void;
}

const BUFFER_CONFIG = {
  minBufferMs: 1000,
  maxBufferMs: 5000,
  bufferForPlaybackMs: 50,
  bufferForPlaybackAfterRebufferMs: 100,
} as const;

const STABLE_STYLE = StyleSheet.absoluteFill;

const StableVideo = React.memo(function StableVideo(p: StableVideoProps) {
  const source = useMemo(() => ({ uri: p.fileUri }), [p.fileUri]);

  return (
    <Video
      ref={p.videoRef}
      source={source}
      style={STABLE_STYLE}
      resizeMode="contain"
      paused={p.paused}
      repeat={true}
      muted={p.muted}
      controls={false}
      useTextureView={true}
      bufferConfig={BUFFER_CONFIG}
      reportBandwidth={false}
      onReadyForDisplay={p.onReadyForDisplay}
      onError={p.onError}
      onProgress={p.onProgress}
      onLoad={p.onLoad}
      ignoreSilentSwitch="ignore"
      playInBackground={false}
      preventsDisplaySleepDuringVideoPlayback={true}
      progressUpdateInterval={250}
    />
  );
}, (prev, next) =>
  prev.fileUri === next.fileUri &&
  prev.paused === next.paused &&
  prev.muted === next.muted,
);

export const VideoPlayerView = React.memo(React.forwardRef<VideoPlayerViewRef, VideoPlayerViewProps>(
  function VideoPlayerView(
    { fileUri, paused, muted, onPlaying, onError, onProgress, onLoad },
    ref,
  ) {
    const videoRef = useRef<VideoRef | null>(null);

    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        videoRef.current?.seek(time);
      },
    }), []);

    const handleReadyForDisplay = useCallback(() => {
      onPlaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleError = useCallback((e: OnVideoErrorData) => {
      onError(e.error?.errorString ?? 'Playback error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleProgress = useCallback((d: OnProgressData) => {
      onProgress(d.currentTime, d.seekableDuration);
    // onProgress intentionally stable — parent uses functional state update
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLoad = useCallback((d: OnLoadData) => {
      onLoad(d.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <StableVideo
        fileUri={fileUri}
        paused={paused}
        muted={muted}
        videoRef={videoRef}
        onReadyForDisplay={handleReadyForDisplay}
        onError={handleError}
        onProgress={handleProgress}
        onLoad={handleLoad}
      />
    );
  },
));
