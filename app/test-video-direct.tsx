/**
 * TEST SCREEN B — direct content:// playback (NO copy, NO cache)
 *
 * Passes the original SAF content:// URI straight into expo-video.
 * No prepareStatusForViewing(). No FileSystem.copyAsync(). No temp file.
 *
 * Purpose:
 *   Test Screen A (copy then play) showed a freeze. This screen tells us
 *   whether the freeze is in the COPY PATH or in expo-video itself.
 *
 *   ┌────────────────────────────────────────────────────────────────────┐
 *   │ If THIS screen plays without freezing:                             │
 *   │   → expo-video handles content:// fine on Android 11+             │
 *   │   → the freeze is in the copy (partial file or cache write issue)  │
 *   │   → FIX: skip the copy entirely for playback; play content:// raw  │
 *   │                                                                    │
 *   │ If THIS screen ALSO freezes:                                       │
 *   │   → expo-video itself cannot sustain playback on this device       │
 *   │   → the freeze is in Media3/ExoPlayer on this Android/OEM build    │
 *   │   → FIX: file an issue against expo-video or switch player library │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Note: WhatsApp's SAF DocumentProvider may throttle reads.
 * If content:// plays the first 1s then also freezes → buffer starvation
 * from WhatsApp's slow ContentProvider → copy IS required but must be 100%
 * complete before the player mounts (size-match check in Test Screen A).
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet,
  TouchableOpacity, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
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
// DirectPlayer — renders a single VideoView with the raw content:// URI.
// ─────────────────────────────────────────────────────────────────────────────
function DirectPlayer({
  contentUri,
  onStatus,
}: { contentUri: string; onStatus: (s: string) => void }) {
  const player = useVideoPlayer({ uri: contentUri }, (p) => {
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
export default function TestVideoDirectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { statuses, savedItems } = useMedia();

  type Phase = 'finding' | 'measuring' | 'ready' | 'error';
  const [phase, setPhase] = useState<Phase>('finding');
  const [contentUri, setContentUri] = useState('');
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

    const uri: string = 'localUri' in item ? (item as any).localUri : item.uri;
    setContentUri(uri);
    setIsSAF(uri.startsWith('content://'));

    // Measure the source size from ContentResolver before creating the player.
    setPhase('measuring');
    measureSize(uri).then((sz) => {
      setSrcSize(sz);
      setPhase('ready');
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const verdict =
    playerStatus === '—' ? 'waiting for player…' :
    playerStatus.startsWith('readyToPlay') ? '▶ readyToPlay — playing' :
    playerStatus.startsWith('loading') ? '⏳ loading' :
    playerStatus.startsWith('idle') ? '⏸ idle' :
    playerStatus.includes('error') ? `❌ error: ${playerStatus}` :
    playerStatus;

  return (
    <View style={s.root}>
      {/* Back */}
      <TouchableOpacity style={s.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Video */}
      {phase === 'ready' && contentUri && (
        <DirectPlayer
          key={contentUri}
          contentUri={contentUri}
          onStatus={setPlayerStatus}
        />
      )}

      {/* Info overlay */}
      <ScrollView
        style={s.overlay}
        contentContainerStyle={s.overlayContent}
        pointerEvents="box-none"
      >
        <Text style={s.title}>TEST SCREEN B — direct content:// (NO COPY)</Text>
        <Text style={s.sub}>Android API {Platform.Version} · {phase}</Text>

        <Row label="URI type" value={isSAF ? 'SAF content:// (Android 11+)' : 'file:// (Android ≤10 or saved)'} />
        <Row label="Source URI" value={contentUri.slice(0, 140)} />
        <Row
          label="Source size (ContentResolver)"
          value={srcSize != null ? fmt(srcSize) : '…'}
          warn={srcSize === 0 || srcSize === -2}
        />
        <Row
          label="Player status"
          value={verdict}
          warn={playerStatus.includes('error')}
        />

        <View style={s.box}>
          <Text style={s.boxTitle}>HOW TO READ THIS SCREEN</Text>
          <Text style={s.boxText}>
            {'✅ Plays without freeze → expo-video handles content:// fine.\n' +
             '   The production freeze is in the COPY (partial file).\n' +
             '   Fix: remove the cache copy for playback; use content:// directly.\n\n' +
             '❌ Freezes at ~1s → same as Test Screen A.\n' +
             '   WhatsApp ContentProvider throttles reads → buffer starvation.\n' +
             '   The COPY is required AND must be 100% complete (size match).\n' +
             '   Check Test Screen A size-match row to confirm.'}
          </Text>
        </View>

        <TouchableOpacity
          style={s.btn2}
          onPress={() => router.push({ pathname: '/test-video', params: { id } })}
        >
          <Text style={s.btn2Text}>← Back to Test Screen A (copy then play)</Text>
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
  title: { color: '#FFB800', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
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
  boxTitle: { color: '#FFB800', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  boxText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, lineHeight: 16 },
  btn2: {
    marginTop: 10,
    backgroundColor: 'rgba(0,196,140,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,196,140,0.4)',
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
