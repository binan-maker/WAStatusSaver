import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  FlatList,
  InteractionManager,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withDecay, runOnJS } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMedia, StatusItem, SavedItem } from '@/contexts/MediaContext';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { FONT_SIZE, SPACING, RADIUS } from '@/constants/theme';
import { useEventListener } from 'expo';

import { AdInterstitial } from '@/components/ads/AdInterstitial';
import { AdBanner } from '@/components/ads/AdBanner';
import { BannerAdSize } from 'react-native-google-mobile-ads';

const { width: SW, height: SH } = Dimensions.get('window');

interface ViewerItemProps {
  item: StatusItem | SavedItem;
  isActive: boolean;
  isNearActive: boolean;
  onToggleControls: () => void;
  showControls: boolean;
  controlsOpacity: Animated.Value;
}

function formatTime(millis: number) {
  const totalSeconds = millis / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// ── Branded skeleton shimmer for image loading ────────────────────────────────
const shimmerAnim = new Animated.Value(0);
let shimmerRunning = false;
function ensureShimmer() {
  if (shimmerRunning) return;
  shimmerRunning = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(shimmerAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(shimmerAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ])
  ).start();
}

function ImageSkeleton() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  useEffect(() => { ensureShimmer(); }, []);
  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.PRIMARY, opacity }]} />
      <ActivityIndicator
        color={COLORS.PRIMARY}
        size="large"
        style={{ position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -20 }}
      />
    </View>
  );
}

