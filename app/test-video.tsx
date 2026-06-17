/**
 * TEST SCREEN A — copy-then-play (same path as production)
 *
 * Measures and displays:
 *   - Source size from ContentResolver BEFORE copy
 *   - Destination file size AFTER copy
 *   - Whether they match
 *   - How long the copy took
 *
 * If source ≠ dest → the copy is partial → that IS the freeze cause.
 * If source = dest AND the video still freezes → expo-video cannot play
 *   local file:// URIs from the app cache on this device/Android version.
 *   → Test Screen B (test-video-direct) will tell us if content:// works.
 *
 * Navigate here from the production viewer (green flask icon, DEV builds only).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet,
  TouchableOpacity, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import { useMedia, StatusItem } from '@/contexts/MediaContext';
import { Ionicons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// Size measurement helper — works on both content:// and file:// URIs.
// For content:// URIs expo-file-system calls
//   ContentResolver.query(uri, [OpenableColumns.SIZE], ...)
// which WhatsApp's DocumentProvider answers with the untruncated file size.
// ─────────────────────────────────────────────────────────────────────────────
async function measureSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri as any);
    return (info as any).size ?? -1;
  } catch (e: any) {
    return -2; // -2 = getInfoAsync threw
  }
}

function fmt(n: number): string {
  if (n === -1) return 'unknown (getInfoAsync returned no size)';
  if (n === -2) return 'ERROR (getInfoAsync threw)';
  if (n === 0) return '0 bytes ⚠️ EMPTY FILE';
  return `${n.toLocaleString()} bytes (${(n / 1024 / 1024).toFixed(2)} MB)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MinimalPlayer — created only once fileUri is confirmed non-empty.
// ─────────────────────────────────────────────────────────────────────────────
function MinimalPlayer({
  fileUri, onStatus,
}: { fileUri: string; onStatus: (s: string) => void }) {
  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    p.play(); // sets Media3 playWhenReady=true
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', (e: any) => {
      onStatus(e.status + (e.error ? ` — ${e.error.message}` : ''));
    });
    return () => { sub.remove(); try { player.release(); } catch {} };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={false}
      contentFit="contain"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function TestVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statuses, savedItems, prepareStatusForViewing } = useMedia();

  type Phase = 'finding' | 'measuring-src' | 'copying' | 'measuring-dest' | 'ready' | 'error';
  const [phase, setPhase] = useState<Phase>('finding');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState('—');
  const [errorMsg, setErrorMsg] = useState('');

  // Measurement values
  const [srcUri, setSrcUri] = useState('');
  const [srcSize, setSrcSize] = useState<number | null>(null);
  const [destSize, setDestSize] = useState<number | null>(null);
  const [copyMs, setCopyMs] = useState<number | null>(null);
  const copyStart = useRef(0);

  useEffect(() => {
    if (!id) { setPhase('error'); setErrorMsg('No id param'); return; }

    const item: StatusItem | undefined =
      statuses.find(s => s.id === id || decodeURIComponent(s.id) === id) ??
      (savedItems.find(s => s.id === id || decodeURIComponent(s.id) === id) as StatusItem | undefined);

    if (!item) { setPhase('error'); setErrorMsg(`Item not found: ${id}`); return; }
    if (item.type !== 'video') { setPhase('error'); setErrorMsg('Not a video'); return; }

    const contentUri: string = 'localUri' in item ? (item as any).localUri : item.uri;
    setSrcUri(contentUri);

    const isSAF = contentUri.startsWith('content://');

    if (!isSAF) {
      // Android ≤10 / saved item — file:// path, no copy needed.
      setSrcSize(-3); // -3 = not applicable
      setDestSize(-3);
      setFileUri(contentUri);
      setPhase('ready');
      return;
    }

    // ── Step 1: measure source via ContentResolver ───────────────────────────
    setPhase('measuring-src');
    measureSize(contentUri).then((ss) => {
      setSrcSize(ss);

      // ── Step 2: copy ─────────────────────────────────────────────────────
      setPhase('copying');
      copyStart.current = Date.now();

      prepareStatusForViewing(item, { forPlayback: true })
        .then(async (uri) => {
          const elapsed = Date.now() - copyStart.current;
          setCopyMs(elapsed);

          if (!uri) {
            setPhase('error');
            setErrorMsg('prepareStatusForViewing returned null');
            return;
          }

          // ── Step 3: measure destination ──────────────────────────────────
          setPhase('measuring-dest');
          const ds = await measureSize(uri);
          setDestSize(ds);
          setFileUri(uri);
          setPhase('ready');
        })
        .catch((e: any) => {
          setPhase('error');
          setErrorMsg(String(e?.message ?? e));
        });
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine if copy is complete
  const sizeMatch =
    srcSize != null && destSize != null &&
    srcSize > 0 && destSize > 0 &&
    destSize >= srcSize * 0.99;

  const sizeLabel =
    srcSize == null || destSize == null ? '—' :
    srcSize === -3 ? 'N/A (no copy)' :
    sizeMatch ? '✅ MATCH — copy is complete' :
    `❌ MISMATCH — partial copy! src=${srcSize} dest=${destSize}`;

  return (
    <View style={s.root}>
      {/* Back */}
      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Video area */}
      {phase === 'ready' && fileUri && !sizeMatch && srcSize !== -3 && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#200', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 }}>
            ❌ Copy size mismatch — file is partial.{'\n'}Player will freeze.
          </Text>
        </View>
      )}
      {phase === 'ready' && fileUri && (sizeMatch || srcSize === -3) && (
        <MinimalPlayer key={fileUri} fileUri={fileUri} onStatus={setPlayerStatus} />
      )}

      {/* Info overlay */}
      <ScrollView
        style={s.overlay}
        contentContainerStyle={s.overlayContent}
        pointerEvents="box-none"
      >
        <Text style={s.title}>TEST SCREEN A — copy then play</Text>
        <Text style={s.sub}>Android API {Platform.Version} · {phase}</Text>

        <Row label="Source URI" value={srcUri.slice(0, 120)} />
        <Row label="Source size (ContentResolver)" value={srcSize != null ? fmt(srcSize) : '…'} warn={srcSize === 0 || srcSize === -2} />
        <Row label="Copy duration" value={copyMs != null ? `${copyMs} ms` : '…'} />
        <Row label="Dest size (file://.../cache)" value={destSize != null ? fmt(destSize) : '…'} warn={destSize === 0 || destSize === -2} />
        <Row label="Size match" value={sizeLabel} warn={!sizeMatch && srcSize !== -3 && srcSize != null} />
        {fileUri && <Row label="Dest URI" value={fileUri.slice(0, 120)} />}
        <Row label="Player status" value={playerStatus} warn={playerStatus.includes('error')} />

        <TouchableOpacity
          style={s.btn2}
          onPress={() => router.push({ pathname: '/test-video-direct', params: { id } })}
        >
          <Text style={s.btn2Text}>→ Open Test Screen B (direct content://)</Text>
        </TouchableOpacity>
      </ScrollView>

      {(phase === 'finding' || phase === 'measuring-src' || phase === 'copying' || phase === 'measuring-dest') && (
        <View style={s.loadOverlay}>
          <ActivityIndicator color="#00C48C" size="large" />
          <Text style={s.loadText}>{phase.replace(/-/g, ' ')}…</Text>
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
  btn2: {
    marginTop: 10,
    backgroundColor: 'rgba(0,196,140,0.15)',
    borderWidth: 1, borderColor: '#00C48C',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  btn2Text: { color: '#00C48C', fontSize: 12, fontWeight: '600' },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadText: { color: '#fff', fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 },
});
