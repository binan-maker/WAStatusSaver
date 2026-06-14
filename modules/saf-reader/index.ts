/**
 * SafReader — JS wrapper for the native Android SAF scanner module.
 *
 * On Android this resolves to the native Java SafReaderModule which runs all
 * SAF I/O on a background ExecutorService thread. On iOS / web the module is
 * absent and every function is a no-op / safe fallback so the JS bundle never
 * crashes in non-Android environments or in Expo Go (before a custom build).
 */
import { NativeModules, Platform } from 'react-native';

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

interface SafReaderNative {
  scanForStatuses(treeUri: string): Promise<NativeSafFile[]>;
  copyFileToCache(contentUri: string, destPath: string): Promise<string>;
  getDocumentInfo(contentUri: string): Promise<NativeDocumentInfo>;
}

const SafReaderNative: SafReaderNative | null =
  Platform.OS === 'android' ? (NativeModules.SafReader ?? null) : null;

/** True when the native module is linked (custom dev-client / EAS build). */
export function isAvailable(): boolean {
  return SafReaderNative !== null;
}

/**
 * Scan a granted SAF tree URI for .Statuses files.
 * Returns an empty array when the native module is unavailable (Expo Go).
 */
export function scanForStatuses(treeUri: string): Promise<NativeSafFile[]> {
  if (!SafReaderNative) return Promise.resolve([]);
  return SafReaderNative.scanForStatuses(treeUri);
}

/**
 * Copy a SAF content:// file to a local destPath using a 64 KB buffer on a
 * Java background thread. Much faster than expo-file-system copyAsync for
 * large files on Android 11+ OEM devices.
 */
export function copyFileToCache(contentUri: string, destPath: string): Promise<string> {
  if (!SafReaderNative) return Promise.reject(new Error('SafReader native module not linked'));
  return SafReaderNative.copyFileToCache(contentUri, destPath);
}

/**
 * Fetch metadata (size, modTime, mimeType) for a SAF document without reading
 * its content. Resolves with NativeDocumentInfo.
 */
export function getDocumentInfo(contentUri: string): Promise<NativeDocumentInfo> {
  if (!SafReaderNative) return Promise.reject(new Error('SafReader native module not linked'));
  return SafReaderNative.getDocumentInfo(contentUri);
}
