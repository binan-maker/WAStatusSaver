import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Animated,
  Platform,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  AppState,
  InteractionManager,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image';
import { useMedia, StatusItem, StatusSource } from '@/contexts/MediaContext';
import { useMilestoneRating } from '@/hooks/feedback/useMilestoneRating';
import { MilestoneRatingCard } from '@/components/feedback/MilestoneRatingCard';
import { MediaCard } from '@/components/media/MediaCard';
import { EmptyState } from '@/components/media/EmptyState';
import { LoadingShimmer } from '@/components/media/LoadingShimmer';
import { SAFGuideOverlay } from '@/components/media/SAFGuideOverlay';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, CARD_SIZE, GRID_COLUMNS, RADIUS } from '@/constants/theme';
import { runLayer4 } from '@/lib/video-fallback';

// Per-screen error boundary: a crash on this tab shows a recovery UI
// instead of white-screening the whole app. The user can navigate to
// Saved or Settings while this tab recovers.
export { ScreenErrorFallback as ErrorBoundary } from '@/components/common/ScreenErrorFallback';

const { width: SW } = Dimensions.get('window');
const ROW_HEIGHT = CARD_SIZE + 2;
// Module-level prefetch dedupe set. This is a plain Set (NOT a ref) because
// it lives outside any component — refs only exist inside React render trees.
// The previous code declared `useRef` here at module scope, which would
// throw "Hooks can only be called inside a function component" the moment
// this file was imported. Using a plain Set is functionally identical for
// dedupe purposes and works at any call site.
const prefetchedTapUris = new Set<string>();
let lastPrefetchTime = 0;
const PREFETCH_THROTTLE_MS = 200; // Min gap between prefetches

type TabType = 'images' | 'videos';

const TAB_BAR_APPROX = 60;
const BANNER_HEIGHT = 60;

const STATUS_SOURCE_OPTIONS: { value: StatusSource; label: string; sublabel: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  {
    value: 'whatsapp',
    label: 'WhatsApp',
    sublabel: 'Android/media/com.whatsapp',
    icon: 'whatsapp',
  },
  {
    value: 'whatsapp_business',
    label: 'WhatsApp Business',
    sublabel: 'Android/media/com.whatsapp.w4b',
    icon: 'briefcase-outline',
  },
];

