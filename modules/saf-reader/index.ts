/**
 * SafReader — SAF file scanner powered by react-native-saf-x.
 *
 * PLUGIN-FREE: react-native-saf-x uses React Native autolinking — no custom
 * Java module, no app.json plugin entry, no crash-prone manual registration.
 *
 * Key advantages over the old custom Java module:
 *   • listFiles() returns real file sizes + lastModified for every entry.
 *     This fixes the "copy-verification with unknown size" bug where the old
 *     JS fallback set size=0 and accepted partial video copies.
 *   • BFS runs in JS on the RN thread — no ExecutorService lifecycle to manage.
 *   • Works in Expo Go (graceful no-op when SafX native module is absent).
 *
 * Functions that require the native SafX module (EAS / custom dev build):
 *   scanForStatuses, batchCheckFiles, copyFileToCache, cleanupCacheDir,
 *   batchDeleteFiles — all fall back gracefully when unavailable.
 *
 * generateThumbnail / preCopyAll / cancelPreCopy:
 *   generateThumbnail always rejects so thumbnail-cache falls through to the
 *   expo-video-thumbnails JS path (same quality, hardware-accelerated on device).
 *   preCopyAll / cancelPreCopy are no-ops — on-demand copy in the viewer
 *   is the only copy path needed.
 */
import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SAF from 'react-native-saf-x';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NativeSafFile {
  uri: string;
  name: string;
  mimeType: string;
  modTime: number;
  size: number;
}

export interface NativeDocumentInfo {
  name: string;
  size: number;
  modTime: number;
  mimeType: string;
}

export interface NativeCacheCheck {
  exists: boolean;
  size: number;
}

export interface NativeBatchFileEntry {
  path: string;
  exists: boolean;
  size: number;
}

export interface PreCopyItem {
  uri: string;
  id: string;
  name: string;
}

// ── Availability ──────────────────────────────────────────────────────────────

// react-native-saf-x registers itself as NativeModules.SafX via autolinking.
// In Expo Go or web the native module is absent so we degrade gracefully.
const isSafXLinked =
  Platform.OS === 'android' && !!NativeModules.SafX;

/** True when the react-native-saf-x native module is linked (EAS / custom build). */
export function isAvailable(): boolean {
  return isSafXLinked;
}

// ── File validation helper ────────────────────────────────────────────────────

const VALID_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.mkv', '.3gp', '.mov',
]);

function isValidStatusFile(name: string): boolean {
  if (name.startsWith('.')) return false;
  const dot = name.lastIndexOf('.');
  if (dot === -1) return true; // no extension — allow
  return VALID_EXTS.has(name.slice(dot).toLowerCase());
}

// ── BFS scanner ───────────────────────────────────────────────────────────────

// Folder names the BFS is allowed to descend into.
// Any folder whose name starts with "com.whatsapp" is also allowed (covers
// WA Business, GB WhatsApp, WhatsApp Plus, etc.)
const KNOWN_INTERMEDIATE = new Set([
  'android', 'media',
  'whatsapp', 'whatsapp business',
]);
const BFS_MAX_DEPTH = 7;
const BFS_TIMEOUT_MS = 5000;

