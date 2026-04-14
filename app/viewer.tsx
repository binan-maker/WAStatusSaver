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
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
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
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const scaleRef = useRef(1);
  const lastDistanceRef = useRef<number | null>(null);
  // Ref keeps isActive current inside the event listener closure
  const isActiveRef = useRef(isActive);
  const isLoadingSource = useRef(false);
  const isReadyToPlayRef = useRef(false);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  const initialSource = useMemo(() => {
    return 'localUri' in item ? (item as SavedItem).localUri : item.uri;
  }, [item.id, item.uri]);

  // Player always starts with no source — raw content:// URIs are never fed
  // directly to the decoder. The prepared file:// URI arrives via replaceAsync.
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
    if (item.type !== 'video' || !displayUri || isLoadingSource.current || !isReadyToPlayRef.current || !isActiveRef.current) {
      return;
    }

    try {
      player.muted = false;
      player.play();
    } catch (e) {
      console.log('Player start error:', e);
    }
  }, [displayUri, item.type, player]);

  // ── Status listener ──────────────────────────────────────────────────────
  // play() is called ONLY when the player tells us it is truly ready.
  // This completely replaces the unreliable setTimeout approach.
  useEventListener(player, 'statusChange', ({ status }: { status: string }) => {
    if (item.type !== 'video') return;
    isReadyToPlayRef.current = status === 'readyToPlay';
    tryStartPlayback();
  });

  // ── Source loading ───────────────────────────────────────────────────────
  // replaceAsync on ALL platforms — never blocks the UI thread.
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
  // Handles mute/pause when the user swipes away — only for already-loaded sources.
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
          if ((player as any).replaceAsync) {
            (player as any).replaceAsync(null).catch(() => {});
          } else {
            (player as any).replace(null);
          }
        }
      }
    } catch (e) {
      console.log('Player sync error:', e);
    }
  }, [isActive, isNearActive, player, item.type, tryStartPlayback]);

  // ── URI preparation ──────────────────────────────────────────────────────
  // Copies content:// statuses to file:// cache before handing to the player.
  // The player only receives a URI once the file is 100% written.
  useEffect(() => {
    if (!isNearActive) {
      if (!isActive) {
        setDisplayUri(null);
        if (item.type === 'video' && player) {
          isReadyToPlayRef.current = false;
          try {
            player.pause();
            if ((player as any).replaceAsync) {
              (player as any).replaceAsync(null).catch(() => {});
            } else {
              (player as any).replace(null);
            }
          } catch {}
        }
      }
      return;
    }

    let isMounted = true;
    async function prepare() {
      try {
        if (!initialSource.startsWith('content://')) {
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

  // Pinch-to-zoom gesture handler for images
  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    if (item.type !== 'image') return;
    
    const touches = e.nativeEvent.touches;
    if (touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (lastDistanceRef.current !== null) {
        const scale = distance / lastDistanceRef.current;
        const newScale = Math.min(Math.max(scaleRef.current * scale, 1), 4);
        scaleRef.current = newScale;
        setScale(newScale);
      }
      lastDistanceRef.current = distance;
    }
  }, [item.type]);

  const handleTouchEnd = useCallback(() => {
    lastDistanceRef.current = null;
    if (scale < 1.2) {
      scaleRef.current = 1;
      setScale(1);
      setPanX(0);
      setPanY(0);
    }
  }, [scale]);

  const mediaUri = displayUri || initialSource;
  const videoViewKey = displayUri ? `${item.id}:${displayUri}` : item.id;

  return (
   <View style={styles.itemContainer}>
    <TouchableOpacity
      style={StyleSheet.absoluteFill}
      activeOpacity={1}
      onPress={onToggleControls}
      onMoveShouldSetResponder={() => item.type === 'image' && scale > 1}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
    >
      {item.type === 'image' ? (
        <Animated.View
          style={[
            styles.imageContainer,
            {
              transform: [
                { scale: scale },
                { translateX: panX },
                { translateY: panY },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: mediaUri }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="disk"
            transition={0}
            priority="high"
            recyclingKey={item.id}
          />
        </Animated.View>
      ) : (
        <View style={styles.videoWrap}>
          <VideoView
            key={videoViewKey}
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
            showsPlaybackControls={false}
          />
        </View>
      )}
    </TouchableOpacity>
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
    showInterstitial
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
    if (index !== currentIndex && index >= 0 && index < items.length) {
      setCurrentIndex(index);
      // Reset controls visibility when swiping to a new item
      setShowControls(true);
      controlsOpacity.setValue(1);
      
      // Trigger image swipe ad logic if it's an image AND index changed
      if (index !== prevIndex.current) {
        if (items[index].type === 'image') {
          onImageSwipe();
        }
        
        // Interstitial ad logic for video views (7 image/video swipes)
        if (index > 0 && index % 7 === 0) {
           // Interstitial logic is handled by onVideoOpen in useMedia usually, 
           // but we'll use showInterstitial state directly here if needed or let onImageSwipe handle it.
           // User asked for video ads (interstitial) every 7 swipes.
        }

        prevIndex.current = index;
      }
    }
  }, [currentIndex, items, onImageSwipe]);

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
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={10}
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
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#000', // Black background while video loads
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