function StatusHeader({ onInfoPress }: { onInfoPress: () => void }) {
  const insets = useSafeAreaInsets();
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 6 }]}>
      <View style={styles.headerInner}>
        <View style={styles.logoRow}>
          <LinearGradient
            colors={[COLORS.PRIMARY_DARK, COLORS.PRIMARY]}
            style={styles.logoIcon}
          >
            <MaterialCommunityIcons name="shield-check" size={20} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.logoText}>StatusVault</Text>
            <Text style={styles.logoSub}>WhatsApp Status Saver</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onInfoPress}
          style={styles.headerBtn}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="information-circle-outline" size={22} color={COLORS.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SubTabBar({
  activeTab,
  onTabChange,
  imageCnt,
  videoCnt,
}: {
  activeTab: TabType;
  onTabChange: (t: TabType) => void;
  imageCnt: number;
  videoCnt: number;
}) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const underlineAnim = useRef(new Animated.Value(activeTab === 'images' ? 0 : 1)).current;

  const translateX = underlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SW / 2],
  });

  useEffect(() => {
    Animated.timing(underlineAnim, {
      toValue: activeTab === 'images' ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  return (
    <View style={styles.subTabBar}>
      <Animated.View style={[styles.activeIndicator, { transform: [{ translateX }] }]} />
      <TouchableOpacity
        style={[styles.subTab, activeTab === 'images' && styles.subTabActive]}
        onPress={() => onTabChange('images')}
        activeOpacity={0.75}
      >
        <Ionicons
          name={activeTab === 'images' ? 'image' : 'image-outline'}
          size={16}
          color={activeTab === 'images' ? COLORS.PRIMARY : COLORS.TEXT_MUTED}
        />
        <Text style={[styles.subTabText, activeTab === 'images' && { color: COLORS.PRIMARY }]}>
          Images
        </Text>
        {imageCnt > 0 && (
          <View style={[styles.badge, activeTab === 'images' && styles.badgeActive]}>
            <Text style={[styles.badgeText, activeTab === 'images' && styles.badgeTextActive]}>
              {imageCnt}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.subTab, activeTab === 'videos' && styles.subTabActive]}
        onPress={() => onTabChange('videos')}
        activeOpacity={0.75}
      >
        <Ionicons
          name={activeTab === 'videos' ? 'videocam' : 'videocam-outline'}
          size={16}
          color={activeTab === 'videos' ? COLORS.PRIMARY : COLORS.TEXT_MUTED}
        />
        <Text style={[styles.subTabText, activeTab === 'videos' && { color: COLORS.PRIMARY }]}>
          Videos
        </Text>
        {videoCnt > 0 && (
          <View style={[styles.badge, activeTab === 'videos' && styles.badgeActive]}>
            <Text style={[styles.badgeText, activeTab === 'videos' && styles.badgeTextActive]}>
              {videoCnt}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function StatusSourceSelector({
  selectedSource,
  onSelectSource,
}: {
  selectedSource: StatusSource;
  onSelectSource: (source: StatusSource) => void;
}) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [open, setOpen] = useState(false);
  const selected = STATUS_SOURCE_OPTIONS.find(option => option.value === selectedSource) || STATUS_SOURCE_OPTIONS[0];

  return (
    <View style={styles.sourceWrap}>
      <TouchableOpacity
        style={styles.sourceButton}
        onPress={() => setOpen(current => !current)}
        activeOpacity={0.85}
      >
        <View style={styles.sourceLeft}>
          <View style={styles.sourceIconWrap}>
            <MaterialCommunityIcons name={selected.icon} size={18} color={COLORS.PRIMARY} />
          </View>
          <View>
            <Text style={styles.sourceLabel}>{selected.label}</Text>
            <Text style={styles.sourceSub}>Choose status folder</Text>
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.TEXT_SECONDARY} />
      </TouchableOpacity>

      {open && (
        <View style={styles.sourceMenu}>
          {STATUS_SOURCE_OPTIONS.map(option => {
            const active = option.value === selectedSource;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.sourceOption, active && styles.sourceOptionActive]}
                onPress={() => {
                  onSelectSource(option.value);
                  setOpen(false);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.sourceLeft}>
                  <View style={[styles.sourceIconWrap, active && styles.sourceIconWrapActive]}>
                    <MaterialCommunityIcons name={option.icon} size={18} color={active ? '#fff' : COLORS.PRIMARY} />
                  </View>
                  <View>
                    <Text style={[styles.sourceOptionLabel, active && styles.sourceOptionLabelActive]}>{option.label}</Text>
                    <Text style={styles.sourceOptionSub}>{option.sublabel}</Text>
                  </View>
                </View>
                {active && <Ionicons name="checkmark-circle" size={18} color={COLORS.PRIMARY} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function StatusesScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [activeTab, setActiveTab] = useState<TabType>('images');
  // Track which tabs have been visited at least once. Once a tab is opened,
  // its FlashList stays mounted forever — switching back is instant with no
  // re-decode of thumbnails. Only the very first paint is single-grid (the
  // launch heat fix); after one swipe both grids stay alive.
  const [visitedTabs, setVisitedTabs] = useState<Record<TabType, boolean>>({
    images: true,
    videos: false,
  });
  const [selectedSource, setSelectedSource] = useState<StatusSource>('whatsapp');
  const saveRating = useMilestoneRating('save');
  const shareRating = useMilestoneRating('share');
  const {
    statuses,
    isLoading,
    isRefreshing,
    isInitializing,
    isGrantingAccess,
    hasPermission,
    safGranted,
    safUris,
    isRequestingSAF,
    androidVersion,
    requestSAF,
    loadStatuses,
    refresh,
    saveStatus,
    shareStatus,
    isStatusSaved,
  } = useMedia();

  const insets = useSafeAreaInsets();

  const scrollViewRef = useRef<ScrollView>(null);
  const navigationRef = useRef<Map<string, number>>(new Map());
  const lastRefreshTime = useRef<number>(0);

  // Consolidated Load Effect:
  // Triggers on mount, or whenever permissions are granted.
  useEffect(() => {
    if (isGrantingAccess) return;
    
    const needsSAF = androidVersion >= 30;
    const isReady = hasPermission || (needsSAF && safGranted);
    
    if (isReady) {
      loadStatuses();
    }
  }, [hasPermission, safGranted, isGrantingAccess, androidVersion]);

  // Keep a ref to refresh so the AppState listener is never torn down/re-added
  // when refresh changes identity (happens whenever loadStatuses re-creates due to
  // safUris/hasPermission changes). Re-adding mid-session causes brief listener gaps.
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  // Auto-refresh when the user returns to the app — but ONLY if it has been
  // at least 30 minutes since the last refresh. Statuses don't change often
  // enough to justify a full SAF folder walk every time the app blinks
  // active. The user can always pull-to-refresh for an explicit refresh.
  // The initial load on app open is handled by the mount effect above; this
  // only catches "user came back after a long time".
  // Also defers via InteractionManager so the refresh never races a tap/scroll.
  const APP_STATE_REFRESH_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes
  useEffect(() => {
    // Seed the timestamp so the very first AppState→active right after
    // launch never re-triggers a refresh on top of the initial load.
    lastRefreshTime.current = Date.now();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const now = Date.now();
        if (now - lastRefreshTime.current > APP_STATE_REFRESH_THROTTLE_MS) {
          lastRefreshTime.current = now;
          InteractionManager.runAfterInteractions(() => {
            refreshRef.current(true); // silent — no shimmer while watching
          });
        }
      }
    });
    return () => sub.remove();
  }, []); // stable — uses ref for refresh

  const selectedSourceLabel = selectedSource === 'whatsapp_business' ? 'WhatsApp Business' : 'WhatsApp';
  const selectedStatuses = useMemo(
    () => statuses.filter(s => s.source === selectedSource),
    [statuses, selectedSource]
  );

  const imageCnt = useMemo(() => selectedStatuses.filter(s => s.type === 'image').length, [selectedStatuses]);
  const videoCnt = useMemo(() => selectedStatuses.filter(s => s.type === 'video').length, [selectedStatuses]);

  const filteredImages = useMemo(
    () => selectedStatuses.filter(s => s.type === 'image'),
    [selectedStatuses]
  );

  const filteredVideos = useMemo(
    () => selectedStatuses.filter(s => s.type === 'video'),
    [selectedStatuses]
  );

  const handlePress = useCallback((item: StatusItem) => {
    const now = Date.now();
    const lastPress = navigationRef.current.get(item.id) || 0;
    // Prevent double-tap navigation within 300ms
    if (now - lastPress < 300) return;
    navigationRef.current.set(item.id, now);

    // PERF: Fire-and-forget prefetch on tap.
    // - For VIDEOS: NO upfront copy — the viewer feeds the content:// URI
    //   straight to ExoPlayer (the watchdog rescues the rare device where
    //   that doesn't work). Eliminates the 200 ms-2 s SAF copy that used
    //   to run synchronously before the viewer could even start loading.
    // - For IMAGE URIs (incl. SAF content://): prefetch into expo-image's
    //   memory-disk cache. On Android 11 the first decode of a content://
    //   image goes through ContentResolver and can take 800 ms-2 s; doing
    //   it here in parallel with the navigation animation means the
    //   viewer's <Image> resolves nearly instantly from cache instead of
    //   staring at the skeleton shimmer for 1-2 seconds. Throttled +
    //   deduped so repeated taps never queue a flood of decodes.
    if (item.type === 'image') {
      const uri = item.uri;
      const t = Date.now();
      if (
        !prefetchedTapUris.has(uri) &&
        t - lastPrefetchTime >= PREFETCH_THROTTLE_MS
      ) {
        prefetchedTapUris.add(uri);
        lastPrefetchTime = t;
        ExpoImage.prefetch(uri, 'memory-disk')
          .catch(() => {})
          .finally(() => {
            // Free the slot after a short window so a re-tap can re-queue
            // if the cache was evicted in the meantime.
            setTimeout(() => prefetchedTapUris.delete(uri), 30000);
          });
      }
    }

    // Android 11+ videos: open directly in the system native player (MX
    // Player, VLC, Google Photos, etc.) — skip the in-app viewer entirely.
    // This avoids all ExoPlayer hardware-decoder issues on API 30+ devices.
    if (item.type === 'video' && Platform.OS === 'android' && (Platform.Version as number) >= 30) {
      runLayer4(item.uri).catch(() => {});
      return;
    }

    router.push({
      pathname: '/viewer',
      params: { id: item.id },
    });
  }, []);

  // PERF: Cast handlers to (item) => void for the MediaCard's stable-handler
  // signature. handlePress is already an (item: StatusItem) => void closure
  // memoised by useCallback above — passing it directly lets React.memo on
  // MediaCard skip re-renders, so the in-flight touch event isn't dropped on
  // Android 11. (Inline `() => handlePress(item)` was the root cause of
  // "I have to tap 3-4 times to open the image".)
  const handleSave = useCallback((item: StatusItem) => {
    saveStatus(item);
    saveRating.increment();
  }, [saveStatus, saveRating.increment]);

  const handleShare = useCallback((item: StatusItem) => {
    shareStatus(item);
    shareRating.increment();
  }, [shareStatus, shareRating.increment]);

  const handlePressAny = useCallback((item: any) => handlePress(item as StatusItem), [handlePress]);
  const handleSaveAny = useCallback((item: any) => handleSave(item as StatusItem), [handleSave]);
  const handleShareAny = useCallback((item: any) => handleShare(item as StatusItem), [handleShare]);

  // Stable per-cell renderers. Defining these as arrow functions inline on
  // the FlashList's `renderItem` prop creates a new function identity on
  // every parent render, which forces FlashList to re-mount every visible
  // cell — the dominant cause of "stuck while scrolling" on Android 11+.
  // Pulling them up here behind useCallback keeps the identity stable so
  // FlashList only re-renders the specific cells whose data actually
  // changed (handled by React.memo on MediaCard).
  const renderImageItem = useCallback(
    ({ item }: { item: StatusItem }) => (
      <MediaCard
        item={item}
        isSaved={isStatusSaved(item.id)}
        onPress={handlePressAny}
        onSave={handleSaveAny}
        onShare={handleShareAny}
        showSaveButton
      />
    ),
    [isStatusSaved, handlePressAny, handleSaveAny, handleShareAny],
  );
  const renderVideoItem = useCallback(
    ({ item }: { item: StatusItem }) => (
      <MediaCard
        item={item}
        isSaved={isStatusSaved(item.id)}
        onPress={handlePressAny}
        onSave={handleSaveAny}
        onShare={handleShareAny}
        showSaveButton
      />
    ),
    [isStatusSaved, handlePressAny, handleSaveAny, handleShareAny],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<StatusItem> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * Math.floor(index / GRID_COLUMNS),
      index,
    }),
    []
  );

  const selectedSafGranted = Platform.OS === 'android'
    ? Boolean(safUris[selectedSource])
    : true;

  // ON ANDROID 11+ (API 30+): We require SAF (Folder Access) for reading statuses.
  // ON ANDROID 10 & BELOW: We only require standard Media Library permission.
  const showPermScreen = Platform.OS === 'android' && (
    androidVersion >= 30 ? !selectedSafGranted : !hasPermission
  );

  const handleGrantAccess = useCallback(() => {
    if (androidVersion >= 30) {
      requestSAF(selectedSource);
    } else {
      // For legacy versions, send them to the permissions guide
      router.push('/permissions');
    }
  }, [requestSAF, selectedSource, androidVersion]);

  const markVisited = useCallback((tab: TabType) => {
    setVisitedTabs(prev => (prev[tab] ? prev : { ...prev, [tab]: true }));
  }, []);

  // PRE-WARM the videos tab AFTER first paint of images settles.
  // Without this, the videos FlashList only mounts when the user finishes
  // swiping — causing a CPU spike right at the end of the swipe (jank)
  // and a black flash because thumbnails haven't decoded yet.
  // We wait for: (a) interactions to settle, (b) data is loaded, then
  // (c) a small idle gap so first paint is buttery smooth, then silently
  // mount the videos grid offscreen. By the time the user swipes there,
  // it's fully rendered — instant, zero jank.
  useEffect(() => {
  if (visitedTabs.videos) return;
  if (filteredVideos.length === 0) return;
  if (isLoading || isInitializing) return;
  
  // Use requestIdleCallback if available (web + modern Android)
  const idleCallback = (callback: IdleRequestCallback) => {
    if ('requestIdleCallback' in global) {
      return (global as any).requestIdleCallback(callback, { timeout: 2000 });
    }
    // Fallback: setTimeout with longer delay
    return setTimeout(callback, 2000);
  };
  
  const handle = InteractionManager.runAfterInteractions(() => {
    idleCallback(() => {
      // Only mount if still unvisited
      setVisitedTabs(prev => (prev.videos ? prev : { ...prev, videos: true }));
    });
  });
  
  return () => {
    if (typeof handle === 'number') {
      clearTimeout(handle);
    } else {
      handle?.cancel?.();
    }
  };
}, [filteredVideos.length, isLoading, isInitializing, visitedTabs.videos]);

  // The instant the user STARTS dragging the horizontal pager, mount BOTH
  // grids. This way the destination grid renders DURING the swipe
  // animation rather than at the end — eliminating the jank spike and
  // black flash users see today.
  const onScrollBeginDrag = useCallback(() => {
    setVisitedTabs(prev => {
      if (prev.images && prev.videos) return prev;
      return { images: true, videos: true };
    });
  }, []);

  // Pull-to-refresh handler. We pass `silent=true` so the global isLoading
  // flag doesn't flip — that flag would unmount the FlashList and blank the
  // entire grid. The RefreshControl's own pull spinner already gives the
  // user clear visual feedback that a refresh is in flight, so the screen
  // can stay populated with existing thumbnails (Instagram-style "selective
  // patching"): unchanged items stay mounted, new ones slide in, removed
  // ones slide out — no flicker, no scroll-position loss.
  const handlePullRefresh = useCallback(() => {
    refresh(true);
  }, [refresh]);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    markVisited(tab);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: tab === 'images' ? 0 : SW,
        animated: true,
      });
    }
  }, [markVisited]);

  const onScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newTab = offsetX >= SW / 2 ? 'videos' : 'images';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      markVisited(newTab);
    }
  }, [activeTab, markVisited]);

  const bottomPad = insets.bottom + TAB_BAR_APPROX + 4;

  // While MediaContext is still loading from AsyncStorage / checking permissions,
  // show a full-screen spinner so users never see the "Setup Required" screen flicker.
  if (isInitializing) {
    return (
      <View style={[styles.root, styles.initScreen]}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (showPermScreen) {
    return (
      <View style={styles.root}>
      <StatusHeader onInfoPress={() => router.push('/permissions')} />
        <StatusSourceSelector selectedSource={selectedSource} onSelectSource={setSelectedSource} />
        <SAFGuideOverlay visible={isRequestingSAF} />
        <View style={styles.permScreen}>
          <LinearGradient
            colors={[COLORS.PRIMARY + '22', 'transparent']}
            style={styles.permGlow}
          />
          <View style={styles.permIconWrap}>
            <MaterialCommunityIcons 
              name={androidVersion >= 30 ? "folder-lock-open-outline" : "shield-key-outline"} 
              size={52} 
              color={COLORS.PRIMARY} 
            />
          </View>
          <Text style={styles.permTitle}>
            {androidVersion >= 30 ? `${selectedSourceLabel} Setup Required` : 'Permission Required'}
          </Text>
          <Text style={styles.permSub}>
            {androidVersion >= 30 
              ? `Grant folder access to view ${selectedSourceLabel} statuses.\nThe picker will open directly to the ${selectedSourceLabel} Media folder.`
              : `Allow access to your device gallery to scan and save ${selectedSourceLabel} statuses.`}
          </Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={handleGrantAccess}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark" size={17} color="#fff" />
            <Text style={styles.permBtnText}>
              {androidVersion >= 30 ? `Grant ${selectedSourceLabel}` : 'Grant Permission'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.guideLink} onPress={() => router.push('/guide')}>
            <Ionicons name="book-outline" size={14} color={COLORS.PRIMARY} />
            <Text style={styles.guideLinkText}>View Setup Guide</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusHeader onInfoPress={() => router.push('/permissions')} />

      <StatusSourceSelector selectedSource={selectedSource} onSelectSource={setSelectedSource} />
      <SAFGuideOverlay visible={isRequestingSAF} />

      <SubTabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        imageCnt={imageCnt}
        videoCnt={videoCnt}
      />

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={styles.listArea}
      >
        {/*
          ANDROID 11 HEAT FIX: Only the ACTIVE tab's FlashList is mounted.
          Previously both image AND video grids were mounted simultaneously
          inside the horizontal ScrollView, so on first paint the OS had to
          decode 50+ image thumbnails AND 50+ video thumbnails at the same
          time — a massive CPU spike that made the device hot and slowed the
          first frame after splash. The inactive tab is now a placeholder
          shimmer; it mounts its real grid only when the user swipes to it.
        */}
        <View style={{ width: SW, flex: 1 }}>
          {/*
            SELECTIVE PATCHING: Only show the shimmer when we have NOTHING
            to display (first load, no items yet). Once any thumbnails are
            on screen, never blank them out again — even during a refresh
            the grid stays mounted and identical-id items keep their cells
            (FlashList recycles by keyExtractor). Pull-to-refresh runs
            silently; the RefreshControl spinner is the only loading
            indicator the user sees.
          */}
          {(isLoading || isGrantingAccess) && filteredImages.length === 0 ? (
            <LoadingShimmer
              count={GRID_COLUMNS * 8}
              label={isGrantingAccess ? 'Scanning statuses…' : undefined}
            />
          ) : filteredImages.length === 0 ? (
            <EmptyState
              icon="images-outline"
              title="No image statuses yet"
              subtitle={`Open ${selectedSourceLabel} and view some image statuses first — they will appear here automatically!`}
              actionLabel="Refresh"
              onAction={refresh}
            />
          ) : visitedTabs.images ? (
            <FlashList
              data={filteredImages}
              keyExtractor={(item) => item.id}
              numColumns={GRID_COLUMNS}
              estimatedItemSize={CARD_SIZE}
              // Stable layout hint so FlashList never has to measure cells
              // — it just walks the list assigning fixed sizes, which is
              // an order of magnitude cheaper than the default heuristic
              // on slow Android 11+ devices.
              overrideItemLayout={(layout) => {
                layout.size = CARD_SIZE;
                layout.span = 1;
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handlePullRefresh}
                  tintColor={COLORS.PRIMARY}
                  colors={[COLORS.PRIMARY]}
                  progressBackgroundColor={COLORS.SURFACE}
                />
              }
              renderItem={renderImageItem}
              contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 1, paddingTop: 1 }}
              showsVerticalScrollIndicator={false}
              // ANDROID 11+ MEMORY CAP: Image grid uses ExpoImage thumbnails
              // (no live SurfaceView), so removeClippedSubviews is safe and
              // saves the GC ~80-150 MB on long lists. drawDistance=750 is the
              // sweet spot — large enough to keep the next row warm so scroll
              // feels instant, small enough to avoid eagerly decoding 30+
              // off-screen bitmaps that blow the JS heap on cold launch.
              removeClippedSubviews
              drawDistance={750}
            />
          ) : (
            <LoadingShimmer count={GRID_COLUMNS * 8} />
          )}
        </View>

        <View style={{ width: SW, flex: 1 }}>
          {(isLoading || isGrantingAccess) && filteredVideos.length === 0 ? (
            <LoadingShimmer
              count={GRID_COLUMNS * 8}
              label={isGrantingAccess ? 'Scanning statuses…' : undefined}
            />
          ) : filteredVideos.length === 0 ? (
            <EmptyState
              icon="videocam-outline"
              title="No video statuses yet"
              subtitle={`Open ${selectedSourceLabel} and view some video statuses first — they will appear here automatically!`}
              actionLabel="Refresh"
              onAction={refresh}
            />
          ) : visitedTabs.videos ? (
            <FlashList
              data={filteredVideos}
              keyExtractor={(item) => item.id}
              numColumns={GRID_COLUMNS}
              estimatedItemSize={CARD_SIZE}
              overrideItemLayout={(layout) => {
                layout.size = CARD_SIZE;
                layout.span = 1;
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handlePullRefresh}
                  tintColor={COLORS.PRIMARY}
                  colors={[COLORS.PRIMARY]}
                  progressBackgroundColor={COLORS.SURFACE}
                />
              }
              renderItem={renderVideoItem}
              contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 1, paddingTop: 1 }}
              showsVerticalScrollIndicator={false}
              // Same caps as the image grid above. Video cells in MediaCard
              // are static thumbnails (not live VideoViews), so clipping
              // off-screen subviews is safe here too. The dedicated viewer
              // is the only place we keep removeClippedSubviews=false.
              removeClippedSubviews
              drawDistance={750}
            />
          ) : (
            <LoadingShimmer count={GRID_COLUMNS * 8} />
          )}
        </View>
      </ScrollView>

      <MilestoneRatingCard
        visible={saveRating.showCard}
        type="save"
        count={saveRating.count}
        onRate={saveRating.onRate}
        onLater={saveRating.onDismiss}
        onNever={saveRating.onDismiss}
      />
      <MilestoneRatingCard
        visible={!saveRating.showCard && shareRating.showCard}
        type="share"
        count={shareRating.count}
        onRate={shareRating.onRate}
        onLater={shareRating.onDismiss}
        onNever={shareRating.onDismiss}
      />
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  initScreen: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM + 2,
  },
  logoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  logoSub: {
    fontSize: 10,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_600SemiBold',
    lineHeight: 13,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceWrap: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.SM,
    zIndex: 10,
  },
  sourceButton: {
    minHeight: 48,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  sourceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.PRIMARY + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIconWrapActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  sourceLabel: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  sourceSub: {
    fontSize: 10,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 1,
  },
  sourceMenu: {
    marginTop: SPACING.XS,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  sourceOption: {
    minHeight: 58,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  sourceOptionActive: {
    backgroundColor: COLORS.PRIMARY + '10',
  },
  sourceOptionLabel: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  sourceOptionLabelActive: {
    color: COLORS.PRIMARY,
  },
  sourceOptionSub: {
    fontSize: 10,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.LG,
    gap: SPACING.MD,
    height: 50,
    alignItems: 'center',
  },
  activeIndicator: {
    display: 'none',
  },
  subTab: {
    flex: 1,
    height: 38,
    borderRadius: RADIUS.MD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
  },
  subTabActive: {
    backgroundColor: COLORS.PRIMARY + '15',
    borderColor: COLORS.PRIMARY + '40',
    color: COLORS.PRIMARY,
  },
  badge: {
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: COLORS.PRIMARY + '30',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
  },
  badgeTextActive: {
    color: COLORS.PRIMARY,
  },
  listArea: {
    flex: 1,
  },
  row: {
    gap: 0,
  },
  permScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.XXL,
    gap: SPACING.MD,
  },
  permGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    borderRadius: 100,
  },
  permIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 26,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
    marginBottom: SPACING.SM,
  },
  permTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.TEXT,
    textAlign: 'center',
    fontFamily: 'Nunito_800ExtraBold',
  },
  permSub: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Nunito_400Regular',
  },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginTop: SPACING.LG,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD,
    borderRadius: 30,
  },
  permBtnText: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: SPACING.MD,
  },
  guideLinkText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_600SemiBold',
  },
});