async function bfsFindAndCollect(
  uri: string,
  depth: number,
  results: NativeSafFile[],
  deadline: number,
): Promise<void> {
  if (depth > BFS_MAX_DEPTH || Date.now() > deadline) return;

  let entries: SAF.DocumentFileDetail[];
  try {
    entries = await SAF.listFiles(uri);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (Date.now() > deadline) return;

    if (entry.name === '.Statuses' && entry.type === 'directory') {
      // Found a .Statuses folder — collect all valid media files inside it
      try {
        const files = await SAF.listFiles(entry.uri);
        for (const file of files) {
          if (file.type === 'file' && isValidStatusFile(file.name)) {
            results.push({
              uri: file.uri,
              name: file.name,
              mimeType: file.mime || '',
              modTime: file.lastModified || 0,
              size: file.size || 0,
            });
          }
        }
      } catch {}
      // Don't descend deeper from .Statuses
    } else if (entry.type === 'directory') {
      const nameLower = entry.name.toLowerCase();
      if (
        KNOWN_INTERMEDIATE.has(nameLower) ||
        nameLower.startsWith('com.whatsapp')
      ) {
        await bfsFindAndCollect(entry.uri, depth + 1, results, deadline);
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan a granted SAF tree URI for WhatsApp .Statuses files.
 *
 * Uses react-native-saf-x listFiles() for BFS traversal. Returns each file
 * with a real size and lastModified so downstream copy-verification can use
 * the strong ≥ 99% check instead of the weak > 100 KB heuristic.
 *
 * Supports:
 *   • Android/media root grant (covers WA + WA Business + GB WA + WA Plus)
 *   • Specific WhatsApp or WhatsApp Business folder grants
 *   • Legacy .Statuses direct grants
 */
export async function scanForStatuses(treeUri: string): Promise<NativeSafFile[]> {
  if (!isSafXLinked) return [];
  const results: NativeSafFile[] = [];
  const deadline = Date.now() + BFS_TIMEOUT_MS;
  try {
    await bfsFindAndCollect(treeUri, 0, results, deadline);
  } catch {}
  return results;
}

/**
 * Copy a SAF content:// file to a local cache path.
 *
 * Uses expo-file-system copyAsync (handles ContentResolver correctly on all
 * Android versions). The dest path must include file:// prefix or not — both
 * work; copyAsync normalises the URI internally.
 */
export async function copyFileToCache(contentUri: string, destPath: string): Promise<string> {
  const dest = destPath.startsWith('file://') ? destPath : `file://${destPath}`;
  await FileSystem.copyAsync({ from: contentUri, to: dest });
  return dest;
}

/**
 * Fetch metadata for a SAF document URI.
 * Uses react-native-saf-x stat() — a single ContentResolver cursor query.
 */
export async function getDocumentInfo(contentUri: string): Promise<NativeDocumentInfo> {
  if (!isSafXLinked) throw new Error('SafX native module not linked');
  const detail = await SAF.stat(contentUri);
  return {
    name: detail.name,
    size: detail.size,
    modTime: detail.lastModified,
    mimeType: detail.mime,
  };
}

/**
 * generateThumbnail — always rejects so thumbnail-cache.ts falls through to
 * expo-video-thumbnails (hardware-accelerated, works on all builds).
 * Thumbnails do not require the native SafReader Java module.
 */
export function generateThumbnail(
  _videoPath: string,
  _destPath: string,
  _timeMs = 0,
): Promise<string> {
  return Promise.reject(new Error('generateThumbnail: use expo-video-thumbnails fallback'));
}

/**
 * preCopyAll — no-op.
 * On-demand copy in the viewer is the only path needed; background
 * pre-copying adds I/O bus pressure without measurable user benefit.
 */
export function preCopyAll(_cacheDirPath: string, _items: PreCopyItem[]): Promise<number> {
  return Promise.resolve(0);
}

/** cancelPreCopy — no-op (preCopyAll is never started). */
export function cancelPreCopy(): Promise<null> {
  return Promise.resolve(null);
}

/**
 * Fast file-stat for a local cached file.
 * Uses expo-file-system getInfoAsync — reliable on all builds.
 */
export async function checkCachedFile(filePath: string): Promise<NativeCacheCheck> {
  try {
    const path = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    const info = await FileSystem.getInfoAsync(path);
    return {
      exists: info.exists,
      size: info.exists ? ((info as any).size ?? 0) : 0,
    };
  } catch {
    return { exists: false, size: 0 };
  }
}

/**
 * Batch file-stat: stats all paths in parallel using expo-file-system.
 * Returns results in the same order as the input array.
 */
export async function batchCheckFiles(paths: string[]): Promise<NativeBatchFileEntry[]> {
  const checks = await Promise.allSettled(
    paths.map(async (p) => {
      const uri = p.startsWith('file://') ? p : `file://${p}`;
      const info = await FileSystem.getInfoAsync(uri);
      return {
        path: p,
        exists: info.exists,
        size: info.exists ? ((info as any).size ?? 0) : 0,
      };
    }),
  );
  return checks.map((c, i) =>
    c.status === 'fulfilled'
      ? c.value
      : { path: paths[i], exists: false, size: 0 },
  );
}

/**
 * Delete all files in dirPath whose name starts with one of `prefixes`
 * AND that are older than maxAgeMs milliseconds.
 * Returns the number of files deleted.
 */
export async function cleanupCacheDir(
  dirPath: string,
  prefixes: string[],
  maxAgeMs: number,
): Promise<number> {
  try {
    const dir = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const dirUri = dir.startsWith('file://') ? dir : `file://${dir}`;
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists) return 0;

    const entries = await FileSystem.readDirectoryAsync(dirUri);
    const now = Date.now();
    let deleted = 0;

    await Promise.allSettled(
      entries.map(async (name) => {
        const matchesPrefix = prefixes.some(p => name.startsWith(p));
        if (!matchesPrefix) return;
        const fileUri = `${dirUri}${name}`;
        try {
          const fi = await FileSystem.getInfoAsync(fileUri);
          const mtime: number = (fi as any).modificationTime
            ? (fi as any).modificationTime * 1000
            : 0;
          if (fi.exists && mtime > 0 && now - mtime > maxAgeMs) {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            deleted += 1;
          }
        } catch {}
      }),
    );
    return deleted;
  } catch {
    return 0;
  }
}

/**
 * Delete multiple local files in one call (parallel).
 * Non-existent files are silently skipped.
 * Returns the count of files successfully deleted.
 */
export async function batchDeleteFiles(paths: string[]): Promise<number> {
  let deleted = 0;
  await Promise.allSettled(
    paths.map(async (p) => {
      try {
        const uri = p.startsWith('file://') ? p : `file://${p}`;
        await FileSystem.deleteAsync(uri, { idempotent: true });
        deleted += 1;
      } catch {}
    }),
  );
  return deleted;
}
