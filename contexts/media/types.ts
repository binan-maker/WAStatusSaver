import { createContext, useContext } from 'react';
import * as MediaLibrary from 'expo-media-library';

export type MediaType = 'image' | 'video';
export type StatusSource = 'whatsapp' | 'whatsapp_business';
export type AndroidStorageMethod = 'legacy' | 'scoped' | 'saf' | 'unknown';

export interface StatusItem {
  id: string;
  uri: string;
  type: MediaType;
  name: string;
  modTime?: number;
  size?: number;
  source: StatusSource;
}

export interface SavedItem extends StatusItem {
  savedAt: number;
  localUri: string;
}

export interface MediaContextValue {
  statuses: StatusItem[];
  savedItems: SavedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  isInitializing: boolean;
  isRequestingSAF: boolean;
  isGrantingAccess: boolean;
  hasPermission: boolean;
  safGranted: boolean;
  safUri: string | null;
  safUris: Partial<Record<StatusSource, string>>;
  androidVersion: number;
  storageMethod: AndroidStorageMethod;
  permissionStatus: MediaLibrary.PermissionStatus | null;
  requestPermissions: () => Promise<boolean>;
  requestSAF: (source?: StatusSource, manual?: boolean) => Promise<void>;
  loadStatuses: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  saveStatus: (item: StatusItem) => Promise<boolean>;
  deleteFromSaved: (item: SavedItem) => Promise<void>;
  shareStatus: (item: StatusItem | SavedItem) => Promise<void>;
  isStatusSaved: (id: string) => boolean;
  prepareStatusForViewing: (
    item: StatusItem,
    opts?: { forShare?: boolean; forPlayback?: boolean },
  ) => Promise<string>;
  cleanupCacheFiles: (maxAgeMs?: number) => Promise<void>;
}

export const MediaContext = createContext<MediaContextValue | null>(null);

export function useMedia(): MediaContextValue {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be used within a MediaProvider');
  return ctx;
}

export const STORAGE_KEYS = {
  SAVED_ITEMS: '@statusvault_saved',
  SAF_URI: '@statusvault_saf_uri',
  SAF_URIS: '@statusvault_saf_uris',
  TOTAL_SAVES: '@statusvault_total_saves',
  RATING_PROMPTED: '@statusvault_rating_prompted',
  RESOLVED_URIS: '@statusvault_resolved_uris',
  STATUSES_CACHE: '@statusvault_statuses_cache',
} as const;

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.binan.statussaver';

export function getFileId(path: string): string {
  return path.split('/').pop()?.replace(/\.[^.]+$/, '') || path;
}

export function getMediaType(filename: string): MediaType {
  const lower = filename.toLowerCase();
  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.3gp') ||
    lower.endsWith('.mov')
  ) {
    return 'video';
  }
  return 'image';
}

export function isValidStatusFile(name: string): boolean {
  if (name.startsWith('.')) return false;
  const lower = name.toLowerCase();
  const validExts = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.mkv', '.3gp', '.mov',
  ];
  const hasKnownExt = validExts.some(ext => lower.endsWith(ext));
  const hasNoExt = !lower.includes('.');
  return hasKnownExt || hasNoExt;
}

export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  fallback: T,
  label?: string,
): Promise<T> {
  return new Promise<T>(resolve => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);
    p.then(
      v => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      _e => { if (!settled) { settled = true; clearTimeout(t); resolve(fallback); } },
    );
  });
}

export async function pollUntil<T>(
  fn: () => Promise<T>,
  isOk: (v: T) => boolean,
  opts: { maxMs: number; initialDelay: number; backoff?: number; maxDelay?: number },
): Promise<T> {
  const backoff = opts.backoff ?? 1.6;
  const maxDelay = opts.maxDelay ?? 1500;
  const deadline = Date.now() + opts.maxMs;
  let last: T = await fn();
  let delay = opts.initialDelay;
  while (!isOk(last) && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(Math.round(delay * backoff), maxDelay);
    last = await fn();
  }
  return last;
}

// ── CRITICAL FIX: Limited Copy Queue (Max 2 Parallel, with Playback Timeout) ──
// Replaces the old serial queue that caused 10+ second freezes
let activeCopies = 0;
const MAX_PARALLEL_COPIES = 2;
const copyWaitingList: (() => Promise<unknown>)[] = [];

async function runCopy<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 30000,
): Promise<T> {
  activeCopies++;
  try {
    return await withTimeout(fn(), timeoutMs, undefined as any, 'Copy operation');
  } finally {
    activeCopies--;
    if (copyWaitingList.length > 0) {
      const next = copyWaitingList.shift();
      if (next) runCopy(next, timeoutMs);
    }
  }
}

export function enqueueCopy<T>(
  fn: () => Promise<T>,
  opts?: { timeoutMs?: number; isPlayback?: boolean },
): Promise<T> {
  // Playback copies timeout faster (8s) to fallback to direct SAF play
  const timeoutMs = opts?.isPlayback ? 8000 : (opts?.timeoutMs ?? 30000);

  // If under limit, run immediately (parallel up to 2)
  if (activeCopies < MAX_PARALLEL_COPIES) {
    return runCopy(fn, timeoutMs);
  }

  // Otherwise queue it
  return new Promise<T>((resolve, reject) => {
    copyWaitingList.push(async () => {
      try {
        const result = await runCopy(fn, timeoutMs);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });
}
