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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useMedia, StatusItem, StatusSource } from '@/contexts/MediaContext';
import { useMilestoneRating } from '@/hooks/feedback/useMilestoneRating';
import { MilestoneRatingCard } from '@/components/feedback/MilestoneRatingCard';
import { MediaCard } from '@/components/media/MediaCard';
import { AdBanner, GridAd } from '@/components/ads/AdBanner';
import { AdInterstitial } from '@/components/ads/AdInterstitial';
import { EmptyState } from '@/components/media/EmptyState';
import { LoadingShimmer } from '@/components/media/LoadingShimmer';
import { RewardAdButton } from '@/components/ads/RewardAdButton';
import { SAFGuideOverlay } from '@/components/media/SAFGuideOverlay';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, CARD_SIZE, GRID_COLUMNS, ADMOB, RADIUS } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');
const ROW_HEIGHT = CARD_SIZE + 2;

type TabType = 'images' | 'videos';

const TAB_BAR_APPROX = 60;
const BANNER_HEIGHT = ADMOB.BANNER_HEIGHT;

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
  const [selectedSource, setSelectedSource] = useState<StatusSource>('whatsapp');
  const saveRating = useMilestoneRating('save');
  const shareRating = useMilestoneRating('share');
  const {
    statuses,
    onImageSwipe,
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
    onVideoOpen,
    showInterstitial,
    dismissInterstitial,
    prepareStatusForViewing,
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

  // Auto-refresh when the user returns to the app from WhatsApp.
  // Stable listener (no deps) — always calls latest refresh via ref.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const now = Date.now();
        // Throttle: Don't refresh more than once every 30 seconds via AppState.
        // AdMob focus shifts can cause rapid active/background toggles;
        // the throttle prevents a SAF BFS scan on every flicker.
        if (now - lastRefreshTime.current > 30000) {
          lastRefreshTime.current = now;
          refreshRef.current(true); // silent — no shimmer while watching
        } else {
          console.log('[Loader] AppState active, but throttled. Skipping refresh.');
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

    if (item.type === 'video') {
      onVideoOpen(item.uri);
    } else {
      onImageSwipe();
    }

    router.push({
      pathname: '/viewer',
      params: { id: item.id },
    });
  }, [onVideoOpen, onImageSwipe]);

  const handleSave = useCallback((item: StatusItem) => {
    saveStatus(item);
    saveRating.increment();
  }, [saveStatus, saveRating.increment]);

  const handleShare = useCallback((item: StatusItem) => {
    shareStatus(item);
    shareRating.increment();
  }, [shareStatus, shareRating.increment]);

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

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: tab === 'images' ? 0 : SW,
        animated: true,
      });
    }
  }, []);

  const onScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newTab = offsetX >= SW / 2 ? 'videos' : 'images';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [activeTab]);

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
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={styles.listArea}
      >
        <View style={{ width: SW }}>
          {isLoading || isGrantingAccess ? (
            <LoadingShimmer count={GRID_COLUMNS * 4} />
          ) : filteredImages.length === 0 ? (
            <EmptyState
              icon="images-outline"
              title="No image statuses yet"
              subtitle={`Open ${selectedSourceLabel} and view some image statuses first — they will appear here automatically!`}
              actionLabel="Refresh"
              onAction={refresh}
            />
          ) : (
            <FlashList
              data={filteredImages}
              keyExtractor={(item) => item.id}
              numColumns={GRID_COLUMNS}
              estimatedItemSize={CARD_SIZE}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refresh}
                  tintColor={COLORS.PRIMARY}
                  colors={[COLORS.PRIMARY]}
                  progressBackgroundColor={COLORS.SURFACE}
                />
              }
              renderItem={({ item, index }) => {
                return (
                  <MediaCard
                    item={item}
                    isSaved={isStatusSaved(item.id)}
                    onPress={() => handlePress(item)}
                    onSave={() => handleSave(item)}
                    onShare={() => handleShare(item)}
                    showSaveButton
                  />
                );
              }}
              contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 1, paddingTop: 1 }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={Platform.OS === 'android'}
              drawDistance={500}
            />
          )}
        </View>

        <View style={{ width: SW }}>
          {isLoading || isGrantingAccess ? (
            <LoadingShimmer count={GRID_COLUMNS * 4} />
          ) : filteredVideos.length === 0 ? (
            <EmptyState
              icon="videocam-outline"
              title="No video statuses yet"
              subtitle={`Open ${selectedSourceLabel} and view some video statuses first — they will appear here automatically!`}
              actionLabel="Refresh"
              onAction={refresh}
            />
          ) : (
            <FlashList
              data={filteredVideos}
              keyExtractor={(item) => item.id}
              numColumns={GRID_COLUMNS}
              estimatedItemSize={CARD_SIZE}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refresh}
                  tintColor={COLORS.PRIMARY}
                  colors={[COLORS.PRIMARY]}
                  progressBackgroundColor={COLORS.SURFACE}
                />
              }
              renderItem={({ item, index }) => {
                return (
                  <MediaCard
                    item={item}
                    isSaved={isStatusSaved(item.id)}
                    onPress={() => handlePress(item)}
                    onSave={() => handleSave(item)}
                    onShare={() => handleShare(item)}
                    showSaveButton
                  />
                );
              }}
              contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 1, paddingTop: 1 }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={Platform.OS === 'android'}
              drawDistance={500}
            />
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
