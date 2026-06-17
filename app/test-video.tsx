/**
 * MINIMAL Android 11+ VIDEO TEST SCREEN
 *
 * Purpose: isolate the production viewer freeze by running the absolute
 * smallest possible playback path. If this screen plays without freezing
 * and the production viewer freezes, the cause is something in ViewerItem /
 * VideoPlayerView / the mount gate — not in the file copy or expo-video itself.
 *
 * Navigation:
 *   router.push({ pathname: '/test-video', params: { id: item.id } })
 *   (Debug button appears in viewer.tsx top bar in __DEV__ builds only)
 *
 * What this screen does NOT have (compared to production viewer):
 *   - No FlatList / swipe logic
 *   - No thumbnail fade animation
 *   - No mount gate / decoder count
 *   - No pause/resume on isActive changes
 *   - No stall timer / recovery loop
 *   - No ViewerItem re-renders
 *   - No adjacent-item pre-fetching
 *   - No gesture handlers
 *
 * What it DOES have:
 *   - prepareStatusForViewing() — exact same copy + verify path as production
 *   - useVideoPlayer + VideoView from expo-video — exact same library
 *   - p.play() in initializer — same call as production VideoPlayerView
 *   - contentFit="contain" — same as production
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useMedia, StatusItem } from '@/contexts/MediaContext';
import { Ionicons } from '@expo/vector-icons';

// ── Inner player — only rendered once fileUri is ready ───────────────────────
// Kept as a separate component so the useVideoPlayer hook is not called with a
// null URI and is never re-created after mount (the key prop handles recreation
// if we ever want to change the source).
function MinimalPlayer({ fileUri }: { fileUri: string }) {
  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    // Sets playWhenReady = true in Media3. Media3 will not actually start
    // until both the media is loaded AND the SurfaceTexture is attached.
    // This is the identical call made in production VideoPlayerView.
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', (e: any) => {
      __DEV__ && console.log('[TestVideo] statusChange:', e.status, e.error?.message);
    });
    return () => {
      sub.remove();
      try { player.release(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls
      contentFit="contain"
    />
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TestVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statuses, savedItems, prepareStatusForViewing } = useMedia();

  const [phase, setPhase] = useState<'finding' | 'copying' | 'ready' | 'error'>('finding');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [itemInfo, setItemInfo] = useState('');

  useEffect(() => {
    if (!id) {
      setPhase('error');
      setErrorMsg('No item id passed in params');
      return;
    }

    // Find the item in statuses or savedItems.
    const item: StatusItem | undefined =
      statuses.find(s => s.id === id || decodeURIComponent(s.id) === id) ??
      (savedItems.find(s => s.id === id || decodeURIComponent(s.id) === id) as StatusItem | undefined);

    if (!item) {
      setPhase('error');
      setErrorMsg(`Item not found for id: ${id}`);
      return;
    }

    if (item.type !== 'video') {
      setPhase('error');
      setErrorMsg('Selected item is not a video');
      return;
    }

    const srcUri = 'localUri' in item ? (item as any).localUri : item.uri;
    const isSAF = srcUri.startsWith('content://');

    setItemInfo(
      `name: ${item.name}\n` +
      `size: ${item.size ?? 0}\n` +
      `isSAF: ${isSAF}\n` +
      `uri: ${srcUri.slice(0, 80)}`
    );

    if (!isSAF) {
      // Android ≤10 or already-saved item — play directly, no copy needed.
      setFileUri(srcUri);
      setPhase('ready');
      return;
    }

    // Android 11+ SAF path — copy to local cache exactly as production does.
    setPhase('copying');
    prepareStatusForViewing(item, { forPlayback: true })
      .then((uri) => {
        if (uri) {
          setFileUri(uri);
          setPhase('ready');
        } else {
          setPhase('error');
          setErrorMsg('prepareStatusForViewing returned null/undefined');
        }
      })
      .catch((e: any) => {
        setPhase('error');
        setErrorMsg(String(e?.message ?? e));
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.root}>
      {/* Back */}
      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Label */}
      <View style={s.label}>
        <Text style={s.labelTitle}>MINIMAL TEST PLAYER</Text>
        <Text style={s.labelSub}>expo-video · no swipe · no timers · no recovery</Text>
        {Platform.OS === 'android' && (
          <Text style={s.labelSub}>Android API {Platform.Version}</Text>
        )}
      </View>

      {/* States */}
      {phase === 'finding' && (
        <View style={s.center}>
          <ActivityIndicator color="#00C48C" size="large" />
          <Text style={s.status}>Finding item…</Text>
        </View>
      )}

      {phase === 'copying' && (
        <View style={s.center}>
          <ActivityIndicator color="#00C48C" size="large" />
          <Text style={s.status}>Copying from SAF → cache…</Text>
          <Text style={s.meta}>{itemInfo}</Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={s.center}>
          <Ionicons name="alert-circle" size={48} color="#ff4444" />
          <Text style={s.errorText}>{errorMsg}</Text>
        </View>
      )}

      {phase === 'ready' && fileUri && (
        <>
          <MinimalPlayer key={fileUri} fileUri={fileUri} />
          {/* Overlay info strip at the bottom */}
          <View style={s.info}>
            <Text style={s.infoText} numberOfLines={2}>{itemInfo}</Text>
            <Text style={s.infoUri} numberOfLines={1}>▶ {fileUri.slice(0, 90)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  back: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  labelTitle: {
    color: '#00C48C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  labelSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  status: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
  },
  meta: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    gap: 4,
  },
  infoText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    lineHeight: 15,
  },
  infoUri: {
    color: '#00C48C',
    fontSize: 10,
  },
});
