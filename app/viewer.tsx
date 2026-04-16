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
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMedia, StatusItem, SavedItem } from '@/contexts/MediaContext';
import COLORS from '@/constants/colors';
import { FONT_SIZE, SPACING, RADIUS } from '@/constants/theme';
import { useEventListener } from 'expo';

import { AdInterstitial } from '@/components/AdInterstitial';
import { AdBanner } from '@/components/AdBanner';
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

function ViewerItem({ item, isActive, isNearActive, onToggleControls, showControls, controlsOpacity }: ViewerItemProps) {
  const { prepareStatusForViewing } = useMedia();
  const [displayUri, setDisplayUri] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const isActiveRef = useRef(isActive);
  const isLoadingSource = useRef(false);
  const isReadyToPlayRef = useRef(false);

  // Reanimated shared values for smooth pinch-to-zoom on images
  const imageScale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // Release the hardware decoder on unmount so the decoder pool isn't exhausted.
  useEffect(() => {
    return () => {
      if (item.type === 'video' && player) {
        try {
          (player as any).replaceAsync?.(null).catch?.(() => {});
        } catch {}
      }
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
  // Key fix: play() is called ONLY after statusChange === 'readyToPlay'.
  // We also flip isVideoReady so the thumbnail overlay disappears exactly
  // when the first decoded frame is available — no more black flash.
  useEventListener(player, 'statusChange', ({ status }: { status: string }) => {
    if (item.type !== 'video') return;
    const ready = status === 'readyToPlay';
    isReadyToPlayRef.current = ready;
    setIsVideoReady(ready);
    if (ready) tryStartPlayback();
  });

  // Reset the "ready" flag whenever the source changes so the thumbnail
  // overlay re-appears while the new file is being decoded.
  useEffect(() => {
    setIsVideoReady(false);
  }, [displayUri]);

  // ── Source loading ───────────────────────────────────────────────────────
  useEffect(() => {
    if (item.type !== 'video' || !player || !displayUri) return;

    let cancelled = false;
    isLoadingSource.current = true;
    isReadyToPlayRef.current = false;

    const load = async () => {
      try {
        await player.replaceAsync(displayUri);
        if (!cancelled) isLoadingSource.current = false;
        tryStartPlayback();
      } catch (e) {
        if (!cancelled) {
          isLoadingSource.current = false;
          console.log('Player load error:', e);
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
        if (item.type === 'video' && player) {
          isReadyToPlayRef.current = false;
          try {
            player.pause();
            (player as any).replaceAsync?.(null).catch?.(() => {});
          } catch {}
        }
      }
      return;
    }

    let isMounted = true;
    async function prepare() {
      try {
        // expo-image reads content:// URIs natively on Android via ContentProvider —
        // no copy needed for images. Only videos need a file:// copy because
        // ExoPlayer requires seekable random access which SAF content:// does not
        // guarantee for large files.
        if (!initialSource.startsWith('content://') || item.type === 'image') {
          if (isMounted) setDisplayUri(initialSource);
          return;
        }
        const prepared = await prepareStatusForViewing(item as StatusItem);
        if (isMounted) setDisplayUri(prepared);
      } catch {
        if (isMounted) setDisplayUri(initialSource);
      }
    }

    if (!displayUri) prepare();
    return () => { isMounted = false; };
  }, [initialSource, item, isNearActive, isActive]);

  const mediaUri = displayUri || initialSource;

  // Reset zoom whenever a different item becomes active
  useEffect(() => {
    imageScale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
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
      }
    });

  // Pan is only activated when zoomed in; otherwise the FlatList scrolls.
  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (imageScale.value > 1) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(200)
    .onEnd(() => {
      if (imageScale.value > 1) {
        imageScale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        imageScale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onToggleControls)();
    });

  // Simultaneous: pinch zoom + pan (when zoomed) + exclusive tap recognition
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
            />
          </Reanimated.View>
        </GestureDetector>
      ) : (
        <GestureDetector gesture={videoTapGesture}>
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.videoWrap}>
              {/*
                VideoView is ALWAYS rendered (never conditionally mounted).
                On Android the SurfaceView must stay attached to the player
                for the entire lifecycle — unmounting it while the decoder is
                active detaches the output surface, so audio plays but the
                screen is black. replaceAsync(null) pauses the player without
                ever tearing down the surface.
              */}
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                nativeControls={false}
                allowsFullscreen={false}
              />

              {/* Thumbnail covers the VideoView until the first frame is ready */}
              {(!isNearActive || !isVideoReady) && (
                <Image
                  source={{ uri: initialSource }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={0}
                  recyclingKey={item.id}
                />
              )}

              {isNearActive && !isVideoReady && (
                <ActivityIndicator
                  color={COLORS.PRIMARY}
                  size="large"
                  style={styles.videoSpinner}
                />
              )}
            </View>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

export default function ViewerScreen() {
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
  
  // Update currentIndex and scroll to it when initialIndex changes (e.g. on first load)
  // Prevent duplicate navigation
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

  // Pre-load the next 2 items in the background so they are in cache before the user swipes.
  // Staggered 200ms apart so two concurrent disk writes don't congest slow storage on budget phones.
  useEffect(() => {
    const next1 = items[currentIndex + 1];
    if (next1 && next1.uri.startsWith('content://')) {
      prepareStatusForViewing(next1 as StatusItem).catch(() => {});
    }
    const timer = setTimeout(() => {
      const next2 = items[currentIndex + 2];
      if (next2 && next2.uri.startsWith('content://')) {
        prepareStatusForViewing(next2 as StatusItem).catch(() => {});
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [currentIndex, items, prepareStatusForViewing]);

  // Debounce ref: used to skip processing intermediate scroll positions during fast flicks.
  const scrollSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSaved = isSavedView || (currentItem && isStatusSaved(currentItem.id));

useEffect(() => {
  // Show controls by default when switching items
  setShowControls(true);
  controlsOpacity.setValue(1);
}, [currentIndex, currentItem]);

function animateControls(show: boolean) {
  // FIXED #5: Properly animate opacity when toggling controls
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

    // Debounce: if the user is flicking fast through multiple pages, skip intermediate
    // positions and only process the final settled index. This prevents the disk I/O
    // "clog" that causes black screens when swiping rapidly.
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
    }, 60);
  }, [items, onImageSwipe, controlsOpacity]);

  const onScrollBeginDrag = useCallback(() => {
    isScrollingRef.current = true;
  }, []);

  const onScrollEndDrag = useCallback((event: any) => {
    isScrollingRef.current = false;
    onScroll(event);
  }, [onScroll]);

  if (!currentItem) return null;

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
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
      />

      <Animated.View
        style={[styles.topBar, { paddingTop: insets.top + 8, opacity: controlsOpacity, pointerEvents: (showControls || (currentItem && currentItem.type === 'image')) ? 'auto' : 'none', zIndex: 150 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topCounter}>{currentIndex + 1} / {items.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

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

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShare()}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          <Text style={styles.actionText}>WhatsApp</Text>
        </TouchableOpacity>

        {isSavedView && (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.ACCENT_RED + '22' }]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={COLORS.ACCENT_RED} />
            <Text style={[styles.actionText, { color: COLORS.ACCENT_RED }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      <AdInterstitial
        visible={showInterstitial}
        onClose={dismissInterstitial}
        countdown={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  videoSpinner: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -18,
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