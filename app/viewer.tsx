import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMedia, StatusItem, SavedItem } from '@/contexts/MediaContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { ViewerItem } from '@/components/viewer/ViewerItem';
import { createStyles, SW } from '@/components/viewer/viewerStyles';
import { ThumbnailCache } from '@/lib/thumbnail-cache';

export default function ViewerScreen() {
  const { colors: COLORS, resolved } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
    prepareStatusForViewing,
  } = useMedia();

  const params = useLocalSearchParams<{ id: string; isSaved?: string }>();
  const { id, isSaved: isSavedParam } = params;
  const isSavedView = isSavedParam === '1';
  const prevIdRef = useRef<string | null>(null);

  // Load statuses if empty (deep link / refresh)
  useEffect(() => {
    if (!isSavedView && statuses.length === 0 && hasPermission) {
      loadStatuses();
    }
  }, [isSavedView, statuses.length, hasPermission, loadStatuses]);

  // Always-black system bars on mount only — never from an AppState listener.
  // Repeating these calls on every 'active' event causes a Window-config-change
  // → window-focus-loss → AppState inactive/active loop every ~300 ms.
  const themeRestoreRef = useRef({ resolved, bg: COLORS.BACKGROUND });
  useEffect(() => {
    themeRestoreRef.current = { resolved, bg: COLORS.BACKGROUND };
  }, [resolved, COLORS.BACKGROUND]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    StatusBar.setHidden(false, 'none');
    StatusBar.setTranslucent(false);
    StatusBar.setBarStyle('light-content', true);
    StatusBar.setBackgroundColor('#000000', true);
    NavigationBar.setButtonStyleAsync('light').catch(() => {});
    SystemUI.setBackgroundColorAsync('#000000').catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Thumbnail I/O pause while viewer is open; restore bars on blur.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      ThumbnailCache.pause();
      return () => {
        const { resolved: r } = themeRestoreRef.current;
        const isDark = r === 'dark';
        StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
        StatusBar.setBackgroundColor(isDark ? '#05070A' : '#FFFFFF', true);
        NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
        SystemUI.setBackgroundColorAsync(isDark ? '#05070A' : '#FFFFFF').catch(() => {});
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Hardware back button
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.back();
        return true;
      });
      return () => sub.remove();
    }, [])
  );

  const items = useMemo(() => {
    if (isSavedView) {
      const start = savedItems.find(s => s.id === id || decodeURIComponent(s.id) === id);
      if (!start) return savedItems;
      return savedItems.filter(s => s.type === start.type);
    }
    const start = statuses.find(s => s.id === id || decodeURIComponent(s.id) === id);
    if (!start) return [];
    return statuses.filter(s => s.type === start.type);
  }, [isSavedView, savedItems, statuses, id]);

  // ── Active-item tracking ────────────────────────────────────────────────
  // We track the active item by ID (not by index) so that background calls to
  // setStatuses() — e.g. the 1 500 ms file-existence sweep in loadStatusesCache —
  // that remove stale entries and shift indices never cause isActive to flip false
  // on the currently playing video.
  //
  // currentIndex is derived synchronously inside the same render that recomputes
  // items, so isActive={index === currentIndex} is always correct with zero lag.
  // A post-render useEffect re-sync would be one frame too late and still let one
  // intermediate render through with the wrong index, triggering player.pause().
  const [currentItemId, setCurrentItemId] = useState<string>(id);

  // Derived synchronously — never stale across items shifts.
  const currentIndex = useMemo(() => {
    const idx = items.findIndex(
      it => it.id === currentItemId || decodeURIComponent(it.id) === currentItemId,
    );
    return idx !== -1 ? idx : 0;
  }, [items, currentItemId]);

  const flatListRef = useRef<FlatList>(null);
  const prevIndex = useRef(currentIndex);

  // Scroll to the opening item when the viewer is first shown (or id changes).
  useEffect(() => {
    if (prevIdRef.current !== id) {
      prevIdRef.current = id;
      setCurrentItemId(id);
      prevIndex.current = currentIndex;
      if (currentIndex > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: currentIndex, animated: false });
        }, 50);
      }
    }
  }, [id, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch adjacent images
  useEffect(() => {
    const slots = [
      items[currentIndex - 1],
      items[currentIndex],
      items[currentIndex + 1],
    ].filter(Boolean);
    for (const it of slots) {
      if (it.type === 'image') {
        const uri = 'localUri' in it ? (it as SavedItem).localUri : it.uri;
        Image.prefetch(uri, 'memory-disk').catch(() => {});
      }
    }
    const timer = setTimeout(() => {
      const next2 = items[currentIndex + 2];
      if (next2?.type === 'image') {
        const uri = 'localUri' in next2 ? (next2 as SavedItem).localUri : next2.uri;
        Image.prefetch(uri, 'memory-disk').catch(() => {});
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [currentIndex, items]);

  const currentItem = items[currentIndex];
  const isSaved = isSavedView || (currentItem && isStatusSaved(currentItem.id));

  const [showControls, setShowControls] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setShowControls(true);
    controlsOpacity.setValue(1);
  }, [currentIndex, currentItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleControls = useCallback(() => {
    const next = !showControls;
    setShowControls(next);
    Animated.timing(controlsOpacity, {
      toValue: next ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showControls, controlsOpacity]);

  // ── Memoized renderItem ─────────────────────────────────────────────────────
  // Inline arrow functions cause FlatList to rerender ALL visible cells on
  // every ViewerScreen render. Wrapping with useCallback keeps the reference
  // stable during steady-state playback. ViewerItem is React.memo-wrapped with
  // a prop comparator, so it only re-renders when something actually changes.
  const renderItem = useCallback(({ item, index }: { item: StatusItem | SavedItem; index: number }) => (
    <ViewerItem
      item={item}
      isActive={index === currentIndex}
      isNearActive={Math.abs(index - currentIndex) <= 1}
      onToggleControls={toggleControls}
      prepareStatusForViewing={prepareStatusForViewing}
    />
  // showControls / controlsOpacity intentionally excluded — they are not used
  // inside ViewerItem and were causing every tap-to-toggle-controls event to
  // re-render all visible slides, which in turn triggered the StableVideo memo
  // comparator and contributed to the stutter loop.
  ), [currentIndex, toggleControls, prepareStatusForViewing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIndexSettled = useCallback((event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SW);
    if (index < 0 || index >= items.length || index === prevIndex.current) return;
    const newId = items[index]?.id;
    if (newId) setCurrentItemId(newId);
    setShowControls(true);
    controlsOpacity.setValue(1);
    prevIndex.current = index;
  }, [items, controlsOpacity]);

  const handleSave = useCallback(async () => {
    if (!currentItem || isSaved || isSaving) return;
    setIsSaving(true);
    await saveStatus(currentItem);
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
          const saved = savedItems.find(s => s.id === currentItem.id);
          if (saved) {
            await deleteFromSaved(saved);
            if (items.length <= 1) router.back();
          }
        },
      },
    ]);
  }, [isSavedView, currentItem, savedItems, deleteFromSaved, items.length]);

  if (!currentItem) return null;
  const isVideoItem = currentItem.type === 'video';

  return (
    <View style={styles.root}>
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        initialScrollIndex={currentIndex > 0 ? currentIndex : undefined}
        getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
        onMomentumScrollEnd={handleIndexSettled}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
        }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={50}
      />

      {/* Top bar — always visible */}
      <Animated.View
        style={[styles.topBar, { paddingTop: insets.top + 8, opacity: 1, zIndex: 150 }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topCounter}>{currentIndex + 1} / {items.length}</Text>
        </View>
        {__DEV__ && currentItem?.type === 'video' ? (
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: 'rgba(0,196,140,0.25)' }]}
            onPress={() => router.push({ pathname: '/test-video', params: { id: currentItem.id } })}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="flask-outline" size={18} color="#00C48C" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </Animated.View>

      {/* Video: Reels-style right sidebar */}
      {isVideoItem && (
        <View style={[styles.reelsSidebar, { bottom: insets.bottom + 100 }]} pointerEvents="box-none">
          {!isSavedView && (
            <TouchableOpacity style={styles.reelsBtn} onPress={handleSave} disabled={!!isSaved || isSaving}>
              <View style={[styles.reelsCircle, isSaved && { backgroundColor: COLORS.PRIMARY + 'CC' }]}>
                {isSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name={isSaved ? 'checkmark-circle' : 'download-outline'} size={26} color="#fff" />}
              </View>
              <Text style={styles.reelsLabel}>{isSaved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.reelsBtn} onPress={handleShare}>
            <View style={styles.reelsCircle}>
              <Ionicons name="share-social-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.reelsLabel}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reelsBtn} onPress={handleShare}>
            <View style={styles.reelsCircle}>
              <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
            </View>
            <Text style={styles.reelsLabel}>WhatsApp</Text>
          </TouchableOpacity>
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

      {/* Image: bottom action bar */}
      {!isVideoItem && (
        <Animated.View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + 16,
              opacity: controlsOpacity,
              pointerEvents: showControls ? 'auto' : 'none',
              zIndex: 150,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: isSaved ? COLORS.PRIMARY + '33' : COLORS.PRIMARY }]}
            onPress={handleSave}
            disabled={!!isSaved || isSaving || isSavedView}
          >
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name={isSaved ? 'checkmark-circle' : 'download'} size={20} color={isSaved ? COLORS.PRIMARY : '#fff'} />}
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
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.ERROR + '22' }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.ERROR} />
              <Text style={[styles.actionText, { color: COLORS.ERROR }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </View>
  );
}
