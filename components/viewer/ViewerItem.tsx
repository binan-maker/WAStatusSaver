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
import { VideoPlayerView, getActiveMountedCount } from './VideoPlayerView';
import { ExoPlayerView, isAvailable as exoPlayerIsAvailable } from '@/modules/exo-player';
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

// Module-level flag — set to true either at load time (UIManager check in
// isAvailable() returns false) or on the first ExoPlayerBoundary catch.
// Once true it stays true for the whole app session so ExoPlayerView is
// never rendered again and the "View config not found" error never fires.
//
// Evaluated once at module load — isAvailable() is synchronous.
let exoPlayerModuleUnavailable = !exoPlayerIsAvailable();

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
  // Initialises from the module-level flag so subsequent items instantly go to
  // the expo-video fallback without ever trying to render ExoPlayerView again.
  const [nativePlayerFailed, setNativePlayerFailed] = useState(exoPlayerModuleUnavailable);

  // Thumbnail fades from 1 (fully visible) to 0 (hidden) once video plays.
  // Using Animated.Value so the fade is smooth and never flickers.
  const thumbnailOpacity = useRef(new Animated.Value(1)).current;
  const isVideoPlayingRef = useRef(false);

  const prepareCancelRef = useRef(false);

  // ── Debounced video-player mount gate ────────────────────────────────────
  // Goal: totalActive=1 at all times — only the active slide has a player.
  //
  // Two-timer strategy (solves the overlap the 500 ms approach created):
  //
  //   UNMOUNT — 32 ms debounce when isActive → false
  //     • Transient FlatList reconciliation flickers (isActive false for one
  //       render frame ≈ 16 ms) cancel the timer before it fires → no unmount.
  //     • Real swipe-aways stay false → timer fires at 32 ms → player gone.
  //
  //   MOUNT — immediate if no other player is alive; 64 ms delay otherwise
  //     • getActiveMountedCount() reads the module-level counter in
  //       VideoPlayerView.  If it is 0 the decoder is free → mount now.
  //     • If it is > 0 another slide's player is still alive (will unmount
  //       in ≤ 32 ms) → wait 64 ms so the old player is guaranteed gone first.
  //
  // Timeline for a normal swipe A→B (both effects fire in the same render):
  //   T=0  ms  old slide A: starts 32 ms unmount timer
  //   T=0  ms  new slide B: sees count=1 → starts 64 ms mount timer
  //   T=32 ms  A unmounts → totalActive=0
  //   T=64 ms  B mounts  → totalActive=1  ✅ no overlap
  //
  // Timeline for transient false on current slide:
  //   T=0  ms  isActive=false → 32 ms unmount timer starts
  //   T=16 ms  isActive=true  → cancel timer; count=1 (self still alive)
  //            → 64 ms mount timer (redundant but harmless; self already mounted)
  //            → setVideoPlayerMounted(true) is a no-op (already true)  ✅
  const [videoPlayerMounted, setVideoPlayerMounted] = useState(isActive);
  const videoMountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (videoMountTimerRef.current) {
      clearTimeout(videoMountTimerRef.current);
      videoMountTimerRef.current = null;
    }

    if (isActive) {
      const existingPlayers = getActiveMountedCount();
      if (existingPlayers === 0) {
        setVideoPlayerMounted(true);
      } else {
        videoMountTimerRef.current = setTimeout(() => {
          videoMountTimerRef.current = null;
          if (isActiveRef.current) {
            setVideoPlayerMounted(true);
          }
        }, 64);
      }
    } else {
      videoMountTimerRef.current = setTimeout(() => {
        videoMountTimerRef.current = null;
        if (!isActiveRef.current) {
          setVideoPlayerMounted(false);
        }
      }, 32);
    }

    return () => {
      if (videoMountTimerRef.current) {
        clearTimeout(videoMountTimerRef.current);
        videoMountTimerRef.current = null;
      }
    };
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced paused prop for native ExoPlayerView ───────────────────────
  // isActive can briefly flip false for a single render frame when items
  // re-indexes (FlatList reconciliation lag vs. useMemo-derived currentIndex).
  // Passing `paused={!isActive}` directly would pause the native ExoPlayer on
  // that transient false, causing a stutter.  A 400 ms debounce absorbs
  // the flicker — real swipe-aways keep isActive=false long enough for the
  // timeout to fire; render-flickers cancel the timer before it runs.
  const [exoPaused, setExoPaused] = useState(!isActive);
  const exoPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    if (exoPauseTimerRef.current) {
      clearTimeout(exoPauseTimerRef.current);
      exoPauseTimerRef.current = null;
    }
    if (isActive) {
      setExoPaused(false);
    } else {
      exoPauseTimerRef.current = setTimeout(() => {
        exoPauseTimerRef.current = null;
        if (!isActiveRef.current) setExoPaused(true);
      }, 400);
    }
    return () => {
      if (exoPauseTimerRef.current) {
        clearTimeout(exoPauseTimerRef.current);
        exoPauseTimerRef.current = null;
      }
    };
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSAF = initialSource.startsWith('content://');

  // ── Reset everything when item changes ──────────────────────────────────
  useEffect(() => {
    prepareCancelRef.current = true;
    setDisplayUri(null);
    setVideoError(null);
    // nativePlayerFailed is NOT reset here — ExoPlayer availability is a device-level
    // fact for this build. Once the module-level flag is set, all subsequent items
    // initialise directly to the expo-video fallback (see useState initialiser above).
    thumbnailOpacity.setValue(1);
    isVideoPlayingRef.current = false;
    // Reset the debounced video-player mount gate for this new item.
    if (videoMountTimerRef.current) {
      clearTimeout(videoMountTimerRef.current);
      videoMountTimerRef.current = null;
    }
    setVideoPlayerMounted(isActiveRef.current);
    // Reset exoPaused debounce timer so the new item starts unpaused if active.
    if (exoPauseTimerRef.current) {
      clearTimeout(exoPauseTimerRef.current);
      exoPauseTimerRef.current = null;
    }
    setExoPaused(!isActiveRef.current);
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
      setDisplayUri(initialSource);
      return;
    }

    prepareCancelRef.current = false;
    setVideoError(null);

    prepareStatusForViewing(item as StatusItem, { forPlayback: true })
      .then((fileUri) => {
        if (prepareCancelRef.current) return;
        if (fileUri) {
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
  // Sets the module-level flag so no future ViewerItem ever attempts ExoPlayerView again.
  const handleNativePlayerFail = useCallback(() => {
    exoPlayerModuleUnavailable = true;
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
                sets nativePlayerFailed=true).

                Mount guard: videoPlayerMounted (debounced state, see above).
                  • Becomes true immediately when isActive → true.
                  • Becomes false after 500 ms when isActive → false.
                  • Transient render flickers (<16 ms) cancel the timer → no unmount.
                  • Real swipe-aways fire the timer → player unmounts, decoder freed.
                This guarantees totalActive=1 at all times (no competing decoders).

                paused={exoPaused} — separate 400 ms debounce for ExoPlayerView so
                render-flicker false values never reach the native pause API. */}
            {videoPlayerMounted && displayUri && !nativePlayerFailed && (
              <ExoPlayerBoundary onError={handleNativePlayerFail}>
                <ExoPlayerView
                  key={displayUri}
                  style={StyleSheet.absoluteFill}
                  fileUri={displayUri}
                  paused={exoPaused}
                  muted={false}
                  onPlayerReady={handlePlaying}
                  onPlayerError={handleError}
                />
              </ExoPlayerBoundary>
            )}

            {videoPlayerMounted && displayUri && nativePlayerFailed && (
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
