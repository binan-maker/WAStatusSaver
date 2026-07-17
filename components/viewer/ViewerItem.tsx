/**
 * ViewerItem — single slide in the full-screen status viewer.
 *
 * VIDEO PLAYER ARCHITECTURE (Android 11+ SAF)
 * ───────────────────────────────────────────
 * The custom native ExoPlayerView module requires Java source files at
 * modules/exo-player/android/ that are not present in this repo, so
 * UIManager.hasViewManagerConfig('ExoPlayerView') always returns false
 * and the module is always unavailable. All video playback therefore goes
 * through react-native-video (VideoPlayerView).
 *
 * VIDEO CONTROLS
 * ──────────────
 * Tap anywhere on the video to show/hide the controller overlay.
 * The overlay auto-hides after 3 s of playing without interaction.
 * While paused the overlay stays visible until the user explicitly hides it.
 *
 * Controller buttons (play/pause, mute, seek bar) are captured by VideoControls.
 * Taps on the empty area of the overlay (box-none) fall through to the
 * TouchableOpacity behind it, which toggles the overlay visibility.
 *
 * URI PREPARATION
 * ───────────────
 * SAF content:// URIs are always copied to a local file:// path before
 * the player mounts (prepareStatusForViewing with forPlayback:true).
 * hasPreparedRef tracks whether preparation is in progress or complete
 * for the current item so the prepare effect never fires twice, even if
 * isNearActive/isActive toggle while the async copy is running.
 */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Text,
  TouchableOpacity,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDecay,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { VideoPlayerView, type VideoPlayerViewRef } from './VideoPlayerView';
import { VideoControls } from './VideoControls';
import { Ionicons } from '@expo/vector-icons';
import { StatusItem, SavedItem } from '@/contexts/MediaContext';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useThumbnail } from '@/hooks/media/useThumbnail';
import { createStyles, SW, SH } from './viewerStyles';

const VIEWER_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };
const AUTO_HIDE_MS = 3000;

export interface ViewerItemProps {
  item: StatusItem | SavedItem;
  isActive: boolean;
  isNearActive: boolean;
  onToggleControls: () => void;
  prepareStatusForViewing: (item: StatusItem, options: { forPlayback: boolean }) => Promise<string | null>;
}

