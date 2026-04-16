import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { CARD_SIZE, RADIUS } from '@/constants/theme';
import { StatusItem, SavedItem } from '@/contexts/MediaContext';

interface MediaCardProps {
  item: StatusItem | SavedItem;
  isSaved: boolean;
  onPress: () => void;
  onSave?: () => void;
  onShare: () => void;
  showSaveButton?: boolean;
  showDeleteButton?: boolean;
  onDelete?: () => void;
}

// Module-level cache persists across re-renders and list recycling.
// Maps source URI → generated thumbnail file URI.
const thumbnailCache = new Map<string, string>();
// Track URIs that have already failed so we don't retry on every re-render.
const thumbnailFailed = new Set<string>();

async function generateThumbnail(uri: string): Promise<string | null> {
  // Try progressively longer time offsets to handle short/slow-starting videos.
  const offsets = [500, 1500, 4000];
  for (const time of offsets) {
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, { time });
      return thumbUri;
    } catch {
      // Try next offset
    }
  }
  return null;
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
  const uri = 'localUri' in item ? item.localUri : item.uri;

  // Initialise from cache immediately so recycled cards show thumbnail at once
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(
    item.type === 'video' ? (thumbnailCache.get(uri) ?? null) : null
  );

  useEffect(() => {
    if (item.type !== 'video') return;
    if (thumbnailCache.has(uri)) {
      setThumbnailUri(thumbnailCache.get(uri)!);
      return;
    }
    // Skip URIs that previously failed to avoid hammering disk on every render.
    if (thumbnailFailed.has(uri)) return;

    let cancelled = false;
    generateThumbnail(uri).then((thumbUri) => {
      if (cancelled) return;
      if (thumbUri) {
        thumbnailCache.set(uri, thumbUri);
        setThumbnailUri(thumbUri);
      } else {
        thumbnailFailed.add(uri);
      }
    });

    return () => { cancelled = true; };
  }, [uri, item.type]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        style={styles.touchable}
      >
        {item.type === 'video' ? (
          /* Show thumbnail if available, otherwise fall back to the video URI
             (expo-image / Glide on Android can extract a frame from file:// and
             some content:// video URIs natively). Overlay darkens if no thumb yet. */
          <View style={styles.image}>
            <Image
              source={{ uri: thumbnailUri ?? uri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={thumbnailUri ?? uri}
            />
            <View style={[styles.videoOverlay, !thumbnailUri && styles.videoOverlayDark]}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            </View>
          </View>
        ) : (
          /* Image: expo-image reads content:// natively on Android */
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={100}
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
              onPress={onDelete}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Ionicons name="trash-outline" size={13} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onShare}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          >
            <Ionicons name="share-outline" size={13} color="#fff" />
          </TouchableOpacity>
          {showSaveButton && onSave && (
            <TouchableOpacity
              style={[styles.actionBtn, isSaved && styles.savedBtn]}
              onPress={onSave}
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlayDark: {
    backgroundColor: 'rgba(0,0,0,0.55)',
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
