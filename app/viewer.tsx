import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useMedia, StatusItem, SavedItem } from "@/contexts/MediaContext";
import { useTheme } from "@/contexts/ThemeContext";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { ViewerItem } from "@/components/viewer/ViewerItem";
import {
  createStyles,
  SW,
  ITEM_SPACING,
} from "@/components/viewer/viewerStyles";
import { ThumbnailCache } from "@/lib/thumbnail-cache";
import { useAds } from "@/contexts/AdsContext";

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
  const { trackDownload } = useAds();

  const params = useLocalSearchParams<{
    id: string;
    isSaved?: string;
    savedFilter?: string;
  }>();
  const { id, isSaved: isSavedParam, savedFilter } = params;
  const isSavedView = isSavedParam === "1";
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

  // ── Enter / exit transition ──────────────────────────────────────────────
  // The Stack is set to animation:'none' so these Animated values own the
  // full enter and exit motion — no double-animation.
  const viewerOpacity = useRef(new Animated.Value(0)).current;
  const viewerTranslateY = useRef(new Animated.Value(28)).current;

  // Enter: fade in + slide up (230 ms ease-out).
  useEffect(() => {
    Animated.parallel([
      Animated.timing(viewerOpacity, {
        toValue: 1,
        duration: 230,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: true,
      }),
      Animated.timing(viewerTranslateY, {
        toValue: 0,
        duration: 230,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit: fade out + slide down (190 ms ease-in), then restore bars and pop.
  // All exit paths (back button, hardware back, delete) funnel through here
  // so the animation always plays and bars are restored at the right moment.
  const handleBack = useCallback(() => {
    Animated.parallel([
      Animated.timing(viewerOpacity, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.poly(2)),
        useNativeDriver: true,
      }),
      Animated.timing(viewerTranslateY, {
        toValue: 32,
        duration: 190,
        easing: Easing.in(Easing.poly(2)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (Platform.OS === "android") {
        const { resolved: r, bg } = themeRestoreRef.current;
        const isDark = r === "dark";
        StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
        StatusBar.setBackgroundColor(bg, true);
        NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark").catch(
          () => {},
        );
        SystemUI.setBackgroundColorAsync(bg).catch(() => {});
      }
      router.back();
    });
    // viewerOpacity / viewerTranslateY are stable Animated refs; themeRestoreRef is a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    StatusBar.setHidden(false, "none");
    StatusBar.setTranslucent(false);
    StatusBar.setBarStyle("light-content", true);
    StatusBar.setBackgroundColor("#000000", true);
    NavigationBar.setButtonStyleAsync("light").catch(() => {});
    SystemUI.setBackgroundColorAsync("#000000").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Thumbnail I/O pause while viewer is open; restore on blur.
  // pause() sets isPaused so any in-flight thumbnail decoder op bails at
  // its next await boundary instead of competing with ExoPlayer.
  // resume() clears isPaused so the queue can run again after the viewer closes.
  // Bar restoration is handled inside handleBack's animation callback so it
  // fires AFTER the exit animation — not during it (which caused a color flash).
  // The delayed fallback here covers any non-handleBack exit path (rare).
  useFocusEffect(
    useCallback(() => {
      ThumbnailCache.pause();
      return () => {
        ThumbnailCache.resume();
        if (Platform.OS !== "android") return;
        const { resolved: r, bg } = themeRestoreRef.current;
        const isDark = r === "dark";
        // Delay matches the exit animation duration so bars don't flash mid-fade.
        setTimeout(() => {
          StatusBar.setBarStyle(
            isDark ? "light-content" : "dark-content",
            true,
          );
          StatusBar.setBackgroundColor(bg, true);
          NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark").catch(
            () => {},
          );
          SystemUI.setBackgroundColorAsync(bg).catch(() => {});
        }, 200);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Hardware back button — play exit animation then pop.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
      // handleBack is stable ([] deps).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleBack]),
  );

  const items = useMemo(() => {
    if (isSavedView) {
      if (savedFilter === "images")
        return savedItems.filter((s) => s.type === "image");
      if (savedFilter === "videos")
        return savedItems.filter((s) => s.type === "video");
      // 'all' (or no filter) — preserve original saved order, no type split
      return savedItems;
    }
    const start = statuses.find(
      (s) => s.id === id || decodeURIComponent(s.id) === id,
    );
    if (!start) return [];
    return statuses.filter((s) => s.type === start.type);
  }, [isSavedView, savedItems, statuses, id, savedFilter]);

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
      (it) =>
        it.id === currentItemId || decodeURIComponent(it.id) === currentItemId,
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
          flatListRef.current?.scrollToIndex({
            index: currentIndex,
            animated: false,
          });
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
      if (it.type === "image") {
        const uri = "localUri" in it ? (it as SavedItem).localUri : it.uri;
        Image.prefetch(uri, "memory-disk").catch(() => {});
      }
    }
    const timer = setTimeout(() => {
      const next2 = items[currentIndex + 2];
      if (next2?.type === "image") {
        const uri =
          "localUri" in next2 ? (next2 as SavedItem).localUri : next2.uri;
        Image.prefetch(uri, "memory-disk").catch(() => {});
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

  // showControlsRef mirrors showControls so toggleControls never needs
  // showControls in its deps — keeping it stable for the lifetime of the
  // viewer screen. Without this, every tap recreates toggleControls →
  // recreates renderItem → ALL visible ViewerItems re-render → unexpected
  // ViewerItem render #3/#4 UNEXPECTED RERENDER logs → surface recreation.
  const showControlsRef = useRef(showControls);
  showControlsRef.current = showControls;

  const toggleControls = useCallback(() => {
    const next = !showControlsRef.current;
    showControlsRef.current = next;
    setShowControls(next);
    Animated.timing(controlsOpacity, {
      toValue: next ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    // controlsOpacity is useRef(..).current — never changes. toggleControls
    // is now effectively stable for the full lifetime of the viewer screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsOpacity]);

  // ── Memoized renderItem ─────────────────────────────────────────────────────
  // Inline arrow functions cause FlatList to rerender ALL visible cells on
  // every ViewerScreen render. Wrapping with useCallback keeps the reference
  // stable during steady-state playback. ViewerItem is React.memo-wrapped with
  // a prop comparator, so it only re-renders when something actually changes.
  const renderItem = useCallback(
    ({ item, index }: { item: StatusItem | SavedItem; index: number }) => (
      <ViewerItem
        item={item}
        isActive={index === currentIndex}
        isNearActive={Math.abs(index - currentIndex) <= 1}
        onToggleControls={toggleControls}
        prepareStatusForViewing={prepareStatusForViewing}
        bottomInset={insets.bottom}
      />
      // showControls / controlsOpacity intentionally excluded — they are not used
      // inside ViewerItem and were causing every tap-to-toggle-controls event to
      // re-render all visible slides, which in turn triggered the StableVideo memo
      // comparator and contributed to the stutter loop.
    ),
    [currentIndex, toggleControls, prepareStatusForViewing],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIndexSettled = useCallback(
    (event: any) => {
      const index = Math.round(
        event.nativeEvent.contentOffset.x / (SW + ITEM_SPACING),
      );
      if (index < 0 || index >= items.length || index === prevIndex.current)
        return;
      const newId = items[index]?.id;
      if (newId) setCurrentItemId(newId);
      setShowControls(true);
      controlsOpacity.setValue(1);
      prevIndex.current = index;
    },
    [items, controlsOpacity],
  );

  const handleSave = useCallback(async () => {
    if (!currentItem || isSaved || isSaving) return;
    setIsSaving(true);
    const saved = await saveStatus(currentItem);
    if (saved) {
      await trackDownload();
    }
    setIsSaving(false);
  }, [currentItem, isSaved, isSaving, saveStatus, trackDownload]);

  const handleShare = useCallback(async () => {
    if (!currentItem) return;
    await shareStatus(currentItem);
  }, [currentItem, shareStatus]);

  const handleDelete = useCallback(async () => {
    if (!isSavedView || !currentItem) return;
    Alert.alert("Delete", "Remove this status from saved?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const saved = savedItems.find((s) => s.id === currentItem.id);
          if (saved) {
            await deleteFromSaved(saved);
            if (items.length <= 1) handleBack();
          }
        },
      },
    ]);
  }, [isSavedView, currentItem, savedItems, deleteFromSaved, items.length]);

  if (!currentItem) return null;
  const isVideoItem = currentItem.type === "video";

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: viewerOpacity,
          transform: [{ translateY: viewerTranslateY }],
        },
      ]}
    >
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        initialScrollIndex={currentIndex > 0 ? currentIndex : undefined}
        getItemLayout={(_, index) => ({
          length: SW + ITEM_SPACING,
          offset: (SW + ITEM_SPACING) * index,
          index,
        })}
        onMomentumScrollEnd={handleIndexSettled}
        snapToInterval={SW + ITEM_SPACING}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToIndex({
            index: info.index,
            animated: false,
          });
        }}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        removeClippedSubviews={false}
        updateCellsBatchingPeriod={50}
      />

      {/* Top bar — always visible */}
      <Animated.View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 8, opacity: 1, zIndex: 150 },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topCounter}>
            {currentIndex + 1} / {items.length}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* Video: Reels-style right sidebar */}
      {isVideoItem && (
        <View
          style={[styles.reelsSidebar, { bottom: insets.bottom + 100 }]}
          pointerEvents="box-none"
        >
          {!isSavedView && (
            <TouchableOpacity
              style={styles.reelsBtn}
              onPress={handleSave}
              disabled={!!isSaved || isSaving}
            >
              <View
                style={[
                  styles.reelsCircle,
                  isSaved && { backgroundColor: COLORS.PRIMARY + "CC" },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name={isSaved ? "checkmark-circle" : "download-outline"}
                    size={26}
                    color="#fff"
                  />
                )}
              </View>
              <Text style={styles.reelsLabel}>
                {isSaved ? "Saved" : "Save"}
              </Text>
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
              <View
                style={[
                  styles.reelsCircle,
                  { backgroundColor: COLORS.ERROR + "CC" },
                ]}
              >
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
              pointerEvents: showControls ? "auto" : "none",
              zIndex: 150,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isSaved
                  ? COLORS.PRIMARY + "33"
                  : COLORS.PRIMARY,
              },
            ]}
            onPress={handleSave}
            disabled={!!isSaved || isSaving || isSavedView}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={isSaved ? "checkmark-circle" : "download"}
                size={20}
                color={isSaved ? COLORS.PRIMARY : "#fff"}
              />
            )}
            <Text
              style={[styles.actionText, isSaved && { color: COLORS.PRIMARY }]}
            >
              {isSaved ? "Saved" : "Save"}
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
              style={[
                styles.actionButton,
                { backgroundColor: COLORS.ERROR + "22" },
              ]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color={COLORS.ERROR} />
              <Text style={[styles.actionText, { color: COLORS.ERROR }]}>
                Delete
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}