export const ViewerItem = React.memo(function ViewerItem({
  item,
  isActive,
  isNearActive,
  onToggleControls,
  prepareStatusForViewing,
}: ViewerItemProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const cachedThumb = useThumbnail(item.id);

  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  // ── Video playback state ─────────────────────────────────────────────────
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVideoControls, setShowVideoControls] = useState(true);

  // Refs that mirror state for use inside stable callbacks.
  const pausedRef = useRef(false);
  const showVideoControlsRef = useRef(true);

  // Seek via ref (stable handle exposed by VideoPlayerView).
  const videoRef = useRef<VideoPlayerViewRef | null>(null);

  // Auto-hide timer handle.
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoHide = useCallback(() => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }
  }, []);

  // Reset (or start) the 3 s auto-hide countdown.
  // Calling this with no args always restarts from 3 s.
  const resetAutoHide = useCallback(() => {
    clearAutoHide();
    autoHideTimer.current = setTimeout(() => {
      setShowVideoControls(false);
      showVideoControlsRef.current = false;
    }, AUTO_HIDE_MS);
  }, [clearAutoHide]);

  // Clean up timer on unmount.
  useEffect(() => () => clearAutoHide(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Thumbnail fade ───────────────────────────────────────────────────────
  const thumbnailOpacity = useRef(new Animated.Value(1)).current;
  const isVideoPlayingRef = useRef(false);

  const hasPreparedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // ── Reset when item changes ──────────────────────────────────────────────
  useEffect(() => {
    hasPreparedRef.current = false;
    setDisplayUri(null);
    setVideoError(null);
    thumbnailOpacity.setValue(1);
    isVideoPlayingRef.current = false;
    // Reset video controls state for the new item.
    pausedRef.current = false;
    setPaused(false);
    setMuted(false);
    setCurrentTime(0);
    setDuration(0);
    showVideoControlsRef.current = true;
    setShowVideoControls(true);
    clearAutoHide();
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release the decoder when a video slide loses focus.
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!isActive) {
      thumbnailOpacity.setValue(1);
      isVideoPlayingRef.current = false;
      setDisplayUri(null);
      hasPreparedRef.current = false;
      pausedRef.current = false;
      setPaused(false);
      setCurrentTime(0);
      setDuration(0);
      showVideoControlsRef.current = true;
      setShowVideoControls(true);
      clearAutoHide();
    }
  }, [isActive, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prepare URI ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        setDisplayUri(null);
        setVideoError(null);
        hasPreparedRef.current = false;
      }
      return;
    }

    if (hasPreparedRef.current) return;
    if (item.type !== 'image' && !isActive) return;

    hasPreparedRef.current = true;

    if (item.type === 'image') {
      const src = 'localUri' in item ? (item as SavedItem).localUri : item.uri;
      setDisplayUri(src);
      return;
    }

    const initialSource = 'localUri' in item
      ? (item as SavedItem).localUri
      : item.uri;

    if (!initialSource.startsWith('content://')) {
      setDisplayUri(initialSource);
      return;
    }

    setVideoError(null);
    prepareStatusForViewing(item as StatusItem, { forPlayback: true })
      .then((fileUri) => {
        if (!hasPreparedRef.current) return;
        if (fileUri && !fileUri.startsWith('content://')) {
          setDisplayUri(fileUri);
        } else {
          hasPreparedRef.current = false;
          setVideoError('Could not load video — tap to retry');
        }
      })
      .catch(() => {
        if (!hasPreparedRef.current) return;
        hasPreparedRef.current = false;
        setVideoError('Could not load video — tap to retry');
      });
  }, [item.id, isNearActive, isActive, prepareStatusForViewing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video callbacks (all stable — [] deps, use only stable setters/refs) ─
  const handlePlaying = useCallback(() => {
    isVideoPlayingRef.current = true;
    Animated.timing(thumbnailOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
    // Show controls briefly when video first starts, then auto-hide.
    showVideoControlsRef.current = true;
    setShowVideoControls(true);
    resetAutoHide();
  // thumbnailOpacity is a stable ref, resetAutoHide is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = useCallback((_msg: string) => {
    setVideoError('Tap to retry');
    clearAutoHide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    hasPreparedRef.current = false;
    setVideoError(null);
    setDisplayUri(null);
    thumbnailOpacity.setValue(1);
    isVideoPlayingRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setCurrentTime(0);
    setDuration(0);
    showVideoControlsRef.current = true;
    setShowVideoControls(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable — only uses stable setState setters.
  const handleProgress = useCallback((ct: number, dur: number) => {
    setCurrentTime(ct);
    if (dur > 0) setDuration(dur);
  }, []);

  const handleLoad = useCallback((dur: number) => {
    if (dur > 0) setDuration(dur);
  }, []);

  // ── Video controller callbacks ────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const nowPaused = !pausedRef.current;
    pausedRef.current = nowPaused;
    setPaused(nowPaused);
    if (nowPaused) {
      clearAutoHide(); // Controls stay visible while paused.
    } else {
      resetAutoHide(); // Resume playback → start auto-hide.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMuteToggle = useCallback(() => {
    setMuted(m => !m);
    resetAutoHide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeek = useCallback((time: number) => {
    videoRef.current?.seek(time);
    setCurrentTime(time);
    resetAutoHide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleControlTouch = useCallback(() => {
    if (!pausedRef.current) resetAutoHide();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap on the video area (empty space, not on a control button).
  const handleVideoTap = useCallback(() => {
    const next = !showVideoControlsRef.current;
    showVideoControlsRef.current = next;
    setShowVideoControls(next);
    if (next && !pausedRef.current) {
      resetAutoHide();
    } else {
      clearAutoHide();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Image gestures ────────────────────────────────────────────────────────
  const imageScale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    imageScale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [item.id, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      // No lower clamp — allow pinching below 1× (gallery-style); onEnd springs back.
      const newScale = Math.min(savedScale.value * e.scale, 6);
      imageScale.value = newScale;

      // Focal-point zoom: keep the midpoint between the user's two fingers
      // anchored in image space as the scale changes, so zoom always feels
      // centred on where the fingers actually are (not on the image centre).
      //
      // Transform order is [scale, translateX, translateY], so a point (px, py)
      // relative to the view centre maps to screen at:
      //   screenX = px * scale + translateX
      //   screenY = py * scale + translateY
      //
      // Solving for newTranslate so the focal point stays at the same screen
      // position before and after scaling:
      //   newTranslateX = fx * (1 - ratio) + savedTranslateX * ratio
      //   newTranslateY = fy * (1 - ratio) + savedTranslateY * ratio
      const fx = e.focalX - SW / 2;
      const fy = e.focalY - SH / 2;
      const ratio = newScale / (savedScale.value || 1);
      translateX.value = fx * (1 - ratio) + savedTranslateX.value * ratio;
      translateY.value = fy * (1 - ratio) + savedTranslateY.value * ratio;
    })
    .onEnd(() => {
      if (imageScale.value < 1) {
        // Pinched below natural size — spring back to fit.
        imageScale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = imageScale.value;
        // Clamp to pan bounds. Use SH (not SW) for the vertical axis so
        // a tall image cannot be dragged beyond its actual height.
        const maxX = ((imageScale.value - 1) * SW) / 2;
        const maxY = ((imageScale.value - 1) * SH) / 2;
        const cx = Math.max(-maxX, Math.min(maxX, translateX.value));
        const cy = Math.max(-maxY, Math.min(maxY, translateY.value));
        translateX.value = withSpring(cx);
        translateY.value = withSpring(cy);
        savedTranslateX.value = cx;
        savedTranslateY.value = cy;
      }
    });

  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (imageScale.value > 1) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      const scale = imageScale.value;
      const maxX = ((scale - 1) * SW) / 2;
      const maxY = ((scale - 1) * SW) / 2;
      const newX = savedTranslateX.value + e.translationX * 0.72;
      const newY = savedTranslateY.value + e.translationY * 0.72;
      translateX.value = Math.max(-maxX, Math.min(maxX, newX));
      translateY.value = Math.max(-maxY, Math.min(maxY, newY));
    })
    .onEnd((e) => {
      const scale = imageScale.value;
      const maxX = ((scale - 1) * SW) / 2;
      const maxY = ((scale - 1) * SW) / 2;
      translateX.value = withDecay(
        { velocity: e.velocityX * 0.5, deceleration: 0.92, clamp: [-maxX, maxX] },
        () => { savedTranslateX.value = translateX.value; },
      );
      translateY.value = withDecay(
        { velocity: e.velocityY * 0.5, deceleration: 0.92, clamp: [-maxY, maxY] },
        () => { savedTranslateY.value = translateY.value; },
      );
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(200)
    .onEnd((e) => {
      if (imageScale.value > 1) {
        imageScale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        const target = 2.5;
        imageScale.value = withSpring(target);
        savedScale.value = target;
        const maxX = ((target - 1) * SW) / 2;
        const maxY = ((target - 1) * SW) / 2;
        const tapX = Math.max(-maxX, Math.min(maxX, (SW / 2 - e.x) * (target - 1)));
        const tapY = Math.max(-maxY, Math.min(maxY, (SH / 2 - e.y) * (target - 1)));
        translateX.value = withSpring(tapX);
        translateY.value = withSpring(tapY);
        savedTranslateX.value = tapX;
        savedTranslateY.value = tapY;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => { runOnJS(onToggleControls)(); });

  const imageGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
  );

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: imageScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mediaUri = displayUri || initialSource;

  return (
    <View style={styles.itemContainer}>
      {item.type === 'image' ? (
        // ── Image viewer: pinch / pan / double-tap / single-tap ─────────────
        <GestureDetector gesture={imageGesture}>
          <Reanimated.View style={[StyleSheet.absoluteFill, imageAnimatedStyle]}>
            <Image
              source={{ uri: mediaUri }}
              style={styles.image}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={150}
              priority={isActive ? 'high' : 'low'}
              recyclingKey={item.id}
              allowDownscaling
              decodeFormat="rgb"
              placeholder={VIEWER_PLACEHOLDER}
              placeholderContentFit="cover"
            />
          </Reanimated.View>
        </GestureDetector>
      ) : (
        // ── Video viewer ─────────────────────────────────────────────────────
        <View style={StyleSheet.absoluteFill}>
          {/* Layer 1 — pure display, no touch handling.
              pointerEvents="none" disables the entire subtree so the
              Video component (which intercepts touches even with
              controls={false} on Android ExoPlayer) never steals taps. */}
          <View style={styles.videoWrap} pointerEvents="none">
            {!!displayUri && isActive && (
              <VideoPlayerView
                ref={videoRef}
                key={displayUri}
                fileUri={displayUri}
                paused={paused}
                muted={muted}
                onPlaying={handlePlaying}
                onError={handleError}
                onProgress={handleProgress}
                onLoad={handleLoad}
              />
            )}
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: thumbnailOpacity }]}
              pointerEvents="none"
            >
              <Image
                source={cachedThumb ? { uri: cachedThumb } : null}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                recyclingKey={item.id}
                placeholder={VIEWER_PLACEHOLDER}
                placeholderContentFit="cover"
              />
            </Animated.View>
          </View>

          {/* Layer 2 — tap detector.
              Sits above the non-interactive video layer but BELOW VideoControls.
              Because VideoControls is box-none, taps not caught by any control
              button fall through the box-none layer and land here.
              activeOpacity=1 → zero visual feedback (the video is the surface).
              React Native's TouchableOpacity yields to the parent FlatList's
              native scroll gesture via responder termination, so swiping to
              the next status still works. */}
          {!videoError && (
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={handleVideoTap}
              activeOpacity={1}
            />
          )}

          {/* Layer 3 — video controller overlay (topmost interactive layer).
              pointerEvents="box-none": the overlay box itself is transparent
              to touches; only the child buttons / seek bar capture taps. */}
          {!videoError && isActive && (
            <VideoControls
              visible={showVideoControls}
              paused={paused}
              muted={muted}
              currentTime={currentTime}
              duration={duration}
              onPlayPause={handlePlayPause}
              onMuteToggle={handleMuteToggle}
              onSeek={handleSeek}
              onControlTouch={handleControlTouch}
            />
          )}

          {/* Layer 4 — error / retry overlay (absolute top, only on error). */}
          {videoError && (
            <TouchableOpacity
              style={styles.errorOverlay}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-circle-outline" size={52} color="#fff" />
              <Text style={styles.errorText}>Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.isActive === next.isActive &&
  prev.isNearActive === next.isNearActive &&
  prev.onToggleControls === next.onToggleControls &&
  prev.prepareStatusForViewing === next.prepareStatusForViewing,
);
