/**
 * Video Fallback System for Android 11+
 *
 * Layer 1: Direct content:// URI — fastest (viewer feeds ExoPlayer directly)
 * Layer 2: SAF → cacheDirectory copy — reliable (serialized queue, 2 attempts)
 * Layer 3: SAF → documentDirectory copy — persists across cache clears
 * Layer 4: MediaLibrary save → fresh content:// — nuclear last resort
 *
 * Layers 1+2 are handled inside MediaContext (prepareStatusForViewing).
 * Layers 3–4 are provided here and called from viewer.tsx when 1+2 fail.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform, ToastAndroid } from 'react-native';

export type VideoLayer = 1 | 2 | 3 | 4;

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

    try {
      const info = await FileSystem.getInfoAsync(destUri);
      if (info.exists && (info as any).size > 0) return destUri;
    } catch {}

    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    const verify = await FileSystem.getInfoAsync(destUri);
    if (verify.exists && (verify as any).size > 0) return destUri;

    try { await FileSystem.deleteAsync(destUri, { idempotent: true }); } catch {}
    return null;
  } catch {
    return null;
  }
}

// ── LAYER 4: MediaLibrary save → fresh content:// URI ────────────────────────
export async function runLayer4(fileUri: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const asset = await MediaLibrary.createAssetAsync(fileUri);
    if (asset?.uri) {
      ToastAndroid.show('Video saved to gallery for playback', ToastAndroid.SHORT);
      return asset.uri;
    }
    return null;
  } catch {
    return null;
  }
}

// ── FULL FALLBACK CHAIN: Layer 3 → 4 ─────────────────────────────────────────
export async function runFallbackChain(
  sourceUri: string,
  id: string,
  name: string,
  type: 'video' | 'image' = 'video',
  startAtLayer: VideoLayer = 3,
): Promise<LayerResult> {
  if (startAtLayer <= 3) {
    const l3 = await runLayer3(sourceUri, id, name, type);
    if (l3) return { uri: l3, openedExternally: false, layer: 3 };
  }

  if (startAtLayer <= 4) {
    let fileForAsset: string | null = null;
    if (!sourceUri.startsWith('file://')) {
      fileForAsset = await runLayer3(sourceUri, id, name, type).catch(() => null);
    } else {
      fileForAsset = sourceUri;
    }

    const l4Uri = fileForAsset
      ? await runLayer4(fileForAsset)
      : await runLayer4(sourceUri);

    if (l4Uri) return { uri: l4Uri, openedExternally: false, layer: 4 };
  }

  return {
    uri: null,
    openedExternally: false,
    layer: 4,
    error: 'All layers exhausted',
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