function ViewerItem({ item, isActive, isNearActive, onToggleControls, showControls, controlsOpacity }: ViewerItemProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { prepareStatusForViewing } = useMedia();
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  // isVideoVisible is true only after the first frame has rendered to the
  // SurfaceView. It lags behind isVideoReady by 200 ms so the thumbnail never
  // disappears before ExoPlayer has pushed pixels to the screen.
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const isActiveRef = useRef(isActive);
  const isLoadingSource = useRef(false);
  const isReadyToPlayRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const scheduleReveal = useCallback((delayMs: number) => {
    clearRevealTimer();
    console.log(`[Viewer] Scheduling reveal in ${delayMs}ms for ${item.name}`);
    revealTimerRef.current = setTimeout(() => {
      console.log(`[Viewer] REVEALING video surface for ${item.name}`);
      setIsVideoVisible(true);
    }, delayMs);
  }, [clearRevealTimer, item.name]);

  // Reanimated shared values for smooth pinch-to-zoom on images
  const imageScale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // Fully release the hardware decoder on unmount.
  // Using player.release() (not just replaceAsync(null)) is critical:
  // replaceAsync(null) clears the source but may leave the native ExoPlayer
  // instance holding its hardware codec slot. With windowSize={3}, the FlatList
  // only keeps 3 items mounted, so each unmount MUST free the decoder slot.
  // Without release(), after 3-5 videos the hardware codec pool (typically 3-4
  // slots on Android) is exhausted → new videos decode in black.
  useEffect(() => {
    return () => {
      try { player.release(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id, item.uri]);

  // Player starts with no source. A file:// URI is fed in via replaceAsync once
  // the content:// file has been fully copied to the cache dir.
  const player = useVideoPlayer(null, (p) => {
    if (p) {
      p.loop = true;
      p.muted = true;
      if (Platform.OS === 'android') {
        p.staysActiveInBackground = false;
      }
    }
  });

  const tryStartPlayback = useCallback(() => {
    if (
      item.type !== 'video' ||
      !displayUri ||
      isLoadingSource.current ||
      !isReadyToPlayRef.current ||
      !isActiveRef.current
    ) return;

    try {
      player.muted = false;
      player.play();
    } catch (e) {
      console.log('Player start error:', e);
    }
  }, [displayUri, item.type, player]);

  // ── Status listener ──────────────────────────────────────────────────────
  useEventListener(player, 'statusChange', ({ status }: { status: string }) => {
    if (item.type !== 'video') return;
    console.log(`[Viewer] Player status for ${item.name}: ${status}`);
    const ready = status === 'readyToPlay';
    isReadyToPlayRef.current = ready;
    setIsVideoReady(ready);
    if (ready) {
      tryStartPlayback();
      // Schedule the thumbnail hide 200 ms AFTER readyToPlay. This gap lets
      // ExoPlayer push the first frame to the SurfaceView before we reveal it.
      // Without this delay, readyToPlay fires while the frame pipeline is still
      // filling, causing audio-only black screen on first play.
      if (isActiveRef.current) {
        scheduleReveal(200);
      }
    } else {
      setIsVideoVisible(false);
      clearRevealTimer();
    }
  });

  // Reset ready + visible flags (and cancel any pending reveal) on source change.
  useEffect(() => {
    setIsVideoReady(false);
    setIsVideoVisible(false);
    clearRevealTimer();
  }, [displayUri]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Source loading ───────────────────────────────────────────────────────
  // Strategy: call replaceAsync as soon as animations finish (InteractionManager),
  // then rely on the 200 ms isVideoVisible reveal delay to guarantee the first
  // frame is on screen before the thumbnail disappears.
  //
  // The old approach (300 ms explicit pre-buffer) tried to delay replaceAsync
  // long enough for the SurfaceView to bind — but that race was non-deterministic.
  // The new approach flips it: start decoding immediately after the animation,
  // and keep the thumbnail up until we KNOW frames are rendering (200 ms post-
  // readyToPlay). This eliminates the black screen unconditionally on all devices.
  useEffect(() => {
    if (item.type !== 'video' || !player || !displayUri) return;

    let cancelled = false;
    isLoadingSource.current = true;
    isReadyToPlayRef.current = false;

    const load = async () => {
      const loadStart = Date.now();
      try {
        // Wait for any in-flight navigation/gesture animations so the JS thread
        // is free, then call replaceAsync immediately — no extra time buffer.
        console.log(`[Viewer] Waiting for animations before load: ${item.name}`);
        // Race against a 250ms cap so a long-running scroll animation never
        // blocks the video load entirely on slow Android 11 devices.
        await Promise.race([
          new Promise<void>(resolve => InteractionManager.runAfterInteractions(resolve)),
          new Promise<void>(resolve => setTimeout(resolve, 250)),
        ]);
        if (cancelled) return;
        console.log(`[Viewer] Animation done, calling replaceAsync for ${item.name} (${Date.now() - loadStart}ms)`);

        await player.replaceAsync(displayUri);
        if (!cancelled) {
          console.log(`[Viewer] replaceAsync complete for ${item.name} (${Date.now() - loadStart}ms)`);
          isLoadingSource.current = false;
        }
        tryStartPlayback();
      } catch (e) {
        if (!cancelled) {
          isLoadingSource.current = false;
          console.error(`[Viewer] Player load error for ${item.name} (${Date.now() - loadStart}ms):`, e);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      isLoadingSource.current = false;
      isReadyToPlayRef.current = false;
    };
  }, [displayUri, item.type, player, tryStartPlayback]);

  // ── Reveal timer cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => { clearRevealTimer(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle swipe-to-already-ready-video ──────────────────────────────────
  // When the user swipes to a nearActive video that was already buffered (isVideoReady=true)
  // but never got to reveal (isVideoVisible=false), kick off a short reveal timer.
  // The video has been playing muted the whole time so frames are already on screen.
  useEffect(() => {
    if (item.type !== 'video') return;
    if (isActive && isVideoReady && !isVideoVisible) {
      scheduleReveal(80);
    }
    if (!isActive) {
      setIsVideoVisible(false);
      clearRevealTimer();
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Active / inactive sync ───────────────────────────────────────────────
  useEffect(() => {
    if (item.type !== 'video' || !player || isLoadingSource.current) return;
    try {
      if (isActive) {
        tryStartPlayback();
      } else {
        player.muted = true;
        if (!isNearActive) {
          player.pause();
          isReadyToPlayRef.current = false;
          setIsVideoReady(false);
          (player as any).replaceAsync?.(null).catch?.(() => {});
        }
      }
    } catch (e) {
      console.log('Player sync error:', e);
    }
  }, [isActive, isNearActive, player, item.type, tryStartPlayback]);

  // ── URI preparation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        setDisplayUri(null);
        setIsVideoReady(false);
        // DO NOT call replaceAsync(null) here — the active/inactive sync effect
        // handles that. Calling it from two effects simultaneously causes a race
        // that corrupts the player state and produces black screen on Android 11.
        if (item.type === 'video' && player) {
          isReadyToPlayRef.current = false;
          try { player.pause(); } catch {}
        }
      }
      return;
    }

    let isMounted = true;
    async function prepare() {
      const pStart = Date.now();
      try {
        if (!initialSource.startsWith('content://') || item.type === 'image') {
          if (isMounted) setDisplayUri(initialSource);
          return;
        }
        console.log(`[Viewer] Preparing status for ${item.name}...`);
        const prepared = await prepareStatusForViewing(item as StatusItem);
        console.log(`[Viewer] Preparation done for ${item.name} (${Date.now() - pStart}ms). Local URI: ${prepared}`);
        if (isMounted) setDisplayUri(prepared);
      } catch (e) {
        console.error(`[Viewer] Preparation failed for ${item.name}:`, e);
        if (isMounted) setDisplayUri(initialSource);
      }
    }

    if (!displayUri) prepare();
    return () => { isMounted = false; };
  }, [initialSource, item, isNearActive, isActive]);

  const mediaUri = displayUri || initialSource;

  // Reset zoom and image-loaded state whenever a different item becomes active
  useEffect(() => {
    imageScale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setImageLoaded(false);
  }, [item.id]);

  // ── Image gesture handlers ────────────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedScale.value * e.scale, 1), 6);
      imageScale.value = next;
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
        // Clamp translation to bounds after scale settles.
        // Both axes use SW (the smaller dimension on portrait phones) so that
        // landscape images — which are letterboxed with short content height —
        // can never be panned fully off-screen.
        const maxX = ((imageScale.value - 1) * SW) / 2;
        const maxY = ((imageScale.value - 1) * SW) / 2;
        if (Math.abs(translateX.value) > maxX) {
          const clampedX = translateX.value > 0 ? maxX : -maxX;
          translateX.value = withSpring(clampedX);
          savedTranslateX.value = clampedX;
        }
        if (Math.abs(translateY.value) > maxY) {
          const clampedY = translateY.value > 0 ? maxY : -maxY;
          translateY.value = withSpring(clampedY);
          savedTranslateY.value = clampedY;
        }
      }
    });

  // Pan is only activated when zoomed in. Translation is clamped so the image
  // never drifts off-screen — providing a proper constrained zoom experience.
  // A resistance factor of 0.72 is applied during the drag to prevent the
  // "watery" / uncontrolled feel. withDecay on release gives a smooth
  // deceleration that respects the clamp bounds.
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
      // Resistance factor — dampens direct finger tracking so fast swipes
      // feel controlled rather than sliding out of hand.
      const resistance = 0.72;
      const newX = savedTranslateX.value + e.translationX * resistance;
      const newY = savedTranslateY.value + e.translationY * resistance;
      translateX.value = Math.max(-maxX, Math.min(maxX, newX));
      translateY.value = Math.max(-maxY, Math.min(maxY, newY));
    })
    .onEnd((e) => {
      const scale = imageScale.value;
      const maxX = ((scale - 1) * SW) / 2;
      const maxY = ((scale - 1) * SW) / 2;
      // withDecay gives a natural coast-to-stop after the finger lifts.
      // Velocity is halved so it doesn't shoot across the image.
      // clamp keeps the image within valid bounds at all times.
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
        // Zoom toward the tap point
        const targetScale = 2.5;
        imageScale.value = withSpring(targetScale);
        savedScale.value = targetScale;
        // Center on the tapped area, clamped to bounds (SW for both axes)
        const maxX = ((targetScale - 1) * SW) / 2;
        const maxY = ((targetScale - 1) * SW) / 2;
        const tapX = Math.max(-maxX, Math.min(maxX, (SW / 2 - e.x) * (targetScale - 1)));
        const tapY = Math.max(-maxY, Math.min(maxY, (SH / 2 - e.y) * (targetScale - 1)));
        translateX.value = withSpring(tapX);
        translateY.value = withSpring(tapY);
        savedTranslateX.value = tapX;
        savedTranslateY.value = tapY;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onToggleControls)();
    });

  const imageGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
  );

  const videoTapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onToggleControls)();
  });

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
              cachePolicy="disk"
              transition={0}
              priority="high"
              recyclingKey={item.id}
              onLoadStart={() => {
                console.log(`[Viewer] Image LOAD START: ${item.name}`);
                setImageLoaded(false);
              }}
              onLoad={() => {
                console.log(`[Viewer] Image LOAD SUCCESS: ${item.name}`);
                setImageLoaded(true);
              }}
              onError={(e) => {
                console.error(`[Viewer] Image LOAD ERROR for ${item.name}:`, e);
              }}
            />
            {/* Branded skeleton shimmer while the full-res image decodes */}
            {!imageLoaded && <ImageSkeleton />}
          </Reanimated.View>
        </GestureDetector>
      ) : (
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.videoWrap}>
              {/*
                VideoView is mounted when isNearActive (prev/current/next).
                nativeControls={true} → ExoPlayer's built-in seek bar, play/pause,
                duration are shown automatically. The thumbnail overlay above it
                has pointerEvents="none" so all touches fall through to the native
                controls even while the thumbnail is still covering the surface.

                replaceAsync fires after InteractionManager (animation done).
                The thumbnail stays up 200 ms past readyToPlay (isVideoVisible)
                so ExoPlayer has filled its frame pipeline before we reveal.
                player.release() on unmount frees the hardware codec slot.
              */}
              {isNearActive && (
                <VideoView
                  key={item.id}
                  player={player}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  nativeControls={true}
                />
              )}

              {/*
                pointerEvents="none" on the wrapper: thumbnail never blocks touches.
                Native ExoPlayer controls receive all taps even while loading.
                Stays visible until isVideoVisible (200 ms post-readyToPlay).
              */}
              {(!isActive || !isVideoVisible) && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <Image
                    source={{ uri: initialSource }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                    recyclingKey={item.id}
                    videoTimestamp={500}
                  />
                </View>
              )}

              {/* Spinner during buffering — sits above thumbnail, below native controls */}
              {isNearActive && !isVideoReady && (
                <View style={styles.videoSpinnerWrap} pointerEvents="none">
                  <ActivityIndicator
                    color={COLORS.PRIMARY}
                    size="large"
                  />
                </View>
              )}
            </View>
          </View>
      )}
    </View>
  );
}

