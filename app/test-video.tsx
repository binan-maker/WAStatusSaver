/**
 * TEST SCREEN A — copy-then-play with full file measurements
 *
 * Measures file size at three points after prepareStatusForViewing resolves:
 *   T+0 ms  — immediately after the Promise resolves
 *   T+500 ms — half a second later
 *   T+1000 ms — one second later
 *
 * If T+0 shows 0 bytes but T+1000 shows the full size → the Promise is
 * resolving BEFORE the OutputStream is fully flushed to disk (fire-and-forget
 * race between deleteAsync and copyAsync — now fixed by awaiting the delete).
 *
 * If all three show 0 bytes → the copy is silently producing an empty file.
 *
 * If all three show the full size → copy is correct; the freeze is in
 * expo-video itself on this device/Android version → test Screen B (direct
 * content://) will tell us if the player is the problem.
 *
 * Navigate here via the green flask icon in the production viewer (DEV builds).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Read actual file size from disk. No cached metadata — uses a fresh stat. */
async function statFile(uri: string): Promise<{ exists: boolean; size: number; modTime: number | null }> {
  try {
    // Pass MD5 to force expo-file-system to do a real syscall, not return
    // a cached result. The MD5 field is ignored; we only care about exists/size.
    const info = await (FileSystem as any).getInfoAsync(uri, { md5: false, size: true });
    return {
      exists: info.exists ?? false,
      size: (info as any).size ?? 0,
      modTime: (info as any).modificationTime ?? null,
    };
  } catch (e: any) {
    return { exists: false, size: -1, modTime: null };
  }
}

/** Query ContentResolver for the source document's size (no bytes transferred). */
async function statContentUri(uri: string): Promise<number> {
  try {
    const info = await (FileSystem as any).getInfoAsync(uri);
    return (info as any).size ?? -1;
  } catch {
    return -2;
  }
}

function fmtSize(n: number): string {
  if (n === -1) return 'unknown';
  if (n === -2) return 'ERROR (threw)';
  if (n === 0) return '0 bytes ⚠️';
  return `${n.toLocaleString()} bytes (${(n / 1024 / 1024).toFixed(3)} MB)`;
}

function fmtTime(ms: number | null): string {
  if (ms == null) return 'null';
  return new Date(ms * 1000).toISOString().replace('T', ' ').slice(0, 23);
}

// ─────────────────────────────────────────────────────────────────────────────
// MinimalPlayer
// ─────────────────────────────────────────────────────────────────────────────

