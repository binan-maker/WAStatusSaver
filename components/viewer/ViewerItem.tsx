import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  InteractionManager,
  Text,
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
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useMedia, StatusItem, SavedItem } from '@/contexts/MediaContext';
import { useThemeColors } from '@/contexts/ThemeContext';
import { createStyles, SW, SH } from './viewerStyles';

const VIEWER_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

// ── GLOBAL: Only ONE video player instance across all ViewerItems ─────────────
// When user scrolls: previous video COMPLETELY STOPS, new video ONLY loads.
// This prevents device processor overload and freeze.
let globalActiveVideoId: string | null = null;
let globalActivePlayer: any = null;

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

  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const isLoadingSource = useRef(false);
  const isReadyToPlayRef = useRef(false);
  const lastReplacedSourceRef = useRef<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRevealedOnceRef = useRef(false);
  const playToEndListenerRef = useRef<{ remove: () => void } | null>(null);
  const prepareTaskRef = useRef<any>(null);

  // ── THIS ITEM'S PLAYER: Created once per component instance ────────────────
  const playerRef = useRef<any>(null);
  if (!playerRef.current) {
    playerRef.current = new (require('expo-video').VideoPlayer)(null);
    playerRef.current.loop = false;
    playerRef.current.muted = true;
    if (Platform.OS === 'android') {
      playerRef.current.staysActiveInBackground = false;
    }
  }
  const player = playerRef.current;

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const scheduleReveal = useCallback((delayMs: number) => {
    clearRevealTimer();
    revealTimerRef.current = setTimeout(() => {
      hasRevealedOnceRef.current = true;
      setIsVideoVisible(true);
    }, delayMs);
  }, [clearRevealTimer]);

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id, item.uri]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRITICAL: Only set this as GLOBAL ACTIVE when isActive ─────────────────
  useEffect(() => {
    if (isActive && item.type === 'video') {
      // Only this video should be active
      globalActiveVideoId = item.id;
      globalActivePlayer = player;
    } else if (globalActiveVideoId === item.id) {
      // This was the active one, but now it's not → completely stop it
      globalActiveVideoId = null;
      globalActivePlayer = null;
    }
  }, [isActive, item.id, item.type, player]);

  useEffect(() => {
    return () => {
      try {
        if (prepareTaskRef.current?.cancel) prepareTaskRef.current.cancel();
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
        playToEndListenerRef.current?.remove();
        player.release();
      } catch {}
    };
  }, [player]);

  const tryStartPlayback = useCallback(() => {
    if (
      item.type !== 'video' ||
      !displayUri ||
      !isReadyToPlayRef.current ||
      !isActiveRef.current
    )
      return;
    try {
      player.muted = false;
      player.play();
    } catch {}
  }, [displayUri, item.type, player]);

  const tryStartPlaybackRef = useRef(tryStartPlayback);
  const scheduleRevealRef = useRef(scheduleReveal);
  const clearRevealTimerRef = useRef(clearRevealTimer);
  useEffect(() => {
    tryStartPlaybackRef.current = tryStartPlayback;
  });
  useEffect(() => {
    scheduleRevealRef.current = scheduleReveal;
  });
  useEffect(() => {
    clearRevealTimerRef.current = clearRevealTimer;
  });

  // Status listener
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!player || typeof player.addListener !== 'function') return;
    let sub: { remove: () => void } | null = null;
    try {
      sub = player.addListener('statusChange', ({ status }: { status: string }) => {
        const ready = status === 'readyToPlay';
        isReadyToPlayRef.current = ready;

        if (ready) {
          setIsVideoReady(true);
          tryStartPlaybackRef.current();
          if (!hasRevealedOnceRef.current) {
            scheduleRevealRef.current(80);
          }
        } else {
          if (!hasRevealedOnceRef.current) {
            setIsVideoReady(false);
            setIsVideoVisible(false);
            clearRevealTimerRef.current();
          }
        }
      });
    } catch {}
    return () => {
      try {
        sub?.remove();
      } catch {}
    };
  }, [player, item.type, item.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset on source change
  useEffect(() => {
    setIsVideoReady(false);
    setIsVideoVisible(false);
    setPrepareError(null);
    hasRevealedOnceRef.current = false;
    clearRevealTimer();
  }, [displayUri]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    lastReplacedSourceRef.current = null;
  }, [item.id]);

  useEffect(() => {
    setIsVideoReady(false);
    setIsVideoVisible(false);
    setIsPreparing(false);
    setPrepareError(null);
    hasRevealedOnceRef.current = false;
    lastReplacedSourceRef.current = null;
    if (prepareTaskRef.current?.cancel) prepareTaskRef.current.cancel();
  }, [item.id]);

  // Loop on end
  useEffect(() => {
    if (
      item.type !== 'video' ||
      !player ||
      typeof player.addListener !== 'function'
    )
      return;

    try {
      playToEndListenerRef.current?.remove();
      playToEndListenerRef.current = player.addListener('playToEnd', () => {
        if (!isActiveRef.current) return;
        try {
          (player as any).currentTime = 0;
          player.play();
        } catch {}
      });
    } catch {}

    return () => {
      try {
        playToEndListenerRef.current?.remove();
      } catch {}
    };
  }, [player, item.type, item.name, item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load into player
  useEffect(() => {
    if (item.type !== 'video' || !player || !displayUri || !isActive) return;
    if (lastReplacedSourceRef.current === displayUri) return;

    let cancelled = false;
    isLoadingSource.current = true;
    isReadyToPlayRef.current = false;

    const load = async () => {
      try {
        const isLocal = displayUri.startsWith('file://');
        if (!isLocal) {
          await Promise.race([
            new Promise<void>(r => InteractionManager.runAfterInteractions(r)),
            new Promise<void>(r => setTimeout(r, 120)),
          ]);
          if (cancelled) return;
        }
        lastReplacedSourceRef.current = displayUri;
        await player.replaceAsync(displayUri);
        if (!cancelled) isLoadingSource.current = false;
      } catch {
        if (!cancelled) isLoadingSource.current = false;
      }
    };

    load();
    return () => {
      cancelled = true;
      isLoadingSource.current = false;
      isReadyToPlayRef.current = false;
    };
  }, [displayUri, item.type, player, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      clearRevealTimer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show when ready
  useEffect(() => {
    if (item.type !== 'video') return;
    if (isActive && isVideoReady && !isVideoVisible) {
      scheduleRevealRef.current(80);
    }
  }, [isActive, isVideoReady, isVideoVisible, item.type]);

  // Hide when inactive
  useEffect(() => {
    if (item.type !== 'video') return;
    if (!isActive) {
      setIsVideoVisible(false);
      clearRevealTimerRef.current();
    }
  }, [isActive, item.type]);

  // Pause/stop when inactive
  useEffect(() => {
    if (item.type !== 'video' || !player || isLoadingSource.current) return;
    try {
      if (isActive) {
        // Only play if this is the global active video
        if (globalActiveVideoId === item.id) {
          tryStartPlaybackRef.current();
        }
      } else {
        // COMPLETELY STOP this video when scrolled away
        player.muted = true;
        player.pause();
        isReadyToPlayRef.current = false;
        setIsVideoReady(false);
      }
    } catch {}
  }, [isActive, item.id, player, item.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── URI PREPARATION: Only for active videos ──────────────────────────────────
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        setDisplayUri(null);
        setIsVideoReady(false);
        setIsPreparing(false);
        setPrepareError(null);
        if (item.type === 'video' && player) {
          isReadyToPlayRef.current = false;
          try {
            player.pause();
          } catch {}
        }
      }
      return;
    }

    if (displayUri) return;

    let cancelled = false;

    // Only prepare videos that are ACTIVE (only one at a time)
    if (item.type === 'video' && isActive) {
      setIsPreparing(true);
      setPrepareError(null);

      // Cancel previous prepare task
      if (prepareTaskRef.current?.cancel) prepareTaskRef.current.cancel();

      prepareTaskRef.current = InteractionManager.runAfterInteractions(async () => {
        try {
          if (cancelled || !isActiveRef.current) return;

          const preparePromise = prepareStatusForViewing(item as StatusItem, {
            forPlayback: true,
          });

          // 10 second timeout for SAF copy
          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(
              () => reject(new Error('Video preparation timeout (10s)')),
              10000
            )
          );

          const prepared = await Promise.race([preparePromise, timeoutPromise]);

          if (!cancelled && isActiveRef.current) {
            setDisplayUri(prepared);
            setIsPreparing(false);
          }
        } catch (err) {
          if (!cancelled && isActiveRef.current) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            setPrepareError(errMsg);
            setIsPreparing(false);
            // Fallback to original URI (will play from SAF directly)
            setDisplayUri(initialSource);
          }
        }
      });

      return () => {
        cancelled = true;
        if (prepareTaskRef.current?.cancel) prepareTaskRef.current.cancel();
      };
    } else {
      // Images: instant
      setDisplayUri(initialSource);
    }

    return () => {
      cancelled = true;
    };
  }, [initialSource, item, isNearActive, isActive, player, prepareStatusForViewing]); // eslint-disable-line react-hooks/exhaustive-deps

  const mediaUri = displayUri || initialSource;

  // Pinch-to-zoom for images
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
    .onUpdate(e => {
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
    .onUpdate(e => {
      const scale = imageScale.value;
      const maxX = ((scale - 1) * SW) / 2;
      const maxY = ((scale - 1) * SW) / 2;
      const newX = savedTranslateX.value + e.translationX * 0.72;
      const newY = savedTranslateY.value + e.translationY * 0.72;
      translateX.value = Math.max(-maxX, Math.min(maxX, newX));
      translateY.value = Math.max(-maxY, Math.min(maxY, newY));
    })
    .onEnd(e => {
      const scale = imageScale.value;
      const maxX = ((scale - 1) * SW) / 2;
      const maxY = ((scale - 1) * SW) / 2;
      translateX.value = withDecay(
        {
          velocity: e.velocityX * 0.5,
          deceleration: 0.92,
          clamp: [-maxX, maxX],
        },
        () => {
          savedTranslateX.value = translateX.value;
        }
      );
      translateY.value = withDecay(
        {
          velocity: e.velocityY * 0.5,
          deceleration: 0.92,
          clamp: [-maxY, maxY],
        },
        () => {
          savedTranslateY.value = translateY.value;
        }
      );
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(200)
    .onEnd(e => {
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
    .onEnd(() => {
      runOnJS(onToggleControls)();
    });

  const imageGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture)
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
            {isActive && displayUri && (
              <VideoView
                key={item.id}
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls={false}
                fullscreenOptions={{ showFullscreenButton: false }}
              />
            )}

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
                {isActive && !isVideoReady && !isPreparing && (
                  <View style={styles.videoPlayBadge} pointerEvents="none">
                    <View style={styles.videoPlayBadgeInner}>
                      <Ionicons name="play" size={28} color="#fff" />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Spinner while preparing */}
            {isPreparing && (
              <View style={styles.videoSpinnerWrap} pointerEvents="none">
                <ActivityIndicator color="#fff" size="large" />
                <Text style={{ color: '#fff', marginTop: 12, fontSize: 12 }}>
                  Loading video...
                </Text>
              </View>
            )}

            {/* Error message */}
            {prepareError && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                  },
                ]}
                pointerEvents="none"
              >
                <Text
                  style={{
                    color: '#ff6b6b',
                    fontSize: 12,
                    textAlign: 'center',
                    paddingHorizontal: 20,
                  }}
                >
                  {prepareError}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
