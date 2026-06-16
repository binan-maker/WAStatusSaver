/**
 * SafReader — JS wrapper for the native Android SAF scanner module.
 *
 * The real work (BFS scan, file copy, thumbnail generation, pre-copy)
 * is 100% Java running on a background ExecutorService — this file is
 * a pure thin bridge: type declarations + null-guard wrappers.
 *
 * isAvailable() returns true only in custom dev-client / EAS builds
 * where the Java code has been compiled in. Returns false in Expo Go,
 * iOS, and web so the app never crashes in those environments.
 */
import { NativeModules, Platform } from 'react-native';

// ── Types exposed to JS consumers ────────────────────────────────────────────

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

/** Item passed to preCopyAll — must include the JS item.id so Java computes
 *  the same safeId and therefore the same destPath as prepareStatusForViewingFn. */
export interface PreCopyItem {
  uri: string;
  id: string;
  name: string;
}

// ── Native module shape ───────────────────────────────────────────────────────

interface SafReaderNative {
  // Core SAF operations
  scanForStatuses(treeUri: string): Promise<NativeSafFile[]>;
  copyFileToCache(contentUri: string, destPath: string): Promise<string>;
  getDocumentInfo(contentUri: string): Promise<NativeDocumentInfo>;

  // Thumbnail generation — Java MediaMetadataRetriever, hardware-accelerated
  generateThumbnail(videoPath: string, destPath: string, timeMs: number): Promise<string>;

  // Pre-copy: copies all video items to local cache in the background so the
  // viewer never has to wait. Uses same safeId rule as JS for path consistency.
  preCopyAll(cacheDirPath: string, items: PreCopyItem[]): Promise<number>;

  // Cancel an in-progress preCopyAll without blocking
  cancelPreCopy(): Promise<null>;

  // Fast Java file-stat — avoids expo-file-system bridge overhead
  checkCachedFile(filePath: string): Promise<NativeCacheCheck>;
}

const SafReaderNative: SafReaderNative | null =
  Platform.OS === 'android' ? (NativeModules.SafReader ?? null) : null;

// ── Public API ────────────────────────────────────────────────────────────────

/** True when the native Java module is linked (custom dev-client / EAS build). */
export function isAvailable(): boolean {
  return SafReaderNative !== null;
}

/**
 * Scan a granted SAF tree URI for .Statuses files.
 * Java BFS — runs entirely on a background thread, never blocks the UI.
 * Returns [] when the native module is unavailable (Expo Go).
 */
export function scanForStatuses(treeUri: string): Promise<NativeSafFile[]> {
  if (!SafReaderNative) return Promise.resolve([]);
  return SafReaderNative.scanForStatuses(treeUri);
}

/**
 * Copy a SAF content:// file to a local destPath using a 1 MB Java buffer.
 * 3–5× faster than expo-file-system copyAsync for large video files on
 * Android 11+ OEM devices. Atomic write via .tmp + rename.
 */
export function copyFileToCache(contentUri: string, destPath: string): Promise<string> {
  if (!SafReaderNative) return Promise.reject(new Error('SafReader native module not linked'));
  return SafReaderNative.copyFileToCache(contentUri, destPath);
}

/**
 * Fetch metadata (size, modTime, mimeType) for a SAF document.
 * No bytes are read — pure ContentResolver cursor query.
 */
export function getDocumentInfo(contentUri: string): Promise<NativeDocumentInfo> {
  if (!SafReaderNative) return Promise.reject(new Error('SafReader native module not linked'));
  return SafReaderNative.getDocumentInfo(contentUri);
}

/**
 * Generate a JPEG video thumbnail using Android's hardware-accelerated
 * MediaMetadataRetriever. Writes atomically to destPath.
 * videoPath may be a file:// path or a content:// URI.
 * timeMs: frame position in milliseconds (0 = first key-frame).
 */
export function generateThumbnail(
  videoPath: string,
  destPath: string,
  timeMs = 0,
): Promise<string> {
  if (!SafReaderNative) return Promise.reject(new Error('SafReader native module not linked'));
  return SafReaderNative.generateThumbnail(videoPath, destPath, timeMs);
}

/**
 * Pre-copy ALL video items to the local cache directory immediately after
 * scan. Uses each item's JS `id` to compute the same destPath that
 * prepareStatusForViewingFn uses, so the viewer finds files instantly.
 *
 * Call this after loadStatuses() returns with scanned items — fire and forget
 * (do not await). Returns the number of files newly copied.
 */
export function preCopyAll(cacheDirPath: string, items: PreCopyItem[]): Promise<number> {
  if (!SafReaderNative) return Promise.resolve(0);
  return SafReaderNative.preCopyAll(cacheDirPath, items);
}

/**
 * Cancel an in-progress preCopyAll. Java stops after finishing the current
 * file. Non-blocking from the JS side.
 */
export function cancelPreCopy(): Promise<null> {
  if (!SafReaderNative) return Promise.resolve(null);
  return SafReaderNative.cancelPreCopy();
}

/**
 * Fast Java file-stat. Returns {exists, size} without going through the
 * expo-file-system bridge. Use to check whether a pre-copy is already done.
 */
export function checkCachedFile(filePath: string): Promise<NativeCacheCheck> {
  if (!SafReaderNative) return Promise.resolve({ exists: false, size: 0 });
  return SafReaderNative.checkCachedFile(filePath);
}

/**
 * Batch file-stat: stats ALL paths in a single Java call.
 * Collapses N × async getInfoAsync() round-trips into one promise.
 * Paths may include or omit the file:// prefix — Java strips it.
 * Returns results in the same order as the input array.
 */
export function batchCheckFiles(paths: string[]): Promise<NativeBatchFileEntry[]> {
  if (!SafReaderNative) return Promise.resolve([]);
  return (SafReaderNative as any).batchCheckFiles(paths);
}

/**
 * Java-native cache directory cleanup. Deletes every file in dirPath whose
 * name starts with one of the given prefixes AND that is older than maxAgeMs
 * milliseconds. Returns the count of deleted files.
 * Replaces the JS loop that called getInfoAsync + deleteAsync per file.
 */
export function cleanupCacheDir(
  dirPath: string,
  prefixes: string[],
  maxAgeMs: number,
): Promise<number> {
  if (!SafReaderNative) return Promise.resolve(0);
  return (SafReaderNative as any).cleanupCacheDir(dirPath, prefixes, maxAgeMs);
}

/**
 * Delete multiple local files in one Java call.
 * Returns the count of files successfully deleted.
 * Non-existent files are silently skipped.
 */
export function batchDeleteFiles(paths: string[]): Promise<number> {
  if (!SafReaderNative) return Promise.resolve(0);
  return (SafReaderNative as any).batchDeleteFiles(paths);
}
