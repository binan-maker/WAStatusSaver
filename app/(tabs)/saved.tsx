import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useMedia, SavedItem } from '@/contexts/MediaContext';
import { MediaCard } from '@/components/media/MediaCard';
import { useMilestoneRating } from '@/hooks/feedback/useMilestoneRating';
import { MilestoneRatingCard } from '@/components/feedback/MilestoneRatingCard';
import { AdBanner, GridAd } from '@/components/ads/AdBanner';
import { EmptyState } from '@/components/media/EmptyState';
import { RewardAdButton } from '@/components/ads/RewardAdButton';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, GRID_COLUMNS, CARD_SIZE, ADMOB } from '@/constants/theme';

// Per-screen error boundary: a crash on this tab shows a recovery UI
// instead of white-screening the whole app.
export { ScreenErrorFallback as ErrorBoundary } from '@/components/common/ScreenErrorFallback';

const { width: SW } = Dimensions.get('window');
const ROW_HEIGHT = CARD_SIZE + 2;
const TAB_BAR_APPROX = 60;

type FilterType = 'all' | 'images' | 'videos';

const FILTERS: FilterType[] = ['all', 'images', 'videos'];

export default function SavedScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [filter, setFilter] = useState<FilterType>('all');
  const {
    savedItems,
    isRefreshing,
    isInitializing,
    refresh,
    deleteFromSaved,
    shareStatus,
    onVideoOpen,
  } = useMedia();
  const shareRating = useMilestoneRating('share');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => savedItems.filter(item => {
    if (filter === 'images') return item.type === 'image';
    if (filter === 'videos') return item.type === 'video';
    return true;
  }), [savedItems, filter]);

  const lastPressRef = React.useRef<Map<string, number>>(new Map());

  const handlePress = useCallback((item: SavedItem) => {
    const now = Date.now();
    const lastPress = lastPressRef.current.get(item.id) || 0;
    if (now - lastPress < 300) return;
    lastPressRef.current.set(item.id, now);

    if (item.type === 'video') onVideoOpen(item.localUri);
    router.push({
      pathname: '/viewer',
      params: { id: item.id, isSaved: '1' },
    });
  }, [onVideoOpen]);

  const handleDelete = useCallback((item: SavedItem) => {
    Alert.alert(
      'Remove Status',
      'Remove this from your saved collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => deleteFromSaved(item) },
      ]
    );
  }, [deleteFromSaved]);

  const handleShare = useCallback((item: SavedItem) => {
    shareStatus(item);
    shareRating.increment();
  }, [shareStatus, shareRating.increment]);

  // Stable (item) => void wrappers passed straight to React.memo'd MediaCard.
  // Inline `() => handlePress(item)` arrows would create a new function each
  // parent render, breaking memoisation and causing every thumbnail to
  // re-render mid-touch on Android 11 — which dropped the in-flight tap
  // and forced 3-4 taps before navigation fired.
  const handlePressAny = useCallback((item: any) => handlePress(item as SavedItem), [handlePress]);
  const handleShareAny = useCallback((item: any) => handleShare(item as SavedItem), [handleShare]);
  const handleDeleteAny = useCallback((item: any) => handleDelete(item as SavedItem), [handleDelete]);

  const renderSavedItem = useCallback(({ item }: { item: SavedItem }) => (
    <MediaCard
      item={item}
      isSaved
      onPress={handlePressAny}
      onShare={handleShareAny}
      onDelete={handleDeleteAny}
      showSaveButton={false}
      showDeleteButton
    />
  ), [handlePressAny, handleShareAny, handleDeleteAny]);

  const getItemLayout = useCallback(
    (_data: ArrayLike<SavedItem> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * Math.floor(index / GRID_COLUMNS),
      index,
    }),
    []
  );

  const bottomPad = insets.bottom + TAB_BAR_APPROX + 4;
  const headerPaddingTop = Platform.OS === 'web' ? 67 : insets.top;

  if (isInitializing) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: headerPaddingTop + 6 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Saved</Text>
            <Text style={styles.headerSub}>{savedItems.length} status{savedItems.length !== 1 ? 'es' : ''} saved</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const cnt = f === 'all' ? savedItems.length :
              savedItems.filter(s => s.type === (f === 'images' ? 'image' : 'video')).length;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, filter === f && styles.chipActive]}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={f === 'all' ? 'grid-outline' : f === 'images' ? 'image-outline' : 'videocam-outline'}
                  size={12}
                  color={filter === f ? '#fff' : COLORS.TEXT_MUTED}
                />
                <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                  {f === 'all' ? 'All' : f === 'images' ? 'Images' : 'Videos'}
                </Text>
                {cnt > 0 && (
                  <Text style={[styles.chipCount, filter === f && styles.chipCountActive]}>
                    {cnt}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {filtered.length === 0 ? (
        <>
          <EmptyState
            icon="bookmark-outline"
            title={filter === 'all' ? 'Nothing saved yet' : `No ${filter} saved`}
            subtitle={
              filter === 'all'
                ? 'Go to Statuses tab and tap the download icon to save.'
                : `No ${filter} have been saved. Switch to "All" to see everything.`
            }
            actionLabel={filter !== 'all' ? 'Show All' : undefined}
            onAction={filter !== 'all' ? () => setFilter('all') : undefined}
          />
        </>
      ) : (
        <>
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id + item.savedAt}
          numColumns={GRID_COLUMNS}
          extraData={filter}
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
          renderItem={renderSavedItem}
          contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 1, paddingTop: 1 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          // Same memory caps as the home grids (see app/(tabs)/index.tsx).
          // Saved items are pure file:// thumbnails so removeClippedSubviews
          // is safe and frees ~80-150 MB on long lists.
          removeClippedSubviews
          drawDistance={750}
        />
        </>
      )}
      <AdBanner />
      <MilestoneRatingCard
        visible={shareRating.showCard}
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
  header: {
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    gap: SPACING.MD,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    lineHeight: 26,
  },
  headerSub: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_600SemiBold',
    lineHeight: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.SURFACE_2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  chipActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  chipText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipCount: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
    backgroundColor: COLORS.SURFACE_3,
    paddingHorizontal: 5,
    borderRadius: 8,
  },
  chipCountActive: {
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  row: {
    gap: 0,
  },
});
