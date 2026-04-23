import React, { useMemo } from 'react';
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

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        style={styles.touchable}
      >
        {item.type === 'video' ? (
          /*
            expo-image on Android uses Glide which can natively extract a video
            frame from file:// URIs (and many content:// URIs) without any extra
            native library. The videoTimestamp prop (expo-image ≥ 1.11) requests
            the frame at 500 ms for a representative thumbnail.
            A dark play-button overlay is always shown on top.
          */
          <View style={styles.image}>
            {/*
              ANDROID 11+ THUMBNAIL PERF FIX:
              - videoTimestamp={0} → extract first key-frame (very fast).
                videoTimestamp={500} forced MediaMetadataRetriever to seek
                500ms into the file before decoding — on content:// URIs
                this runs through the SAF resolver + ContentResolver and
                takes 200-800ms PER thumbnail, freezing the grid on scroll.
              - priority="low" → expo-image deprioritizes off-screen decodes,
                keeping scroll buttery instead of fighting for CPU.
              - allowDownscaling → Glide samples down to grid cell size
                instead of decoding full-resolution frames into memory.
              - transition={0} → no fade-in, instant placeholder swap.
            */}
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={uri}
              videoTimestamp={0}
              priority="low"
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
            priority="low"
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
