/**
 * TEST SCREEN C — react-native-video (same URI as Screen B)
 *
 * Takes the EXACT same file URI that Screen B passes to expo-video and
 * feeds it into react-native-video instead. Zero other changes.
 *
 * HOW TO READ THE RESULT
 * ──────────────────────
 * ✅ react-native-video plays  AND  expo-video freezes
 *    → The bug is inside expo-video / Media3 on this device.
 *      Fix: switch the production viewer to react-native-video.
 *
 * ❌ Both screens freeze
 *    → The issue is the file itself or the codec.
 *      The URI scheme (content:// throttle, bad codec, partial file, etc.)
 *      is the root cause — not the player library.
 *
 * Navigate here from Test Screen B (yellow "→ Test Screen C" button).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet,
  TouchableOpacity, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Video, { OnLoadData, OnProgressData, OnVideoErrorData } from 'react-native-video';
import * as FileSystem from 'expo-file-system/legacy';
import { useMedia, StatusItem } from '@/contexts/MediaContext';
import { Ionicons } from '@expo/vector-icons';

async function measureSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri as any);
    return (info as any).size ?? -1;
  } catch {
    return -2;
  }
}

function fmt(n: number): string {
  if (n === -1) return 'unknown (no size from provider)';
  if (n === -2) return 'ERROR — getInfoAsync threw';
  if (n === 0) return '0 bytes';
  return `${n.toLocaleString()} bytes (${(n / 1024 / 1024).toFixed(2)} MB)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RNVPlayer — renders a react-native-video <Video> with the raw URI.
// ─────────────────────────────────────────────────────────────────────────────
function RNVPlayer({
  uri,
  onStatus,
}: {
  uri: string;
  onStatus: (s: string) => void;
}) {
  const onLoad = (_data: OnLoadData) => onStatus('readyToPlay');
  const onProgress = (_data: OnProgressData) => {};
  const onError = (e: OnVideoErrorData) =>
    onStatus(`error — ${e.error.errorString ?? JSON.stringify(e.error)}`);
  const onBuffer = ({ isBuffering }: { isBuffering: boolean }) =>
    onStatus(isBuffering ? 'buffering…' : 'buffer-ready');

  return (
    <Video
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="contain"
      repeat
      controls={false}
      muted={false}
      onLoad={onLoad}
      onProgress={onProgress}
      onError={onError}
      onBuffer={onBuffer}
      playInBackground={false}
      ignoreSilentSwitch="ignore"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function TestVideoRNVScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statuses, savedItems } = useMedia();

  type Phase = 'finding' | 'measuring' | 'ready' | 'error';
  const [phase, setPhase] = useState<Phase>('finding');
  const [uri, setUri] = useState('');
  const [srcSize, setSrcSize] = useState<number | null>(null);
  const [playerStatus, setPlayerStatus] = useState('—');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSAF, setIsSAF] = useState(false);

  useEffect(() => {
    if (!id) { setPhase('error'); setErrorMsg('No id param'); return; }

    const item: StatusItem | undefined =
      statuses.find(s => s.id === id || decodeURIComponent(s.id) === id) ??
      (savedItems.find(s => s.id === id || decodeURIComponent(s.id) === id) as StatusItem | undefined);

    if (!item) { setPhase('error'); setErrorMsg(`Item not found: ${id}`); return; }
    if (item.type !== 'video') { setPhase('error'); setErrorMsg('Not a video'); return; }

    const resolvedUri: string = 'localUri' in item ? (item as any).localUri : item.uri;
    setUri(resolvedUri);
    setIsSAF(resolvedUri.startsWith('content://'));

    setPhase('measuring');
    measureSize(resolvedUri).then((sz) => {
      setSrcSize(sz);
      setPhase('ready');
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const verdict =
    playerStatus === '—' ? 'waiting for player…' :
    playerStatus === 'readyToPlay' ? '▶ readyToPlay — playing' :
    playerStatus === 'buffer-ready' ? '▶ buffer-ready — playing' :
    playerStatus.startsWith('buffering') ? '⏳ buffering…' :
    playerStatus.includes('error') ? `❌ ${playerStatus}` :
    playerStatus;

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ── Tab strip ── always visible, no scrolling needed */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={s.tab}
          onPress={() => router.replace({ pathname: '/test-video', params: { id } })}
        >
          <Text style={s.tabText}>A  copy+play</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.tab}
          onPress={() => router.replace({ pathname: '/test-video-direct', params: { id } })}
        >
          <Text style={s.tabText}>B  direct</Text>
        </TouchableOpacity>
        <View style={[s.tab, s.tabActive]}>
          <Text style={[s.tabText, s.tabTextActive]}>C  rnv</Text>
        </View>
      </View>

      {phase === 'ready' && uri ? (
        <RNVPlayer key={uri} uri={uri} onStatus={setPlayerStatus} />
      ) : null}

      <ScrollView
        style={s.overlay}
        contentContainerStyle={s.overlayContent}
        pointerEvents="box-none"
      >
        <Text style={s.title}>TEST SCREEN C — react-native-video (same URI)</Text>
        <Text style={s.sub}>Android API {Platform.Version} · {phase}</Text>

        <Row label="URI type" value={isSAF ? 'SAF content:// (Android 11+)' : 'file:// (Android ≤10 or saved)'} />
        <Row label="Source URI" value={uri.slice(0, 140)} />
        <Row
          label="Source size (ContentResolver)"
          value={srcSize != null ? fmt(srcSize) : '…'}
          warn={srcSize === 0 || srcSize === -2}
        />
        <Row
          label="Player status (react-native-video)"
          value={verdict}
          warn={playerStatus.includes('error')}
        />

        <View style={s.box}>
          <Text style={s.boxTitle}>HOW TO READ THIS SCREEN</Text>
          <Text style={s.boxText}>
            {'✅ Plays  +  expo-video freezes\n' +
             '   → Bug is inside expo-video / Media3.\n' +
             '   Fix: switch production viewer to react-native-video.\n\n' +
             '❌ Both freeze\n' +
             '   → The URI/codec is the root cause, not the library.\n' +
             '   Check codec, content:// throttle, or partial file in Screen A.'}
          </Text>
        </View>

        <TouchableOpacity
          style={s.btnNav}
          onPress={() => router.push({ pathname: '/test-video-direct', params: { id } })}
        >
          <Text style={s.btnNavText}>← Test Screen B — expo-video direct content://</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.btnNav}
          onPress={() => router.push({ pathname: '/test-video', params: { id } })}
        >
          <Text style={s.btnNavText}>← Test Screen A — copy then play</Text>
        </TouchableOpacity>
      </ScrollView>

      {(phase === 'finding' || phase === 'measuring') && (
        <View style={s.loadOverlay}>
          <ActivityIndicator color="#00C48C" size="large" />
          <Text style={s.loadText}>{phase}…</Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={s.loadOverlay}>
          <Ionicons name="alert-circle" size={48} color="#ff4444" />
          <Text style={s.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, warn && s.rowWarn]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  back: {
    position: 'absolute', top: 48, left: 16, zIndex: 200,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '55%',
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  overlayContent: { padding: 14, gap: 6 },
  title: { color: '#00C48C', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 6 },
  row: { gap: 2 },
  rowLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { color: '#fff', fontSize: 11, lineHeight: 16 },
  rowWarn: { color: '#ff6b6b' },
  box: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: 10,
  },
  boxTitle: { color: '#00C48C', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  boxText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, lineHeight: 16 },
  tabs: {
    position: 'absolute', top: 48, left: 64, right: 16, zIndex: 200,
    flexDirection: 'row', gap: 6,
  },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#00C48C', borderColor: '#00C48C' },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: '#000' },
  btnNav: {
    marginTop: 6,
    backgroundColor: 'rgba(0,196,140,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,196,140,0.35)',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  btnNavText: { color: '#00C48C', fontSize: 12, fontWeight: '600' },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadText: { color: '#fff', fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 },
});
