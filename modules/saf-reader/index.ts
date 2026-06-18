/**
 * SafReader — SAF file scanner that returns tree-qualified content:// URIs.
 *
 * CRITICAL: All URIs returned by scanForStatuses MUST be tree-qualified:
 *   content://com.android.externalstorage.documents/tree/<tree>/document/<doc>
 *
 * Bare /document/ URIs (returned by react-native-saf-x's listFiles) do NOT
 * carry the grant context, so Android denies every read → images and videos
 * render blank. expo-file-system's readDirectoryAsync always returns
 * tree-qualified URIs, which is why this module uses it for the BFS scan.
 *
 * react-native-saf-x is kept for stat(), copyFile(), and other utilities
 * that accept either URI format, but is NOT used for directory traversal.
 *
 * isAvailable() returns true on all Android builds (Expo Go, dev-client, EAS)
 * because the scan uses expo-file-system which is always present — no
 * NativeModules gate needed.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NativeSafFile {
  uri: string;    // tree-qualified content:// URI — safe for expo-image / ExoPlayer
  name: string;
  mimeType: string;
  modTime: number;
  size: number;   // 0 at scan time; lazy-fetched by copy-verification when needed
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

/**
 * Always true on Android — the scan uses expo-file-system which is present
 * in every build. No native module gate needed.
 */
export function isAvailable(): boolean {
  return Platform.OS === 'android';
}

// ── File validation ────────────────────────────────────────────────────────────

const VALID_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4', '.mkv', '.3gp', '.mov',
]);

function isValidStatusFile(name: string): boolean {
  if (name.startsWith('.')) return false;
  const dot = name.lastIndexOf('.');
  if (dot === -1) return true;
  return VALID_EXTS.has(name.slice(dot).toLowerCase());
}

// ── SAF URI → filename ────────────────────────────────────────────────────────
// Tree-qualified SAF URIs end with the document ID, which uses ':' as the
// separator between volume and path. The filename is the last ':' or '/'
// segment after decoding.
function safUriToFileName(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const lastColon = decoded.lastIndexOf(':');
  const lastSlash = decoded.lastIndexOf('/');
  const pos = Math.max(lastColon, lastSlash);
  return pos >= 0 ? decoded.slice(pos + 1) : decoded;
}

// ── BFS scanner ───────────────────────────────────────────────────────────────

// Folder names the BFS is allowed to descend into. Any folder whose name
// starts with 'com.whatsapp' is also allowed (covers WA Business, GB WhatsApp,
// WhatsApp Plus, etc.)
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

  let entries: string[];
  try {
    entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (Date.now() > deadline) return;
    const name = safUriToFileName(entry);

    if (name === '.Statuses') {
      // Found a .Statuses folder — collect all valid media files inside it.
      // entry is already a tree-qualified URI.
      let files: string[];
      try {
        files = await FileSystem.StorageAccessFramework.readDirectoryAsync(entry);
      } catch {
        continue;
      }
      for (const file of files) {
        const fileName = safUriToFileName(file);
        if (isValidStatusFile(fileName)) {
          results.push({
            uri: file,      // tree-qualified URI — works with expo-image + ExoPlayer
            name: fileName,
            mimeType: '',
            modTime: 0,
            size: 0,        // lazily fetched during copy-verification if needed
          });
        }
      }
    } else {
      const nameLower = name.toLowerCase();
      if (
        KNOWN_INTERMEDIATE.has(nameLower) ||
        nameLower.startsWith('com.whatsapp')
      ) {
        await bfsFindAndCollect(entry, depth + 1, results, deadline);
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan a granted SAF tree URI for WhatsApp .Statuses files.
 *
 * Uses expo-file-system's readDirectoryAsync for traversal so every returned
 * URI is tree-qualified and readable by expo-image / expo-video / ExoPlayer
 * without any extra permission lookup.
 *
 * Supports:
 *   • Android/media root grant (covers WA + WA Business + any variant)
 *   • Specific WhatsApp or WhatsApp Business folder grants
 *   • Legacy .Statuses direct grants
 *
 * size is 0 at scan time. Copy-verification in MediaContextSAF lazily calls
 * getInfoAsync(item.uri) when size === 0, so nothing breaks downstream.
 */
export async function scanForStatuses(treeUri: string): Promise<NativeSafFile[]> {
  if (Platform.OS !== 'android') return [];
  const results: NativeSafFile[] = [];
  const deadline = Date.now() + BFS_TIMEOUT_MS;
  try {
    await bfsFindAndCollect(treeUri, 0, results, deadline);
  } catch {}
  return results;
}

/**
 * Copy a SAF content:// file to a local cache path.
 * Uses expo-file-system copyAsync — handles ContentResolver correctly on all
 * Android versions and both tree-qualified and bare document URIs.
 */
export async function copyFileToCache(contentUri: string, destPath: string): Promise<string> {
  const dest = destPath.startsWith('file://') ? destPath : `file://${destPath}`;
  await FileSystem.copyAsync({ from: contentUri, to: dest });
  return dest;
}

/**
 * Fetch metadata for a SAF document URI.
 * Uses expo-file-system getInfoAsync — works for both tree-qualified and
 * bare content:// URIs.
 */
export async function getDocumentInfo(contentUri: string): Promise<NativeDocumentInfo> {
  const info = await FileSystem.getInfoAsync(contentUri);
  return {
    name: safUriToFileName(contentUri),
    size: info.exists ? ((info as any).size ?? 0) : 0,
    modTime: info.exists ? (((info as any).modificationTime ?? 0) * 1000) : 0,
    mimeType: '',
  };
}

/**
 * generateThumbnail — always rejects so thumbnail-cache.ts falls through to
 * expo-video-thumbnails (hardware-accelerated, works on all builds).
 * The rejection is immediate, so there is no 3-second wait in the caller.
 */
export function generateThumbnail(
  _videoPath: string,
  _destPath: string,
  _timeMs = 0,
): Promise<string> {
  return Promise.reject(new Error('use expo-video-thumbnails fallback'));
}

/** preCopyAll — no-op. On-demand copy in the viewer is sufficient. */
export function preCopyAll(_cacheDirPath: string, _items: PreCopyItem[]): Promise<number> {
  return Promise.resolve(0);
}

/** cancelPreCopy — no-op. */
export function cancelPreCopy(): Promise<null> {
  return Promise.resolve(null);
}

/**
 * Fast file-stat for a local cached file.
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
 * Delete files in dirPath whose name starts with one of `prefixes`
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
 * Delete multiple local files in parallel.
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
