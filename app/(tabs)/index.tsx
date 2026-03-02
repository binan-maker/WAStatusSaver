import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMedia, StatusItem } from '@/contexts/MediaContext';
import { MediaCard } from '@/components/MediaCard';
import { AdBanner } from '@/components/AdBanner';
import { AdInterstitial } from '@/components/AdInterstitial';
import { EmptyState } from '@/components/EmptyState';
import { LoadingShimmer } from '@/components/LoadingShimmer';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, CARD_SIZE, GRID_COLUMNS, ADMOB } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');
const ROW_HEIGHT = CARD_SIZE + 2;

type TabType = 'images' | 'videos';

const TAB_BAR_APPROX = 60;
const BANNER_HEIGHT = ADMOB.BANNER_HEIGHT;

function StatusHeader({ onInfoPress }: { onInfoPress: () => void }) {
  const insets = useSafeAreaInsets();
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
  const underlineAnim = useRef(new Animated.Value(activeTab === 'images' ? 0 : 1)).current;

  const handleTabChange = useCallback((tab: TabType) => {
    onTabChange(tab);
    Animated.timing(underlineAnim, {
      toValue: tab === 'images' ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [onTabChange]);

  const translateX = underlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SW / 2],
  });

  return (
    <View style={styles.subTabBar}>
      <Animated.View style={[styles.activeIndicator, { transform: [{ translateX }] }]} />
      <TouchableOpacity
        style={styles.subTab}
        onPress={() => handleTabChange('images')}
        activeOpacity={0.75}
      >
        <Ionicons
          name={activeTab === 'images' ? 'image' : 'image-outline'}
          size={16}
          color={activeTab === 'images' ? COLORS.PRIMARY : COLORS.TEXT_MUTED}
        />
        <Text style={[styles.subTabText, activeTab === 'images' && styles.subTabActive]}>
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
        style={styles.subTab}
        onPress={() => handleTabChange('videos')}
        activeOpacity={0.75}
      >
        <Ionicons
          name={activeTab === 'videos' ? 'videocam' : 'videocam-outline'}
          size={16}
          color={activeTab === 'videos' ? COLORS.PRIMARY : COLORS.TEXT_MUTED}
        />
        <Text style={[styles.subTabText, activeTab === 'videos' && styles.subTabActive]}>
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

export default function StatusesScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('images');
  const {
    statuses,
    isLoading,
    isRefreshing,
    hasPermission,
    safGranted,
    androidVersion,
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

  useEffect(() => {
    if (hasPermission || androidVersion < 30) {
      loadStatuses();
    }
  }, [hasPermission, safGranted]);

  const filtered = statuses.filter(s =>
    activeTab === 'images' ? s.type === 'image' : s.type === 'video'
  );

  const imageCnt = statuses.filter(s => s.type === 'image').length;
  const videoCnt = statuses.filter(s => s.type === 'video').length;

  const handlePress = useCallback(async (item: StatusItem) => {
    if (item.type === 'video') onVideoOpen(item.uri);
    
    // Prepare URI for viewing (caching if SAF)
    const viewUri = await prepareStatusForViewing(item);
    
    router.push({
      pathname: '/viewer',
      params: { uri: viewUri, type: item.type, name: item.name, id: item.id },
    });
  }, [onVideoOpen, prepareStatusForViewing]);

  const handleSave = useCallback((item: StatusItem) => {
    saveStatus(item);
  }, [saveStatus]);

  const handleShare = useCallback((item: StatusItem) => {
    shareStatus(item);
  }, [shareStatus]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<StatusItem> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * Math.floor(index / GRID_COLUMNS),
      index,
    }),
    []
  );

  const needsPermission = !hasPermission && Platform.OS === 'android';
  const needsSAF = Platform.OS === 'android' && androidVersion >= 30 && !safGranted;
  const showPermScreen = needsPermission || (needsSAF && statuses.length === 0);

  const bottomPad = insets.bottom + TAB_BAR_APPROX + BANNER_HEIGHT + 4;

  if (showPermScreen) {
    return (
      <View style={styles.root}>
        <StatusHeader onInfoPress={() => router.push('/permissions')} />
        <View style={styles.permScreen}>
          <LinearGradient
            colors={[COLORS.PRIMARY + '22', 'transparent']}
            style={styles.permGlow}
          />
          <View style={styles.permIconWrap}>
            <MaterialCommunityIcons name="folder-lock-open-outline" size={52} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.permTitle}>Setup Required</Text>
          <Text style={styles.permSub}>
            Grant storage access to view WhatsApp statuses.{'\n'}Android {androidVersion} detected.
          </Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={() => router.push('/permissions')}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark" size={17} color="#fff" />
            <Text style={styles.permBtnText}>Grant Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.guideLink} onPress={() => router.push('/guide')}>
            <Ionicons name="book-outline" size={14} color={COLORS.PRIMARY} />
            <Text style={styles.guideLinkText}>View Setup Guide</Text>
          </TouchableOpacity>
        </View>
        <AdBanner />
      </View>
    );
  }



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

  return (
    <View style={styles.root}>
      <StatusHeader onInfoPress={() => router.push('/permissions')} />

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
          {isLoading ? (
            <LoadingShimmer count={Math.floor((SW - 2) / (CARD_SIZE + 2)) * 4} />
          ) : statuses.filter(s => s.type === 'image').length === 0 ? (
            <EmptyState
              icon="images-outline"
              title="No images found"
              subtitle="Open WhatsApp, view some statuses, then pull down to refresh."
              actionLabel="Refresh"
              onAction={refresh}
            />
          ) : (
            <FlatList
              data={statuses.filter(s => s.type === 'image')}
              keyExtractor={(item) => item.id}
              numColumns={GRID_COLUMNS}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refresh}
                  tintColor={COLORS.PRIMARY}
                  colors={[COLORS.PRIMARY]}
                  progressBackgroundColor={COLORS.SURFACE}
                />
              }
              renderItem={({ item }) => (
                <MediaCard
                  item={item}
                  isSaved={isStatusSaved(item.id)}
                  onPress={() => handlePress(item)}
                  onSave={() => handleSave(item)}
                  onShare={() => handleShare(item)}
                  showSaveButton
                />
              )}
              getItemLayout={getItemLayout}
              contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 1, paddingTop: 1 }}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.row}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </View>

        <View style={{ width: SW }}>
          {isLoading ? (
            <LoadingShimmer count={Math.floor((SW - 2) / (CARD_SIZE + 2)) * 4} />
          ) : statuses.filter(s => s.type === 'video').length === 0 ? (
            <EmptyState
              icon="videocam-outline"
              title="No videos found"
              subtitle="Open WhatsApp, view some statuses, then pull down to refresh."
              actionLabel="Refresh"
              onAction={refresh}
            />
          ) : (
            <FlatList
              data={statuses.filter(s => s.type === 'video')}
              keyExtractor={(item) => item.id}
              numColumns={GRID_COLUMNS}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={refresh}
                  tintColor={COLORS.PRIMARY}
                  colors={[COLORS.PRIMARY]}
                  progressBackgroundColor={COLORS.SURFACE}
                />
              }
              renderItem={({ item }) => (
                <MediaCard
                  item={item}
                  isSaved={isStatusSaved(item.id)}
                  onPress={() => handlePress(item)}
                  onSave={() => handleSave(item)}
                  onShare={() => handleShare(item)}
                  showSaveButton
                />
              )}
              getItemLayout={getItemLayout}
              contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 1, paddingTop: 1 }}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.row}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </View>
      </ScrollView>

      <AdBanner />

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
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: -0.3,
    lineHeight: 22,
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
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    position: 'relative',
    height: 44,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: SW / 2,
    height: 2,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 1,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
  },
  subTabActive: {
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