function MinimalPlayer({ fileUri, onStatus }: { fileUri: string; onStatus: (s: string) => void }) {
  const player = useVideoPlayer({ uri: fileUri }, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
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

interface StatPoint { label: string; exists: boolean; size: number; modTime: number | null }

export default function TestVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statuses, savedItems, prepareStatusForViewing } = useMedia();

  type Phase = 'finding' | 'measuring-src' | 'copying' | 'stat-t0' | 'stat-t500' | 'stat-t1000' | 'ready' | 'error';
  const [phase, setPhase] = useState<Phase>('finding');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState('—');
  const [errorMsg, setErrorMsg] = useState('');

  const [srcUri, setSrcUri] = useState('');
  const [srcSize, setSrcSize] = useState<number | null>(null);
  const [copyMs, setCopyMs] = useState<number | null>(null);
  const [stats, setStats] = useState<StatPoint[]>([]);

  const copyStart = useRef(0);

  const addStat = useCallback((point: StatPoint) => {
    setStats(prev => [...prev, point]);
  }, []);

  useEffect(() => {
    if (!id) { setPhase('error'); setErrorMsg('No id param'); return; }

    const item: StatusItem | undefined =
      statuses.find(s => s.id === id || decodeURIComponent(s.id) === id) ??
      (savedItems.find(s => s.id === id || decodeURIComponent(s.id) === id) as StatusItem | undefined);

    if (!item) { setPhase('error'); setErrorMsg(`Item not found: ${id}`); return; }
    if (item.type !== 'video') { setPhase('error'); setErrorMsg('Not a video'); return; }

    const uri: string = 'localUri' in item ? (item as any).localUri : item.uri;
    setSrcUri(uri);
    const isSAF = uri.startsWith('content://');

    if (!isSAF) {
      setSrcSize(-3);
      setFileUri(uri);
      setPhase('ready');
      return;
    }

    let cancelled = false;

    (async () => {
      // Step 1: measure source from ContentResolver
      setPhase('measuring-src');
      const ss = await statContentUri(uri);
      if (cancelled) return;
      setSrcSize(ss);

      // Step 2: copy via prepareStatusForViewing
      setPhase('copying');
      copyStart.current = Date.now();
      let destUri: string;
      try {
        destUri = await prepareStatusForViewing(item, { forPlayback: true });
      } catch (e: any) {
        if (!cancelled) { setPhase('error'); setErrorMsg(String(e?.message ?? e)); }
        return;
      }
      if (cancelled) return;
      if (!destUri) { setPhase('error'); setErrorMsg('prepareStatusForViewing returned null'); return; }

      const elapsed = Date.now() - copyStart.current;
      setCopyMs(elapsed);

      // Step 3: stat at T+0 (immediately after Promise resolves)
      setPhase('stat-t0');
      const s0 = await statFile(destUri);
      addStat({ label: 'T+0 ms (immediately after resolve)', ...s0 });

      // Step 4: stat at T+500 ms
      setPhase('stat-t500');
      await new Promise(r => setTimeout(r, 500));
      if (cancelled) return;
      const s500 = await statFile(destUri);
      addStat({ label: 'T+500 ms', ...s500 });

      // Step 5: stat at T+1000 ms
      setPhase('stat-t1000');
      await new Promise(r => setTimeout(r, 500));
      if (cancelled) return;
      const s1000 = await statFile(destUri);
      addStat({ label: 'T+1000 ms', ...s1000 });

      if (cancelled) return;
      setFileUri(destUri);
      setPhase('ready');
    })();

    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine overall copy health
  const finalStat = stats[stats.length - 1];
  const sizeOk = srcSize != null && srcSize > 0 && finalStat != null &&
    finalStat.size >= srcSize * 0.99;
  const sizeVerdict =
    stats.length === 0 ? '—' :
    !finalStat?.exists ? '❌ FILE DOES NOT EXIST at T+1000' :
    finalStat.size === 0 ? '❌ FILE IS 0 BYTES at T+1000' :
    sizeOk ? '✅ COMPLETE — sizes match' :
    `❌ PARTIAL — src=${srcSize} final=${finalStat.size}`;

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ── Tab strip ── always visible, no scrolling needed */}
      <View style={s.tabs}>
        <View style={[s.tab, s.tabActive]}>
          <Text style={[s.tabText, s.tabTextActive]}>A  copy+play</Text>
        </View>
        <TouchableOpacity
          style={s.tab}
          onPress={() => router.replace({ pathname: '/test-video-direct', params: { id } })}
        >
          <Text style={s.tabText}>B  direct</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.tab}
          onPress={() => router.replace({ pathname: '/test-video-rnv', params: { id } })}
        >
          <Text style={s.tabText}>C  rnv</Text>
        </TouchableOpacity>
      </View>

      {/* Video — only mount after all stats are collected */}
      {phase === 'ready' && fileUri && (sizeOk || srcSize === -3) && (
        <MinimalPlayer key={fileUri} fileUri={fileUri} onStatus={setPlayerStatus} />
      )}
      {phase === 'ready' && fileUri && !sizeOk && srcSize !== -3 && (
        <View style={[StyleSheet.absoluteFill, s.badFileBg]}>
          <Text style={s.badFileText}>❌ File is partial or empty — player not mounted to avoid freeze</Text>
        </View>
      )}

      {/* Info strip */}
      <ScrollView style={s.overlay} contentContainerStyle={s.overlayContent} pointerEvents="box-none">
        <Text style={s.title}>TEST SCREEN A — copy then stat then play</Text>
        <Text style={s.sub}>Android API {Platform.Version} · phase: {phase}</Text>

        <Row label="Source URI" value={srcUri.slice(0, 110)} />
        <Row
          label="Source size (ContentResolver)"
          value={srcSize != null ? fmtSize(srcSize) : '…'}
          warn={srcSize === 0 || srcSize === -2}
        />
        <Row label="Copy duration" value={copyMs != null ? `${copyMs} ms` : '…'} />

        {stats.map((st, i) => (
          <View key={i} style={s.statBlock}>
            <Text style={s.statLabel}>{st.label}</Text>
            <Text style={[s.statValue, (!st.exists || st.size === 0) && s.warn]}>
              exists={String(st.exists)}  size={fmtSize(st.size)}
            </Text>
            <Text style={s.statMtime}>modTime={fmtTime(st.modTime)}</Text>
          </View>
        ))}

        <Row label="Copy verdict" value={sizeVerdict} warn={!sizeOk && srcSize !== -3 && srcSize != null} />
        {fileUri && <Row label="Dest URI" value={fileUri.slice(0, 110)} />}
        <Row label="Player status" value={playerStatus} warn={playerStatus.includes('error')} />

        <TouchableOpacity
          style={s.btn2}
          onPress={() => router.push({ pathname: '/test-video-direct', params: { id } })}
        >
          <Text style={s.btn2Text}>→ Test Screen B — direct content:// (no copy)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Loading overlay */}
      {phase !== 'ready' && phase !== 'error' && (
        <View style={s.loadOverlay} pointerEvents="none">
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
      <Text style={[s.rowValue, warn && s.warn]}>{value}</Text>
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
    position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '65%',
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  overlayContent: { padding: 14, gap: 6 },
  title: { color: '#00C48C', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 6 },
  row: { gap: 2 },
  rowLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { color: '#fff', fontSize: 11, lineHeight: 16 },
  warn: { color: '#ff6b6b' },
  statBlock: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 6, padding: 7, gap: 2,
  },
  statLabel: { color: '#FFB800', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: '#fff', fontSize: 11 },
  statMtime: { color: 'rgba(255,255,255,0.4)', fontSize: 9 },
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
  tabActive: {
    backgroundColor: '#00C48C',
    borderColor: '#00C48C',
  },
  tabText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: '#000' },
  btn2: {
    marginTop: 10, backgroundColor: 'rgba(0,196,140,0.1)',
    borderWidth: 1, borderColor: '#00C48C',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  btn2Text: { color: '#00C48C', fontSize: 12, fontWeight: '600' },
  loadOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadText: { color: '#fff', fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 },
  badFileBg: { alignItems: 'center', justifyContent: 'center' },
  badFileText: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', padding: 24 },
});
