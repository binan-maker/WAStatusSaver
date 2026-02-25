import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMedia, SavedItem } from '@/contexts/MediaContext';
import { MediaCard } from '@/components/MediaCard';
import { AdBanner } from '@/components/AdBanner';
import { EmptyState } from '@/components/EmptyState';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, GRID_COLUMNS } from '@/constants/theme';

type FilterType = 'all' | 'images' | 'videos';

export default function SavedScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const {
    savedItems,
    isRefreshing,
    refresh,
    deleteFromSaved,
    shareStatus,
    onVideoOpen,
  } = useMedia();
  const insets = useSafeAreaInsets();

  const filtered = savedItems.filter(item => {
    if (filter === 'images') return item.type === 'image';
    if (filter === 'videos') return item.type === 'video';
    return true;
  });

  const handlePress = useCallback((item: SavedItem) => {
    if (item.type === 'video') onVideoOpen(item.localUri);
    router.push({
      pathname: '/viewer',
      params: { uri: item.localUri, type: item.type, name: item.name, id: item.id, isSaved: '1' },
    });
  }, [onVideoOpen]);

  const handleDelete = useCallback((item: SavedItem) => {
    Alert.alert(
      'Delete Status',
      'Remove this status from your saved collection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteFromSaved(item),
        },
      ]
    );
  }, [deleteFromSaved]);

  const handleShare = useCallback((item: SavedItem) => {
    shareStatus(item);
  }, [shareStatus]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.SURFACE, COLORS.BACKGROUND]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Saved</Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerCount}>
              {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'images', 'videos'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={f === 'all' ? 'grid-outline' : f === 'images' ? 'image-outline' : 'videocam-outline'}
                size={13}
                color={filter === f ? '#fff' : COLORS.TEXT_MUTED}
              />
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {filtered.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title={filter === 'all' ? 'Nothing Saved Yet' : `No ${filter} saved`}
          subtitle={
            filter === 'all'
              ? 'Go to Statuses and tap the download icon to save WhatsApp statuses.'
              : `No ${filter} have been saved yet.`
          }
          actionLabel={filter !== 'all' ? 'Show All' : undefined}
          onAction={filter !== 'all' ? () => setFilter('all') : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id + item.savedAt}
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
              isSaved
              onPress={() => handlePress(item)}
              onShare={() => handleShare(item)}
              onDelete={() => handleDelete(item)}
              showSaveButton={false}
              showDeleteButton
            />
          )}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 70 }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!filtered.length}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={10}
          initialNumToRender={12}
        />
      )}

      <AdBanner style={{ paddingBottom: insets.bottom + 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
    gap: SPACING.MD,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  headerRight: {
    backgroundColor: COLORS.SURFACE_2,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  headerCount: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.SURFACE_2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  filterChipActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  filterText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_600SemiBold',
  },
  filterTextActive: {
    color: '#fff',
  },
  grid: {
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  row: {
    gap: 0,
  },
});
