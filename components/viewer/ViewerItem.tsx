import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
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
import { VideoView, useVideoPlayer } from 'expo-video';
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

  // Pre-generated file:// JPG thumbnail — used as poster while video prepares.
  const cachedThumb = useThumbnail(item.id);

  // displayUri is always file:// for videos — never content://
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const prepareCancelRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRevealedOnceRef = useRef(false);

  // ── expo-video player (unconditional — hook rules) ─────────────────────────
  // expo-video uses ExoPlayer under the hood and is Fabric-compatible.
  // All videos arrive here as file:// URIs (SAF content:// is always copied
  // to file:// by prepareStatusForViewing before this point).
  const videoPlayer = useVideoPlayer(null, (player) => {
    player.loop = true;
    player.muted = false;
  });

  // ── Raw source (may be content:// on Android 11+) ──────────────────────────
  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSAF = initialSource.startsWith('content://');

  // ── Reveal helpers ─────────────────────────────────────────────────────────

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const scheduleReveal = useCallback(
    (delayMs: number) => {
      clearRevealTimer();
      revealTimerRef.current = setTimeout(() => {
        hasRevealedOnceRef.current = true;
        setIsVideoVisible(true);
      }, delayMs);
    },
    [clearRevealTimer],
  );

  // ── Reset all state when item changes ──────────────────────────────────────
  useEffect(() => {
    prepareCancelRef.current = true;
    setDisplayUri(null);
    setIsVideoReady(false);
    setIsVideoVisible(false);
    setIsPreparing(false);
    setVideoError(null);
    hasRevealedOnceRef.current = false;
    clearRevealTimer();
    prepareCancelRef.current = false;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup reveal timer on unmount ────────────────────────────────────────
  useEffect(() => () => clearRevealTimer(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Release player on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { videoPlayer.release(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load video source when displayUri is ready ─────────────────────────────
  useEffect(() => {
    if (item.type !== 'video') return;
    if (displayUri) {
      try {
        videoPlayer.replace({ uri: displayUri });
      } catch {}
    }
  }, [displayUri, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play / pause based on active state ─────────────────────────────────────
  useEffect(() => {
    if (item.type !== 'video') return;
    try {
      if (isActive && displayUri) {
        videoPlayer.play();
      } else {
        videoPlayer.pause();
      }
    } catch {}
  }, [isActive, displayUri, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Status listener ────────────────────────────────────────────────────────
  const handlePlayerReady = useCallback(() => {
    setIsVideoReady(true);
    setVideoError(null);
    if (!hasRevealedOnceRef.current) {
      scheduleReveal(80);
    }
  }, [scheduleReveal]);

  const handlePlayerError = useCallback((error: string) => {
    setVideoError('Tap to retry');
    setIsVideoReady(false);
  }, []);

  useEffect(() => {
    if (item.type !== 'video') return;
    const sub = videoPlayer.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        handlePlayerReady();
      } else if (event.status === 'error') {
        handlePlayerError(
          (event as any).error?.message ?? 'Playback error',
        );
      }
    });
    return () => sub.remove();
  }, [videoPlayer, item.type, handlePlayerReady, handlePlayerError]);

  // ── Hide video overlay when this slide becomes inactive ────────────────────
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!isActive) {
      setIsVideoVisible(false);
      clearRevealTimer();
    }
  }, [isActive, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-schedule reveal when returning to an already-ready slide ────────────
  useEffect(() => {
    if (item.type !== 'video') return;
    if (isActive && isVideoReady && !isVideoVisible) {
      scheduleReveal(80);
    }
  }, [isActive, isVideoReady, isVideoVisible, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRITICAL: Prepare URI — copy SAF content:// → file:// before playback ──
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        setDisplayUri(null);
        setIsVideoReady(false);
        setIsPreparing(false);
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
      setDisplayUri(initialSource);
      return;
    }

    setIsPreparing(true);
    setVideoError(null);
    prepareCancelRef.current = false;

    prepareStatusForViewing(item as StatusItem, { forPlayback: true })
      .then((fileUri) => {
        if (prepareCancelRef.current) return;
        setDisplayUri(fileUri);
        setIsPreparing(false);
      })
      .catch(() => {
        if (prepareCancelRef.current) return;
        setVideoError('Could not load video — tap to retry');
        setIsPreparing(false);
      });

    return () => { prepareCancelRef.current = true; };
  }, [initialSource, isSAF, item, isNearActive, isActive, displayUri, prepareStatusForViewing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual retry ───────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setVideoError(null);
    setDisplayUri(null);
  }, []);

  const mediaUri = displayUri || initialSource;

  // ── Pinch-to-zoom for images ───────────────────────────────────────────────
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

            {/* expo-video VideoView — mounts when active AND file:// URI is ready.
                All SAF content:// URIs are copied to file:// by
                prepareStatusForViewing before displayUri is ever set.
                expo-video wraps ExoPlayer natively and is Fabric-compatible. */}
            {isActive && displayUri && !isPreparing && (
              <VideoView
                player={videoPlayer}
                style={StyleSheet.absoluteFill}
                nativeControls={false}
                contentFit="contain"
              />
            )}

            {/* Thumbnail poster — shown until video is playing.
                Policy: always a pre-generated file:// JPG from ThumbnailCache.
                No videoTimestamp on any URI — blurhash placeholder until ready. */}
            {(!isActive || !isVideoVisible) && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
                {isActive && !isVideoReady && !isPreparing && !videoError && (
                  <View style={styles.videoPlayBadge} pointerEvents="none">
                    <View style={styles.videoPlayBadgeInner}>
                      <Ionicons name="play" size={28} color="#fff" />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Spinner while copying SAF → file:// cache */}
            {isPreparing && (
              <View style={styles.videoSpinnerWrap} pointerEvents="none">
                <ActivityIndicator color="#fff" size="large" />
                <Text style={{ color: '#fff', marginTop: 12, fontSize: 12 }}>
                  Loading video…
                </Text>
              </View>
            )}

            {/* Retry overlay on playback error or copy failure */}
            {videoError && !isPreparing && (
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