export default function ViewerScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const params = useLocalSearchParams<{ id: string; isSaved?: string }>();
  const { id, isSaved: isSavedParam } = params;
  
  const insets = useSafeAreaInsets();
  const { 
    statuses, 
    savedItems, 
    saveStatus, 
    shareStatus, 
    isStatusSaved, 
    deleteFromSaved,
    loadStatuses,
    hasPermission,
    onImageSwipe,
    dismissInterstitial,
    showInterstitial,
    prepareStatusForViewing,
  } = useMedia();

  const isSavedView = isSavedParam === '1';
  const prevIdRef = useRef<string | null>(null);

  // Safeguard: Load statuses if they are empty (e.g. on deep link or refresh)
  useEffect(() => {
    if (!isSavedView && statuses.length === 0 && hasPermission) {
      loadStatuses();
    }
  }, [isSavedView, statuses.length, hasPermission, loadStatuses]);

  const items = useMemo(() => {
    if (isSavedView) {
      const startItem = savedItems.find(s => s.id === id || decodeURIComponent(s.id) === id);
      if (!startItem) return savedItems;
      return savedItems.filter(s => s.type === startItem.type);
    }
    
    const startItem = statuses.find(s => s.id === id || decodeURIComponent(s.id) === id);
    
    if (!startItem) {
      return [];
    }
    
    return statuses.filter(s => s.type === startItem.type);
  }, [isSavedView, savedItems, statuses, id]);

  const initialIndex = useMemo(() => {
    const idx = items.findIndex(item => item.id === id || decodeURIComponent(item.id) === id);
    return idx === -1 ? 0 : idx;
  }, [items, id]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const prevIndex = useRef(initialIndex);
  const isScrollingRef = useRef(false);
  
  // Update currentIndex and scroll to it when initialIndex changes
  useEffect(() => {
    if (prevIdRef.current !== id) {
      prevIdRef.current = id;
      if (items.length > 0 && initialIndex >= 0) {
        setCurrentIndex(initialIndex);
        prevIndex.current = initialIndex;
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: initialIndex,
            animated: false,
          });
        }, 50);
      }
    }
  }, [initialIndex, items.length, id]);

  const currentItem = items[currentIndex];

  // Pre-copy the next 2 videos in the background so they are ready before swipe.
  // Images are skipped because expo-image handles content:// URIs efficiently,
  // avoiding the slow 3-second disk I/O copy bottleneck.
  useEffect(() => {
    const next1 = items[currentIndex + 1];
    if (next1 && next1.type === 'video' && next1.uri.startsWith('content://')) {
      prepareStatusForViewing(next1 as StatusItem).catch(() => {});
    }
    const timer = setTimeout(() => {
      const next2 = items[currentIndex + 2];
      if (next2 && next2.type === 'video' && next2.uri.startsWith('content://')) {
        prepareStatusForViewing(next2 as StatusItem).catch(() => {});
      }
    }, 400); // Increased stagger to 400ms to further reduce disk I/O pressure
    return () => clearTimeout(timer);
  }, [currentIndex, items, prepareStatusForViewing]);

  const scrollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSaved = isSavedView || (currentItem && isStatusSaved(currentItem.id));

