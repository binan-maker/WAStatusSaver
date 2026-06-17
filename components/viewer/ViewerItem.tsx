/**
 * ViewerItem — single slide in the full-screen status viewer.
 *
 * VIDEO PLAYER ARCHITECTURE (Android 11+ SAF)
 * ───────────────────────────────────────────
 * The custom native ExoPlayerView module requires Java source files at
 * modules/exo-player/android/ that are not present in this repo, so
 * UIManager.hasViewManagerConfig('ExoPlayerView') always returns false
 * and the module is always unavailable. All video playback therefore goes
 * through expo-video (VideoPlayerView). The ExoPlayerView/ExoPlayerBoundary
 * code has been removed to eliminate the state changes (nativePlayerFailed,
 * exoPaused) they caused — those state updates triggered ViewerItem re-renders
 * while a video was playing, which detached and reattached the VideoView's
 * SurfaceTexture and contributed to the Android 11+ freeze.
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
import { VideoPlayerView } from './VideoPlayerView';
import { Ionicons } from '@expo/vector-icons';
import { StatusItem, SavedItem } from '@/contexts/MediaContext';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useThumbnail } from '@/hooks/media/useThumbnail';
import { createStyles, SW, SH } from './viewerStyles';

const VIEWER_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

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

  // Thumbnail fades from 1→0 once video starts playing.
  const thumbnailOpacity = useRef(new Animated.Value(1)).current;
  const isVideoPlayingRef = useRef(false);

  // Tracks whether URI preparation has been initiated for the current item.
  // Using a ref (not state) means starting the async copy doesn't re-render
  // the component, which keeps the player unmolested during file I/O.
  const hasPreparedRef = useRef(false);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  // Video stays mounted for as long as this item is within the FlatList
  // window (isNearActive=true). isActive controls only the paused prop
  // inside VideoPlayerView — we never unmount the player on navigation.
  // Mounting/unmounting the decoder on every swipe was the root cause of
  // the visible freeze: destroy → reload → stutter.

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSAF = initialSource.startsWith('content://');

  // ── Reset everything when item changes ──────────────────────────────────
  useEffect(() => {
    hasPreparedRef.current = false;
    setDisplayUri(null);
    setVideoError(null);
    thumbnailOpacity.setValue(1);
    isVideoPlayingRef.current = false;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a video slide loses focus: reset visual state AND release the decoder.
  // Clearing displayUri unmounts <VideoPlayerView>, freeing the hardware
  // MediaCodec slot immediately. The cache file on disk is untouched, so
  // re-mounting on swipe-back is instant (fast-path in prepareStatusForViewing
  // returns the cached file:// in < 5 ms without re-copying).
  // hasPreparedRef is also reset so the prepare effect can re-run and
  // re-set displayUri when this slide becomes active again.
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!isActive) {
      thumbnailOpacity.setValue(1);
      isVideoPlayingRef.current = false;
      setDisplayUri(null);
      hasPreparedRef.current = false;
    }
  }, [isActive, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prepare URI ──────────────────────────────────────────────────────────
  // hasPreparedRef gates this effect so it runs at most once per item.
  // displayUri is intentionally NOT in the dependency array — including it
  // caused React to run the effect cleanup (setting a cancel flag) every time
  // setDisplayUri was called, which silently dropped the copy result for
  // the next swipe-to-same-item scenario.
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        // Fully out of the window — free the display URI so the player
        // is not mounted for off-screen items.
        setDisplayUri(null);
        setVideoError(null);
        hasPreparedRef.current = false;
      }
      return;
    }

    // Already started or completed preparation for this item.
    if (hasPreparedRef.current) return;

    // Don't start SAF copy until the slide is actually active.
    // Images are cheap and can be set immediately for adjacent slides.
    if (item.type !== 'image' && !isActive) return;

    hasPreparedRef.current = true;

    if (item.type === 'image') {
      setDisplayUri(initialSource);
      return;
    }

    if (!isSAF) {
      // Legacy file:// (saved items or Android ≤10 paths) — play directly.
      setDisplayUri(initialSource);
      return;
    }

    // SAF content:// video — MUST copy to local file:// before the player
    // mounts. ExoPlayer cannot reliably stream from the SAF ContentProvider
    // on Android 11+: the DocumentProvider process is too slow to refill
    // ExoPlayer's buffer, so playback freezes at ~1s every time.
    setVideoError(null);

    prepareStatusForViewing(item as StatusItem, { forPlayback: true })
      .then((fileUri) => {
        if (!hasPreparedRef.current) return; // cancelled by item change
        if (fileUri && !fileUri.startsWith('content://')) {
          // Only accept file:// paths — a content:// URI passed to ExoPlayer
          // causes the SAF-freeze loop (DocumentProvider too slow to keep the
          // buffer filled on Android 11+).
          setDisplayUri(fileUri);
        } else if (fileUri?.startsWith('content://')) {
          // prepareStatusForViewing returned the raw SAF URI instead of a
          // cached copy. This should not happen for videos, but if it does,
          // surface the retry overlay rather than passing content:// to the
          // player and triggering the freeze.
          if (__DEV__) console.warn('[ViewerItem] content:// leaked to displayUri — forcing retry', fileUri);
          hasPreparedRef.current = false;
          setVideoError('Could not load video — tap to retry');
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
  }, [initialSource, isSAF, item.id, isNearActive, isActive, prepareStatusForViewing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Callbacks for VideoPlayerView ────────────────────────────────────────
  const handlePlaying = useCallback(() => {
    if (isVideoPlayingRef.current) return;
    isVideoPlayingRef.current = true;
    Animated.timing(thumbnailOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [thumbnailOpacity]);

  const handleError = useCallback((_msg: string) => {
    setVideoError('Tap to retry');
  }, []);

  const handleRetry = useCallback(() => {
    // Reset ALL state so the prepare effect re-runs from scratch.
    hasPreparedRef.current = false;
    setVideoError(null);
    setDisplayUri(null);
    thumbnailOpacity.setValue(1);
    isVideoPlayingRef.current = false;
  }, [thumbnailOpacity]);

  const mediaUri = displayUri || initialSource;

  // ── Pinch-to-zoom for images ───────────────────────────────────────────
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
      imageScale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 6);
    })
    .onEnd(() => {
      if (imageScale.value < 1.15) {
        imageScale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = imageScale.value;
        const maxX = ((imageScale.value - 1) * SW) / 2;
        const maxY = ((imageScale.value - 1) * SW) / 2;
        if (Math.abs(translateX.value) > maxX) {
          const cx = translateX.value > 0 ? maxX : -maxX;
          translateX.value = withSpring(cx);
          savedTranslateX.value = cx;
        }
        if (Math.abs(translateY.value) > maxY) {
          const cy = translateY.value > 0 ? maxY : -maxY;
          translateY.value = withSpring(cy);
          savedTranslateY.value = cy;
        }
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

  return (
    <View style={styles.itemContainer}>
      {item.type === 'image' ? (
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
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.videoWrap}>

            {/* Video player — only mounted for the ACTIVE slide.
                isActive gates mounting so exactly one hardware MediaCodec
                decoder exists at any time. Android typically has 1-2 slots;
                having prev+current+next decoders all alive simultaneously
                causes resource contention that produces the stutter loop.
                The cache file (file://) survives on disk between mounts, so
                swipe-back re-mounts the player instantly without re-copying.
                key={displayUri}: new player instance only when the URI
                changes (different item or tap-to-retry). */}
            {!!displayUri && isActive && (
              <VideoPlayerView
                key={displayUri}
                fileUri={displayUri}
                isActive={isActive}
                onPlaying={handlePlaying}
                onError={handleError}
              />
            )}

            {/* Thumbnail poster — covers the black frame while copy is in
                progress and while the decoder warms up. Fades to invisible
                once the first real frame is confirmed via timeUpdate > 0. */}
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

            {/* Retry overlay — only shown on confirmed playback error */}
            {videoError && (
              <TouchableOpacity
                style={[
                  StyleSheet.absoluteFill,
                  {
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                  },
                ]}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-circle-outline" size={52} color="#fff" />
                <Text style={{ color: '#fff', marginTop: 10, fontSize: 14 }}>
                  Tap to retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
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
