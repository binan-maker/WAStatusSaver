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
import { SPACING, FONT_SIZE, CARD_SIZE, GRID_COLUMNS } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');

type TabType = 'images' | 'videos';

function StatusHeader() {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[COLORS.SURFACE, COLORS.BACKGROUND]}
      style={[styles.headerGradient, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <MaterialCommunityIcons name="shield-check" size={22} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.logoText}>StatusVault</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/permissions')}
          style={styles.headerBtn}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="information-circle-outline" size={24} color={COLORS.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

function SubTab({ label, active, onPress, count }: { label: string; active: boolean; onPress: () => void; count: number }) {
  const underlineWidth = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(underlineWidth, {
      toValue: active ? 1 : 0,
      tension: 200,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [active]);

  return (
    <TouchableOpacity onPress={onPress} style={styles.subTab} activeOpacity={0.7}>
      <View style={styles.subTabInner}>
        <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
          {label}
        </Text>
        {count > 0 && (
          <View style={[styles.countBadge, active && styles.countBadgeActive]}>
            <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
          </View>
        )}
      </View>
      <Animated.View
        style={[
          styles.subTabUnderline,
          {
            width: underlineWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </TouchableOpacity>
  );
}

function renderItem({ item, onPress, onSave, onShare, isSaved }: any) {
  return (
    <MediaCard
      item={item}
      isSaved={isSaved}
      onPress={onPress}
      onSave={onSave}
      onShare={onShare}
      showSaveButton
    />
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
    pendingVideoUri,
    dismissInterstitial,
  } = useMedia();

  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (hasPermission || androidVersion < 30) {
      loadStatuses();
    }
  }, [hasPermission, safGranted]);

  const filtered = statuses.filter(s =>
    activeTab === 'images' ? s.type === 'image' : s.type === 'video'
  );

  const images = statuses.filter(s => s.type === 'image');
  const videos = statuses.filter(s => s.type === 'video');

  const handlePress = useCallback((item: StatusItem) => {
    if (item.type === 'video') {
      onVideoOpen(item.uri);
    }
    router.push({
      pathname: '/viewer',
      params: { uri: item.uri, type: item.type, name: item.name, id: item.id },
    });
  }, [onVideoOpen]);

  const handleSave = useCallback((item: StatusItem) => {
    saveStatus(item);
  }, [saveStatus]);

  const handleShare = useCallback((item: StatusItem) => {
    shareStatus(item);
  }, [shareStatus]);

  const needsPermission = !hasPermission && Platform.OS === 'android';
  const needsSAF = Platform.OS === 'android' && androidVersion >= 30 && !safGranted;

  if (needsPermission || (needsSAF && statuses.length === 0)) {
    return (
      <View style={styles.root}>
        <StatusHeader />
        <View style={styles.permissionScreen}>
          <View style={styles.permissionIcon}>
            <MaterialCommunityIcons name="folder-lock-open-outline" size={64} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.permissionTitle}>Setup Required</Text>
          <Text style={styles.permissionSub}>
            To show WhatsApp statuses, StatusVault needs access to your storage.
          </Text>
          <TouchableOpacity
            style={styles.permissionBtn}
            onPress={() => router.push('/permissions')}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
            <Text style={styles.permissionBtnText}>Grant Access</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.guideLink}
            onPress={() => router.push('/guide')}
          >
            <Text style={styles.guideLinkText}>View Setup Guide</Text>
          </TouchableOpacity>
        </View>
        <AdBanner />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusHeader />

      <View style={styles.subTabBar}>
        <SubTab label="Images" active={activeTab === 'images'} onPress={() => setActiveTab('images')} count={images.length} />
        <SubTab label="Videos" active={activeTab === 'videos'} onPress={() => setActiveTab('videos')} count={videos.length} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 4 }}>
          <LoadingShimmer count={12} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={activeTab === 'images' ? 'images-outline' : 'videocam-outline'}
          title={`No ${activeTab === 'images' ? 'Images' : 'Videos'} Found`}
          subtitle={`Open WhatsApp and view some statuses, then come back and pull to refresh.`}
          actionLabel="Refresh"
          onAction={refresh}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLUMNS}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={COLORS.PRIMARY}
              colors={[COLORS.PRIMARY]}
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
          contentContainerStyle={[
            styles.gridContent,
            { paddingBottom: insets.bottom + 70 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          columnWrapperStyle={filtered.length > 0 ? styles.row : undefined}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={10}
          initialNumToRender={12}
        />
      )}

      <AdBanner style={{ paddingBottom: insets.bottom + 60 }} />

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
  headerGradient: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: -0.5,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  subTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subTabText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_600SemiBold',
  },
  subTabTextActive: {
    color: COLORS.PRIMARY,
  },
  subTabUnderline: {
    height: 2,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 1,
    marginTop: 6,
    alignSelf: 'center',
  },
  countBadge: {
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: COLORS.PRIMARY + '33',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
  },
  countTextActive: {
    color: COLORS.PRIMARY,
  },
  gridContent: {
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  row: {
    gap: 0,
  },
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.XXL,
    gap: SPACING.MD,
  },
  permissionIcon: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.SM,
  },
  permissionTitle: {
    fontSize: FONT_SIZE.XXL,
    fontWeight: '800',
    color: COLORS.TEXT,
    textAlign: 'center',
    fontFamily: 'Nunito_800ExtraBold',
  },
  permissionSub: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Nunito_400Regular',
  },
  permissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginTop: SPACING.LG,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD,
    borderRadius: 30,
  },
  permissionBtnText: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  guideLink: {
    padding: SPACING.MD,
  },
  guideLinkText: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_600SemiBold',
    textDecorationLine: 'underline',
  },
});
