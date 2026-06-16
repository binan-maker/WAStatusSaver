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
import { ExoPlayerView } from '@/modules/exo-player';
import { ExoPlayerBoundary } from './ExoPlayerBoundary';
import { Ionicons } from '@expo/vector-icons';
import { useMedia, StatusItem, SavedItem } from '@/contexts/MediaContext';
import { useThemeColors } from '@/contexts/ThemeContext';
import { useThumbnail } from '@/hooks/media/useThumbnail';
import { createStyles, SW, SH } from './viewerStyles';

const VIEWER_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

export interface ViewerItemProps {
  item: StatusItem | SavedItem;
  isActive: boolean;
  isNearActive: boolean;
  onToggleControls: () => void;
  showControls: boolean;
  controlsOpacity: Animated.Value;
}

export function ViewerItem({
  item,
  isActive,
  isNearActive,
  onToggleControls,
}: ViewerItemProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { prepareStatusForViewing } = useMedia();

  const cachedThumb = useThumbnail(item.id);

  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  // true when the native ExoPlayerView fails to render (not compiled into build);
  // falls back to expo-video VideoPlayerView in that case.
  const [nativePlayerFailed, setNativePlayerFailed] = useState(false);

  // Thumbnail fades from 1 (fully visible) to 0 (hidden) once video plays.
  // Using Animated.Value so the fade is smooth and never flickers.
  const thumbnailOpacity = useRef(new Animated.Value(1)).current;
  const isVideoPlayingRef = useRef(false);

  const prepareCancelRef = useRef(false);

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSAF = initialSource.startsWith('content://');

  // ── Reset everything when item changes ──────────────────────────────────
  useEffect(() => {
    prepareCancelRef.current = true;
    setDisplayUri(null);
    setVideoError(null);
    setNativePlayerFailed(false);
    thumbnailOpacity.setValue(1);
    isVideoPlayingRef.current = false;
    prepareCancelRef.current = false;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-show thumbnail when slide becomes inactive (for next swipe-back)
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!isActive) {
      thumbnailOpacity.setValue(1);
      isVideoPlayingRef.current = false;
    }
  }, [isActive, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prepare URI ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        setDisplayUri(null);
        setVideoError(null);
      }
      return;
    }

    if (displayUri) return;

    if (item.type === 'image') {
      setDisplayUri(initialSource);
      return;
    }

    if (!isActive) return;

    if (!isSAF) {
      console.log(
        '[ViewerItem] displayUri set (non-SAF) uri_type=' +
          (initialSource.startsWith('file://') ? 'FILE' : initialSource.startsWith('content://') ? 'CONTENT⚠️' : 'OTHER⚠️'),
      );
      setDisplayUri(initialSource);
      return;
    }

    prepareCancelRef.current = false;
    setVideoError(null);

    prepareStatusForViewing(item as StatusItem, { forPlayback: true })
      .then((fileUri) => {
        if (prepareCancelRef.current) return;
        if (fileUri) {
          console.log(
            '[ViewerItem] displayUri set (SAF copy) uri_type=' +
              (fileUri.startsWith('file://') ? 'FILE' : fileUri.startsWith('content://') ? 'CONTENT⚠️' : 'OTHER⚠️') +
              ' uri=' + fileUri.slice(0, 100),
          );
          setDisplayUri(fileUri);
        } else {
          setVideoError('Could not load video — tap to retry');
        }
      })
      .catch(() => {
        if (prepareCancelRef.current) return;
        setVideoError('Could not load video — tap to retry');
      });

    return () => { prepareCancelRef.current = true; };
  }, [initialSource, isSAF, item, isNearActive, isActive, displayUri, prepareStatusForViewing]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Called by ExoPlayerBoundary when the native view throws at render time,
  // meaning the native module wasn't compiled into this build — fall back to expo-video.
  const handleNativePlayerFail = useCallback(() => {
    console.log('[ViewerItem] native ExoPlayerView unavailable → falling back to expo-video');
    setNativePlayerFailed(true);
  }, []);

  const handleRetry = useCallback(() => {
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

            {/* Video player — mounts as soon as displayUri is ready.
                key={displayUri} ensures a fresh player for each new file:// URI.

                PRIMARY: native ExoPlayerView (TextureView — immune to OEM surface bugs).
                FALLBACK: expo-video VideoPlayerView, used when native module was not
                compiled into the build (ExoPlayerBoundary catches the render error and
                sets nativePlayerFailed=true). */}
            {isActive && displayUri && !nativePlayerFailed && (
              <ExoPlayerBoundary onError={handleNativePlayerFail}>
                <ExoPlayerView
                  key={displayUri}
                  style={StyleSheet.absoluteFill}
                  fileUri={displayUri}
                  paused={false}
                  muted={false}
                  onPlayerReady={handlePlaying}
                  onPlayerError={handleError}
                />
              </ExoPlayerBoundary>
            )}

            {isActive && displayUri && nativePlayerFailed && (
              <VideoPlayerView
                key={displayUri}
                fileUri={displayUri}
                isActive={isActive}
                onPlaying={handlePlaying}
                onError={handleError}
              />
            )}

            {/* Thumbnail poster — always behind the video, fades to 0 once
                playingChange fires. Never shows a spinner or play button.
                Opacity animates smoothly: 1 (covering) → 0 (transparent). */}
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

            {/* Retry overlay — only shown on actual playback error */}
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
}
