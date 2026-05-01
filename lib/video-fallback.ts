/**
 * 5-Layer Video Fallback System for Android 11+
 *
 * Layer 1: Direct content:// URI — fastest (viewer feeds ExoPlayer directly)
 * Layer 2: SAF → cacheDirectory copy — reliable (serialized queue, 2 attempts)
 * Layer 3: SAF → documentDirectory copy — persists across cache clears
 * Layer 4: Native Android Intent player — opens externally, OEM-safe
 * Layer 5: MediaLibrary save → fresh content:// — nuclear last resort
 *
 * Layers 1+2 are handled inside MediaContext (prepareStatusForViewing).
 * Layers 3–5 are provided here and called from viewer.tsx when 1+2 fail.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, ToastAndroid } from 'react-native';

export type VideoLayer = 1 | 2 | 3 | 4 | 5;

export interface LayerResult {
  uri: string | null;
  openedExternally: boolean;
  layer: VideoLayer;
  error?: string;
}

function toSafeId(id: string): string {
  return id.replace(/[:\/\\?%*|"<>]/g, '_');
}

function ext(name: string, type: 'video' | 'image' = 'video'): string {
  const parts = name.split('.');
  const e = parts.length > 1 ? parts.pop()! : '';
  return e || (type === 'video' ? 'mp4' : 'jpg');
}

// ── LAYER 3: documentDirectory copy ──────────────────────────────────────────
// Different from cacheDirectory (Layer 2): the OS never auto-evicts the
// documentDirectory. Good for playback on devices that purge caches aggressively
// (MIUI / HyperOS). The file persists across restarts so second-time views
// are instant even if the cache was cleared.
export async function runLayer3(
  sourceUri: string,
  id: string,
  name: string,
  type: 'video' | 'image' = 'video',
): Promise<string | null> {
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return null;

    const vcacheDir = `${docDir}vcache/`;
    await FileSystem.makeDirectoryAsync(vcacheDir, { intermediates: true });

    const destUri = `${vcacheDir}doc_${toSafeId(id)}.${ext(name, type)}`;

    // Return immediately if already cached
    try {
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists && (info as any).size > 0) {
        __DEV__ && console.log(`[Layer3] Cache hit: ${name}`);
        return destUri;
      }
    } catch {}

    __DEV__ && console.log(`[Layer3] Copying to documentDirectory: ${name}`);
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    const verify = await FileSystem.getInfoAsync(destUri);
    if (verify.exists && (verify as any).size > 0) {
      __DEV__ && console.log(`[Layer3] Copy successful: ${name}`);
      return destUri;
    }

    try { await FileSystem.deleteAsync(destUri, { idempotent: true }); } catch {}
    return null;
  } catch (e) {
    __DEV__ && console.log(`[Layer3] Failed for ${name}:`, e);
    return null;
  }
}

// ── LAYER 4: Native Android Intent player ────────────────────────────────────
// Opens the video in whatever the system video player is (MX Player, Google
// Photos, VLC, etc.). Works on 100% of Android devices — the OS owns the
// playback so codec/driver issues don't affect us. The user watches the clip
// externally; we consider this a success from a UX standpoint.
export async function runLayer4(fileUri: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    __DEV__ && console.log(`[Layer4] Launching native player for: ${fileUri}`);
    await (IntentLauncher as any).startActivityAsync('android.intent.action.VIEW', {
      data: fileUri,
      type: 'video/*',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
    __DEV__ && console.log('[Layer4] Native player launched successfully');
    return true;
  } catch (e) {
    __DEV__ && console.log('[Layer4] Native player launch failed:', e);
    return false;
  }
}

// ── LAYER 5: MediaLibrary save → fresh content:// URI ────────────────────────
// Creates a permanent gallery asset from the cached file. This gives us a
// properly-indexed content:// URI that ExoPlayer can always open (it goes
// through the system MediaStore, not SAF). Side-effect: the status clip
// appears in the user's gallery — we show a toast to explain why.
export async function runLayer5(fileUri: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      __DEV__ && console.log('[Layer5] MediaLibrary permission denied');
      return null;
    }

    __DEV__ && console.log(`[Layer5] Creating MediaLibrary asset from: ${fileUri}`);
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    if (asset?.uri) {
      __DEV__ && console.log(`[Layer5] Asset created: ${asset.uri}`);
      ToastAndroid.show('Video saved to gallery for playback', ToastAndroid.SHORT);
      return asset.uri;
    }
    return null;
  } catch (e) {
    __DEV__ && console.log('[Layer5] MediaLibrary save failed:', e);
    return null;
  }
}

// ── FULL FALLBACK CHAIN: Layer 3 → 4 → 5 ────────────────────────────────────
// Called when Layers 1+2 (direct play + cache copy) have already failed.
// `sourceUri` is the original content:// URI or any file:// URI we have.
// `startAtLayer` lets callers skip layers that have already been tried.
export async function runFallbackChain(
  sourceUri: string,
  id: string,
  name: string,
  type: 'video' | 'image' = 'video',
  startAtLayer: VideoLayer = 3,
): Promise<LayerResult> {
  // Layer 3 ──────────────────────────────────────────────────────────────────
  if (startAtLayer <= 3) {
    const l3 = await runLayer3(sourceUri, id, name, type);
    if (l3) return { uri: l3, openedExternally: false, layer: 3 };
  }

  // Layer 4: native intent ───────────────────────────────────────────────────
  // Try with the original content:// URI first; it works on some OEMs where
  // the MediaStore has it indexed. If we have a file:// from a failed L3
  // partial copy, try that too (expo FileProvider covers app directories).
  if (startAtLayer <= 4) {
    const opened = await runLayer4(sourceUri);
    if (opened) return { uri: null, openedExternally: true, layer: 4 };
  }

  // Layer 5: MediaLibrary save ───────────────────────────────────────────────
  // We need a file:// to create the asset. Try a fresh Layer 3 copy first
  // (documents dir), then fall back to saving the content:// URI directly.
  if (startAtLayer <= 5) {
    let fileForAsset: string | null = null;
    if (!sourceUri.startsWith('file://')) {
      fileForAsset = await runLayer3(sourceUri, id, name, type).catch(() => null);
    } else {
      fileForAsset = sourceUri;
    }

    const l5Uri = fileForAsset
      ? await runLayer5(fileForAsset)
      : await runLayer5(sourceUri);

    if (l5Uri) return { uri: l5Uri, openedExternally: false, layer: 5 };
  }

  return {
    uri: null,
    openedExternally: false,
    layer: 5,
    error: 'All 5 layers exhausted',
  };
}

// ── CLEANUP: Remove document cache files older than maxAgeMs ─────────────────
export async function cleanupDocumentCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return;

    const vcacheDir = `${docDir}vcache/`;
    let files: string[];
    try {
      files = await FileSystem.readDirectoryAsync(vcacheDir);
    } catch {
      return;
    }

    const now = Date.now();
    for (const file of files) {
      const fileUri = `${vcacheDir}${file}`;
      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        const age = info.modificationTime
          ? now - info.modificationTime * 1000
          : now;
        if (age > maxAgeMs) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      } catch {}
    }
  } catch {}
}
