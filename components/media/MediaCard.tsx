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
import { useSavedStatus } from '@/hooks/media/useSavedStatus';

type AnyItem = StatusItem | SavedItem;

const THUMB_PLACEHOLDER = { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' };

interface MediaCardProps {
  item: AnyItem;
  onPress: (item: AnyItem) => void;
  onSave?: (item: AnyItem) => void;
  onShare: (item: AnyItem) => void;
  onDelete?: (item: AnyItem) => void;
  showSaveButton?: boolean;
  showDeleteButton?: boolean;
}

function MediaCardInner({
  item,
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

  // Per-card saved-state subscription — only THIS card re-renders when its
  // own saved state flips. Saving one status never cascades to the full grid.
  const isSaved = useSavedStatus(item.id);

  const cachedThumb = useThumbnail(item.id);
  const isVideo = item.type === 'video';

  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const handleSave = useCallback(() => onSave?.(item), [onSave, item]);
  const handleShare = useCallback(() => onShare(item), [onShare, item]);
  const handleDelete = useCallback(() => onDelete?.(item), [onDelete, item]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        style={styles.touchable}
        pressRetentionOffset={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        {isVideo ? (
          <View style={styles.image}>
            {/* Video thumbnails are ALWAYS pre-generated file:// JPGs from the
                background queue (ThumbnailCache). Never use videoTimestamp on a
                content:// URI — that forces a SAF round-trip per card and
                destroys scroll smoothness on Android 11+. Until the JPG is
                ready, show only the blurhash placeholder (source={null}). */}
            <Image
              source={cachedThumb ? { uri: cachedThumb } : null}
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
            <View style={styles.videoOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            </View>
          </View>
        ) : (
          /* Images: content:// is fine — expo-image caches the decode result
             on first render, so subsequent scrolls hit the disk cache. */
          <Image
            source={{ uri: originalUri }}
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
