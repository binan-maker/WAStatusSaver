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
import { useThumbnail } from '@/hooks/media/useThumbnail';

type AnyItem = StatusItem | SavedItem;

// 32x32 neutral grey blurhash — shown while a recycled cell is decoding the
// new image so users never see a "black grid" when scrolling back up.
const THUMB_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

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
  const originalUri = 'localUri' in item ? item.localUri : item.uri;

  // Subscribe to the per-item thumbnail cache. The hook returns:
  //   - file://...vid_xxx.jpg → background queue produced a real thumb
  //   - null                  → no cached thumb yet, fall back to current
  //                             expo-image videoTimestamp path
  // Only THIS card re-renders when its own thumb becomes ready, so the
  // background generator never disturbs scrolling.
  const cachedThumb = useThumbnail(item.id);
  const isVideo = item.type === 'video';
  // Decide what URI to feed the <Image>:
  //   - cached thumb if available (always wins — pure file://, instant)
  //   - else original URI (content:// or file://)
  // We also gate the heavy `videoTimestamp` prop on whether we already have
  // a real cached frame: when we have one, we pass a normal image source
  // and Glide treats it as a static JPG — no MediaMetadataRetriever, no
  // SAF round-trip, no decoder spin-up. THIS is what kills the scroll lag.
  const displayUri = cachedThumb || originalUri;
  const useVideoFallback = isVideo && !cachedThumb;

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
        // ANDROID 11+ TOUCH-DROP FIX: pressRetentionOffset keeps the touch
        // "hot" even if the finger drifts slightly while the JS thread is busy
        // decoding the first thumbnail batch. Without this, Android cancels
        // the touch the moment the finger moves >10px — which on a vibrating
        // or moving phone is the leading cause of "I had to tap twice".
        pressRetentionOffset={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        {isVideo ? (
          <View style={styles.image}>
            {useVideoFallback ? (
              // Fallback path — used only briefly until the background queue
              // generates a real cached frame for this video. videoTimestamp
              // 0 picks the first key-frame (no expensive seek). Once the
              // cache populates, this branch is replaced by the file-path
              // branch below and we never touch the decoder again.
              <Image
                source={{ uri: displayUri }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.id}
                videoTimestamp={0}
                priority="low"
                allowDownscaling
                decodeFormat="rgb"
                transition={0}
                placeholder={THUMB_PLACEHOLDER}
                placeholderContentFit="cover"
              />
            ) : (
              // Hot path — pure file:// JPG. No native decoder, no SAF,
              // no metadata retriever. Just memory-mapped JPEG decode.
              <Image
                source={{ uri: displayUri }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.id}
                priority="normal"
                allowDownscaling
                decodeFormat="rgb"
                transition={0}
                placeholder={THUMB_PLACEHOLDER}
                placeholderContentFit="cover"
              />
            )}
            <View style={styles.videoOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            </View>
          </View>
        ) : (
          <Image
            source={{ uri: displayUri }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
            allowDownscaling
            decodeFormat="rgb"
            transition={0}
            priority="low"
            placeholder={THUMB_PLACEHOLDER}
            placeholderContentFit="cover"
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