useEffect(() => {
  setShowControls(true);
  controlsOpacity.setValue(1);
}, [currentIndex, currentItem]);

function animateControls(show: boolean) {
  Animated.timing(controlsOpacity, {
    toValue: show ? 1 : 0,
    duration: 300,
    useNativeDriver: true,
  }).start();
}

const toggleControls = useCallback(() => {
  const next = !showControls;
  setShowControls(next);
  animateControls(next);
}, [showControls, controlsOpacity]);



  const handleSave = useCallback(async () => {
    if (!currentItem || isSaved || isSaving) return;
    setIsSaving(true);
    const success = await saveStatus(currentItem);
    setIsSaving(false);
  }, [currentItem, isSaved, isSaving, saveStatus]);

  const handleShare = useCallback(async () => {
    if (!currentItem) return;
    await shareStatus(currentItem);
  }, [currentItem, shareStatus]);

  const handleDelete = useCallback(async () => {
    if (!isSavedView || !currentItem) return;
    Alert.alert('Delete', 'Remove this status from saved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const savedItem = savedItems.find(s => s.id === currentItem.id);
          if (savedItem) {
            await deleteFromSaved(savedItem);
            if (items.length <= 1) {
              router.back();
            }
          }
        },
      },
    ]);
  }, [isSavedView, currentItem, savedItems, deleteFromSaved, items.length]);

  const onScroll = useCallback((event: any) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SW);
    if (index < 0 || index >= items.length) return;

    // Debounce: skip intermediate scroll positions during fast flicks.
    // 80ms gives the scroll animation time to settle without feeling laggy.
    if (scrollSettleRef.current) clearTimeout(scrollSettleRef.current);
    scrollSettleRef.current = setTimeout(() => {
      setCurrentIndex(index);
      setShowControls(true);
      controlsOpacity.setValue(1);
      if (index !== prevIndex.current) {
        if (items[index]?.type === 'image') {
          onImageSwipe();
        }
        prevIndex.current = index;
      }
    }, 80);
  }, [items, onImageSwipe, controlsOpacity]);

  const onScrollBeginDrag = useCallback(() => {
    isScrollingRef.current = true;
  }, []);

  const onScrollEndDrag = useCallback((event: any) => {
    isScrollingRef.current = false;
    onScroll(event);
  }, [onScroll]);

  if (!currentItem) return null;

  const isVideoItem = currentItem.type === 'video';

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex > 0 ? initialIndex : undefined}
        getItemLayout={(_, index) => ({
          length: SW,
          offset: SW * index,
          index,
        })}
        onMomentumScrollEnd={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ViewerItem
            item={item}
            isActive={index === currentIndex}
            isNearActive={Math.abs(index - currentIndex) <= 1}
            onToggleControls={toggleControls}
            showControls={showControls}
            controlsOpacity={controlsOpacity}
          />
        )}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
        }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={50}
      />

      {/* ── Top bar: back + counter. Always visible for video; toggleable for images ── */}
      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            opacity: isVideoItem ? 1 : controlsOpacity,
            pointerEvents: (isVideoItem || showControls) ? 'auto' : 'none',
            zIndex: 150,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topCounter}>{currentIndex + 1} / {items.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* ── VIDEO: Instagram Reels-style right-side action buttons. Always visible. ── */}
      {isVideoItem && (
        <View style={[styles.reelsSidebar, { bottom: insets.bottom + 100 }]} pointerEvents="box-none">
          {/* Save */}
          {!isSavedView && (
            <TouchableOpacity style={styles.reelsBtn} onPress={handleSave} disabled={isSaved || isSaving}>
              <View style={[styles.reelsCircle, isSaved && { backgroundColor: COLORS.PRIMARY + 'CC' }]}>
                {isSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name={isSaved ? 'checkmark-circle' : 'download-outline'} size={26} color="#fff" />}
              </View>
              <Text style={styles.reelsLabel}>{isSaved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
          )}

          {/* Share */}
          <TouchableOpacity style={styles.reelsBtn} onPress={handleShare}>
            <View style={styles.reelsCircle}>
              <Ionicons name="share-social-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.reelsLabel}>Share</Text>
          </TouchableOpacity>

          {/* WhatsApp */}
          <TouchableOpacity style={styles.reelsBtn} onPress={handleShare}>
            <View style={styles.reelsCircle}>
              <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
            </View>
            <Text style={styles.reelsLabel}>WhatsApp</Text>
          </TouchableOpacity>

          {/* Delete (saved view only) */}
          {isSavedView && (
            <TouchableOpacity style={styles.reelsBtn} onPress={handleDelete}>
              <View style={[styles.reelsCircle, { backgroundColor: COLORS.ERROR + 'CC' }]}>
                <Ionicons name="trash-outline" size={26} color="#fff" />
              </View>
              <Text style={styles.reelsLabel}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── IMAGE: horizontal bottom bar with buttons + banner ad. Toggleable. ── */}
      {!isVideoItem && (
        <Animated.View
          style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, opacity: controlsOpacity, pointerEvents: showControls ? 'auto' : 'none', zIndex: 150 }]}
        >
          <View style={styles.viewerAdContainer}>
            <AdBanner size={BannerAdSize.BANNER} style={{ height: 50 }} />
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isSaved ? COLORS.PRIMARY + '33' : COLORS.PRIMARY }]}
            onPress={handleSave}
            disabled={isSaved || isSaving || isSavedView}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={isSaved ? 'checkmark-circle' : 'download'}
                size={20}
                color={isSaved ? COLORS.PRIMARY : '#fff'}
              />
            )}
            <Text style={[styles.actionText, isSaved && { color: COLORS.PRIMARY }]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.actionText}>WhatsApp</Text>
          </TouchableOpacity>

          {isSavedView && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.ERROR + '22' }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={COLORS.ERROR} />
              <Text style={[styles.actionText, { color: COLORS.ERROR }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      <AdInterstitial
        visible={showInterstitial}
        onClose={dismissInterstitial}
        countdown={5}
      />
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  itemContainer: {
    width: SW,
    height: SH,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SW,
    height: SH,
  },
  videoWrap: {
    width: SW,
    height: SH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: SW,
    height: SH,
  },
  videoSpinnerWrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  skipBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 150,
  },
  progressBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 2,
  },
  progressKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.PRIMARY,
    marginLeft: -7,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    minWidth: 35,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.SM,
  },
  topTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Nunito_600SemiBold',
  },
  topCounter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: SPACING.SM,
    flexWrap: 'wrap',
  },
  viewerAdContainer: {
    width: '100%',
    height: 50,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM + 2,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 80,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  /* ── Instagram Reels-style right-side vertical action buttons (video only) ── */
  reelsSidebar: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 22,
    zIndex: 200,
  },
  reelsBtn: {
    alignItems: 'center',
    gap: 5,
  },
  reelsCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  reelsLabel: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.MD,
  },
  errorText: {
    color: '#fff',
    fontSize: FONT_SIZE.MD,
    fontFamily: 'Nunito_600SemiBold',
  },
});
