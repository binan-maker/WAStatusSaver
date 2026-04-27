import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { CARD_SIZE, RADIUS } from '@/constants/theme';
import { StatusItem, SavedItem } from '@/contexts/MediaContext';

type AnyItem = StatusItem | SavedItem;

interface MediaCardProps {
  item: AnyItem;
  isSaved: boolean;
  // ANDROID 11+ TAP-RELIABILITY FIX:
  // These callbacks now take the item as an argument so parents can pass
  // STABLE useCallback'd handlers (e.g. `onPress={handlePress}`) instead of
  // inline arrows like `onPress={() => handlePress(item)}`. Inline arrows
  // create a new function identity every parent render, defeating React.memo
  // here and causing every thumbnail to re-render mid-touch on cold launch
  // — which dropped the in-flight touch event and forced the user to tap
  // 3-4 times before navigation actually fired.
  onPress: (item: AnyItem) => void;
  onSave?: (item: AnyItem) => void;
  onShare: (item: AnyItem) => void;
  onDelete?: (item: AnyItem) => void;
  showSaveButton?: boolean;
  showDeleteButton?: boolean;
  isFocused?: boolean; // True if card is in/near viewport
}

function MediaCardInner({
  item,
  isSaved,
  onPress,
  onSave,
  onShare,
  showSaveButton = true,
  showDeleteButton = false,
  onDelete,
}: MediaCardProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const uri = 'localUri' in item ? item.localUri : item.uri;

  // Stable internal handlers. They only change when the upstream callback
  // identity OR the item identity changes — both of which are stable across
  // a normal render cycle.
  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const handleSave = useCallback(() => onSave?.(item), [onSave, item]);
  const handleShare = useCallback(() => onShare(item), [onShare, item]);
  const handleDelete = useCallback(() => onDelete?.(item), [onDelete, item]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={handlePress}
        style={styles.touchable}
      >
        {item.type === 'video' ? (
          <View style={styles.image}>
            {/*
              ANDROID 11+ THUMBNAIL PERF:
              - videoTimestamp={0} → first key-frame, no MediaMetadataRetriever
                seek (a 500ms seek on a content:// URI takes 200-800ms each).
              - priority="normal" (was "low") → on cold launch the JS thread
                is busy and "low" priority decodes were waiting hundreds of
                milliseconds before Glide picked them up. "normal" gets the
                visible thumbnails decoded ASAP without fighting any other
                priority request (there are none — the viewer uses "high").
              - allowDownscaling → Glide samples down to grid cell size.
              - transition={0} → instant placeholder swap, no fade.
            */}
            <Image
  source={{ uri }}
  style={styles.image}
  contentFit="cover"
  cachePolicy="memory-disk"
  recyclingKey={uri}
  videoTimestamp={0}
  // DYNAMIC PRIORITY:
  priority={isFocused ? 'normal' : 'low'}
  allowDownscaling
  transition={0}
/>
            <View style={styles.videoOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            </View>
          </View>
        ) : (
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            priority="normal"
            allowDownscaling
            recyclingKey={uri}
          />
        )}

        {item.source === 'whatsapp_business' && (
          <View style={styles.waBadge}>
            <MaterialCommunityIcons name="briefcase" size={9} color="#fff" />
          </View>
        )}

        <View style={styles.actions}>
          {showDeleteButton && onDelete && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleDelete}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Ionicons name="trash-outline" size={13} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleShare}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          >
            <Ionicons name="share-outline" size={13} color="#fff" />
          </TouchableOpacity>
          {showSaveButton && onSave && (
            <TouchableOpacity
              style={[styles.actionBtn, isSaved && styles.savedBtn]}
              onPress={handleSave}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Ionicons
                name={isSaved ? 'checkmark' : 'arrow-down'}
                size={13}
                color={isSaved ? COLORS.PRIMARY : '#fff'}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export const MediaCard = React.memo(MediaCardInner);

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  container: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    margin: 1,
    borderRadius: RADIUS.SM,
    overflow: 'hidden',
    backgroundColor: COLORS.SURFACE_2,
  },
  touchable: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  waBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: COLORS.PRIMARY_DARK,
    borderRadius: 8,
    padding: 3,
  },
  actions: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    flexDirection: 'row',
    gap: 3,
  },
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBtn: {
    backgroundColor: 'rgba(0,196,140,0.22)',
  },
});
