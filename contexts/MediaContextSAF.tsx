/**
 * MediaContextSAF — Android 11+ (API 30+) provider.
 *
 * Uses the Storage Access Framework (SAF) to read WhatsApp statuses.
 * The user grants a folder URI once; the grant persists across reboots.
 * A native Java module (SafReaderModule) handles the BFS + file listing
 * on a background thread so the JS thread is never blocked by SAF I/O.
 */
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import { Platform, Alert, Linking, InteractionManager, AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThumbnailCache } from '@/lib/thumbnail-cache';
import { cleanupDocumentCache } from '@/lib/video-fallback';
import * as SafReaderModule from '@/modules/saf-reader';
import {
  MediaContext,
  MediaContextValue,
  StatusItem,
  SavedItem,
  StatusSource,
  AndroidStorageMethod,
  STORAGE_KEYS,
  PLAY_STORE_URL,
  getFileId,
  getMediaType,
  isValidStatusFile,
  withTimeout,
  pollUntil,
  enqueueCopy,
} from './media/types';
import { SavedStore } from '@/lib/saved-store';

// ── In-flight copy deduplication ─────────────────────────────────────────
// Tracks copies currently in progress by item ID so two callers requesting
// the same item (e.g. tap-prefetch in grid + viewer URI-prep) share one
// promise instead of queuing two sequential copies of the same file.
const copyInFlight = new Map<string, Promise<string>>();

// ── Telemetry ─────────────────────────────────────────────────────────────
const TELEMETRY_KEY = '@statusvault_telemetry';
const TELEMETRY_MAX = 50;
type TelemetrySnapshot = {
  safMountTimesMs: number[];
  directPlaySuccess: number;
  fallbackCopyTriggered: number;
  updatedAt: number;
};
const tel: TelemetrySnapshot = {
  safMountTimesMs: [],
  directPlaySuccess: 0,
  fallbackCopyTriggered: 0,
  updatedAt: 0,
};
let telHydrated = false;
let telFlushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleTelFlush() {
  if (telFlushTimer) return;
  telFlushTimer = setTimeout(() => {
    telFlushTimer = null;
    tel.updatedAt = Date.now();
    AsyncStorage.setItem(TELEMETRY_KEY, JSON.stringify(tel)).catch(() => {});
  }, 2000);
}
async function hydrateTel() {
  if (telHydrated) return;
  telHydrated = true;
  try {
    const raw = await AsyncStorage.getItem(TELEMETRY_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Partial<TelemetrySnapshot>;
    if (Array.isArray(p.safMountTimesMs))
      tel.safMountTimesMs = p.safMountTimesMs.slice(-TELEMETRY_MAX);
    if (typeof p.directPlaySuccess === 'number')
      tel.directPlaySuccess = p.directPlaySuccess;
    if (typeof p.fallbackCopyTriggered === 'number')
      tel.fallbackCopyTriggered = p.fallbackCopyTriggered;
  } catch {}
}
export function logSafMountTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return;
  tel.safMountTimesMs.push(Math.round(ms));
  if (tel.safMountTimesMs.length > TELEMETRY_MAX)
    tel.safMountTimesMs.splice(0, tel.safMountTimesMs.length - TELEMETRY_MAX);
  scheduleTelFlush();
}
export function logDirectPlaySuccess() {
  tel.directPlaySuccess += 1;
  scheduleTelFlush();
}
export function logFallbackCopyTriggered() {
  tel.fallbackCopyTriggered += 1;
  scheduleTelFlush();
}
export function getTelemetrySnapshot(): TelemetrySnapshot {
  const total = tel.directPlaySuccess + tel.fallbackCopyTriggered;
  return {
    safMountTimesMs: [...tel.safMountTimesMs],
    directPlaySuccess: tel.directPlaySuccess,
    fallbackCopyTriggered: tel.fallbackCopyTriggered,
    updatedAt: tel.updatedAt,
    // @ts-ignore
    directPlaySuccessRate: total === 0 ? null : tel.directPlaySuccess / total,
  };
}

// ── SAF constants ─────────────────────────────────────────────────────────
//
// GRANT STRATEGY — Android/media root (recommended by Android docs):
//   Asking for Android/media in one click covers every WhatsApp variant
//   (WA, WA Business, GB WA, WA Plus, etc.) because they all store their
//   media under Android/media/<package>/. The app then crawls subdirs itself.
//   This is the approach used by top-rated status-saver apps on the Play Store.
//
const ANDROID_MEDIA_URI =
  'content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia';

// Deep fallback URIs — only used when the user taps "Browse manually" or when
// we need to re-prompt after an OEM picker that ignored EXTRA_INITIAL_URI.
const SAF_INITIAL_URIS: Record<StatusSource, string> = {
  whatsapp:
    'content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp%2FWhatsApp%2FMedia',
  whatsapp_business:
    'content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp.w4b%2FWhatsApp%20Business%2FMedia',
};
// SAF_KNOWN_INTERMEDIATE: folder names the BFS is allowed to descend into.
// "com.whatsapp*" packages are handled separately by prefix check in bfsFindStatuses.
const SAF_KNOWN_INTERMEDIATE = new Set([
  'android', 'media',
  'com.whatsapp', 'com.whatsapp.w4b',
  'whatsapp', 'whatsapp business',
  'media', // WhatsApp/Media
]);
const SAF_BFS_MAX_DEPTH = 7;
const RATING_TRIGGER_COUNT = 10;

// ─────────────────────────────────────────────────────────────────────────
export function MediaProviderSAF({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [safGranted, setSafGranted] = useState(false);
  const [safUri, setSafUri] = useState<string | null>(null);
  const [safUris, setSafUris] = useState<Partial<Record<StatusSource, string>>>({});
  const [permissionStatus, setPermissionStatus] =
    useState<MediaLibrary.PermissionStatus | null>(null);
  const [isRequestingSAF, setIsRequestingSAF] = useState(false);
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);

  // Keep SavedStore in sync so MediaCard can subscribe per-ID without
  // causing a grid-wide re-render cascade when one status is saved/deleted.
  useEffect(() => {
    SavedStore.setIds(savedItems.map(s => s.id));
  }, [savedItems]);

  // Refs that mirror state for stable callbacks
  const savedItemsRef = useRef<SavedItem[]>([]);
  const hasPermissionRef = useRef(false);
  const safUrisRef = useRef<Partial<Record<StatusSource, string>>>({});
  const safUriRef = useRef<string | null>(null);
  const safGrantedRef = useRef(false);
  const resolvedUriCache = useRef<Map<string, string>>(new Map());
  const safRequestInFlight = useRef(false);
  const isLoadingRef = useRef(false);
  const loadStatusesRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  const cleanupCacheFilesRef = useRef<(maxAgeMs?: number) => Promise<void>>(async () => {});
  const statusesRef = useRef<StatusItem[]>([]);

  const androidVersion = Platform.OS === 'android' ? (Platform.Version as number) : 0;

  // ── Source detection helper ───────────────────────────────────────────────
  // Detects WhatsApp variant from any SAF URI (grant URI or individual file URI).
  // Works for com.whatsapp, com.whatsapp.w4b, com.gbwhatsapp, com.whatsapp.plus, etc.
  function getSourceFromUri(uri: string): StatusSource {
    const decoded = decodeURIComponent(uri).toLowerCase();
    if (decoded.includes('w4b') || decoded.includes('business')) return 'whatsapp_business';
    return 'whatsapp';
  }

  // ── Checks if a granted URI is a valid Android/media or WhatsApp grant ─────
  function isValidSafGrant(uri: string): boolean {
    const decoded = decodeURIComponent(uri).toLowerCase();
    return (
      decoded.includes('android/media') ||
      decoded.includes('com.whatsapp') ||
      decoded.includes('.statuses')
    );
  }

  savedItemsRef.current = savedItems;
  hasPermissionRef.current = hasPermission;
  safUrisRef.current = safUris;
  safUriRef.current = safUri;
  safGrantedRef.current = safGranted;
  statusesRef.current = statuses;

  const storageMethod: AndroidStorageMethod = useMemo(() => {
    if (Platform.OS !== 'android') return 'unknown';
    if (androidVersion >= 30) return safGranted ? 'saf' : 'scoped';
    return 'scoped';
  }, [androidVersion, safGranted]);

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await Promise.all([
          withTimeout(checkExistingPermissions(), 2500, undefined, 'checkPerms'),
          withTimeout(loadSAFUri(), 2500, undefined, 'loadSAFUri'),
          withTimeout(loadSavedItems({ skipRescan: true }), 2500, undefined, 'loadSaved'),
          withTimeout(loadResolvedUriCache(), 2500, undefined, 'loadResolvedURI'),
          withTimeout(loadStatusesCache(mounted), 2500, undefined, 'loadCache'),
        ]);
      } finally {
        if (mounted) setIsInitializing(false);
      }
      InteractionManager.runAfterInteractions(() => {
        if (!mounted) return;
        hydrateTel().catch(() => {});
        ThumbnailCache.init().catch(() => {});
      });
    };
    init();
    const rescanTimer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        if (!mounted || AppState.currentState !== 'active') return;
        rescanGalleryAlbum(savedItemsRef.current).then(rescanned => {
          if (!mounted || !rescanned) return;
          setSavedItems(rescanned);
          AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(rescanned)).catch(() => {});
        }).catch(() => {});
      });
    }, 3000);
    return () => {
      mounted = false;
      clearTimeout(rescanTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SAF URI loading ──────────────────────────────────────────────────────
  async function loadSAFUri() {
    try {
      const [storedMap, storedLegacy] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SAF_URIS),
        AsyncStorage.getItem(STORAGE_KEYS.SAF_URI),
      ]);
      let parsed: Partial<Record<StatusSource, string>> = {};
      if (storedMap) {
        parsed = JSON.parse(storedMap);
      } else if (storedLegacy) {
        parsed = { whatsapp: storedLegacy };
        await AsyncStorage.setItem(STORAGE_KEYS.SAF_URIS, JSON.stringify(parsed));
      }
      if (parsed.whatsapp || parsed.whatsapp_business) {
        setSafUris(parsed);
        setSafUri(parsed.whatsapp || parsed.whatsapp_business || null);
        setSafGranted(true);
      }
    } catch {}
  }

  async function loadResolvedUriCache() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.RESOLVED_URIS);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, string>;
      Object.entries(map).forEach(([k, v]) => {
        if (typeof k === 'string' && typeof v === 'string')
          resolvedUriCache.current.set(k, v);
      });
    } catch {}
  }

  function persistResolvedUriCache() {
    try {
      const obj: Record<string, string> = {};
      resolvedUriCache.current.forEach((v, k) => { obj[k] = v; });
      AsyncStorage.setItem(STORAGE_KEYS.RESOLVED_URIS, JSON.stringify(obj)).catch(() => {});
    } catch {}
  }

  // ── Statuses cache ───────────────────────────────────────────────────────
  async function loadStatusesCache(mounted: boolean) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.STATUSES_CACHE);
      if (!raw || !mounted) return;
      const cached = JSON.parse(raw) as StatusItem[];
      if (!Array.isArray(cached) || cached.length === 0) return;
      setStatuses(cached);
      InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          if (!mounted) return;
          const current = statusesRef.current;
          if (
            current.length !== cached.length ||
            (current[0] && cached[0] && current[0].id !== cached[0].id)
          ) return;
          const valid: StatusItem[] = [];
          for (const it of cached) {
            try {
              if (!it.uri.startsWith('content://') && !it.uri.startsWith('file://')) {
                valid.push(it); continue;
              }
              const info = await FileSystem.getInfoAsync(it.uri);
              if (info.exists && (info as any).size !== 0) valid.push(it);
            } catch {}
            if (!mounted) return;
          }
          if (!mounted || valid.length === cached.length) return;
          const stillMatches =
            statusesRef.current.length === cached.length &&
            statusesRef.current[0]?.id === cached[0]?.id;
          if (!stillMatches) return;
          setStatuses(valid);
        }, 1500);
      });
    } catch {}
  }

  function persistStatusesCache(items: StatusItem[]) {
    try {
      AsyncStorage.setItem(STORAGE_KEYS.STATUSES_CACHE, JSON.stringify(items.slice(0, 200))).catch(() => {});
    } catch {}
  }

  // ── Saved items ───────────────────────────────────────────────────────────
  async function rescanGalleryAlbum(currentValid: SavedItem[]): Promise<SavedItem[] | null> {
    try {
      const perm: any = await MediaLibrary.getPermissionsAsync();
      if (perm?.status !== 'granted') return null;
      if (perm?.accessPrivileges === 'none') return null;
      const album = await MediaLibrary.getAlbumAsync('StatusVault');
      if (!album) return null;
      const valid = [...currentValid];
      const knownUris = new Set(valid.map(v => v.localUri));
      const knownNames = new Set(valid.map(v => v.name));
      let after: string | undefined;
      let pageGuard = 0;
      let added = false;
      while (pageGuard < 20) {
        pageGuard += 1;
        const page = await MediaLibrary.getAssetsAsync({
          album: album.id,
          mediaType: ['photo', 'video'],
          first: 100,
          ...(after ? { after } : {}),
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        for (const asset of page.assets) {
          if (knownUris.has(asset.uri) || knownNames.has(asset.filename)) continue;
          valid.push({
            id: `restored-${asset.id}`,
            uri: asset.uri,
            localUri: asset.uri,
            name: asset.filename,
            type: asset.mediaType === MediaLibrary.MediaType.video ? 'video' : 'image',
            source: 'whatsapp',
            savedAt: Math.floor(asset.creationTime || Date.now()),
          });
          knownUris.add(asset.uri);
          knownNames.add(asset.filename);
          added = true;
        }
        if (!page.hasNextPage || !page.endCursor) break;
        after = page.endCursor;
      }
      return added ? valid : null;
    } catch (e: any) {
      const msg: string = typeof e?.message === 'string' ? e.message : '';
      if (msg.includes('MEDIA_LIBRARY permissions') || msg.includes('Missing MEDIA_LIBRARY')) return null;
      return null;
    }
  }

  async function loadSavedItems(opts: { skipRescan?: boolean } = {}) {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_ITEMS);
      const items: SavedItem[] = stored ? JSON.parse(stored) : [];

      let valid: SavedItem[];

      if (SafReaderModule.isAvailable() && items.length > 0) {
        // ── Java batch stat — 1 call instead of N individual getInfoAsync ──
        // All saved items are local file:// paths. Java File.exists() + length()
        // for N files in one bridge round-trip is orders of magnitude faster
        // than N individual Promise.allSettled(getInfoAsync) calls.
        const checks = await SafReaderModule.batchCheckFiles(
          items.map(it => it.localUri),
        );
        // Build a path→entry map so order doesn't matter
        const checkMap = new Map<string, boolean>();
        for (const c of checks) {
          checkMap.set(c.path, c.exists);
          // Also match the file:// prefixed version
          checkMap.set('file://' + c.path, c.exists);
        }
        valid = items.filter(it =>
          checkMap.get(it.localUri) === true ||
          checkMap.get(it.localUri.replace('file://', '')) === true,
        );
      } else {
        // JS fallback (Expo Go / no native module)
        const checks = await Promise.allSettled(
          items.map(item => FileSystem.getInfoAsync(item.localUri)),
        );
        valid = [];
        for (let i = 0; i < items.length; i++) {
          const c = checks[i];
          if (c.status === 'fulfilled' && (c.value as any).exists) valid.push(items[i]);
        }
      }

      setSavedItems(valid);
      if (valid.length !== items.length)
        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(valid));
      if (opts.skipRescan) return;
      const rescanned = await rescanGalleryAlbum(valid);
      if (rescanned) {
        setSavedItems(rescanned);
        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(rescanned));
      }
    } catch {}
  }

  // ── Permissions ───────────────────────────────────────────────────────────
  async function checkExistingPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync(true);
      const granted = status === 'granted';
      setPermissionStatus(prev => prev !== status ? status : prev);
      setHasPermission(prev => prev !== granted ? granted : prev);
      return granted;
    } catch { return false; }
  }

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      setPermissionStatus(status);
      const granted = status === 'granted';
      setHasPermission(granted);
      return granted;
    } catch { return false; }
  }, []);

  // ── SAF request ───────────────────────────────────────────────────────────
  const requestSAF = useCallback(async (source: StatusSource = 'whatsapp', manual = false) => {
    if (Platform.OS !== 'android') return;
    if (safRequestInFlight.current) return;
    safRequestInFlight.current = true;

    // Always open the picker at Android/media so the user sees ONE folder
    // that covers all WhatsApp variants. Only fall back to the deep WA path
    // when the user explicitly chooses "Browse manually".
    const initialUri = manual ? SAF_INITIAL_URIS[source] : ANDROID_MEDIA_URI;

    setIsRequestingSAF(true);
    try {
      await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
      let result: { granted: boolean; directoryUri: string };
      try {
        result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
          initialUri ?? null,
        );
      } catch (e) {
        console.error('[SAF] requestDirectoryPermissionsAsync failed:', e);
        setIsRequestingSAF(false);
        safRequestInFlight.current = false;
        return;
      }
      setIsRequestingSAF(false);
      if (!result.granted) { safRequestInFlight.current = false; return; }

      // ── OEM validation ────────────────────────────────────────────────────
      // Some OEM pickers (older MIUI, Samsung OneUI < 5) ignore EXTRA_INITIAL_URI
      // and land the user at the root storage. If the user confirmed the root or
      // a completely unrelated folder, the grant won't contain anything useful.
      if (!isValidSafGrant(result.directoryUri)) {
        Alert.alert(
          'Wrong Folder Selected',
          'Please select the "Android" → "media" folder.\n\nWhen the picker opens, navigate to:\nInternal Storage → Android → media\n\nThen tap "Use this folder" and "Allow".',
          [{ text: 'Try Again', onPress: () => {
            safRequestInFlight.current = false;
            requestSAF(source, manual);
          }},
          { text: 'Cancel', style: 'cancel', onPress: () => { safRequestInFlight.current = false; } }],
        );
        return;
      }

      const nextSafUris = { ...safUrisRef.current, [source]: result.directoryUri };
      await AsyncStorage.setItem(STORAGE_KEYS.SAF_URIS, JSON.stringify(nextSafUris));
      await AsyncStorage.setItem(STORAGE_KEYS.SAF_URI, result.directoryUri);
      setSafUris(nextSafUris);
      setSafUri(result.directoryUri);
      setSafGranted(true);
      setIsGrantingAccess(true);
      setIsLoading(true);
      resolvedUriCache.current.delete(result.directoryUri);
      try {
        const readAll = async () => {
          const entries = Object.entries(nextSafUris) as [StatusSource, string][];
          const results = await Promise.all(entries.map(([s, u]) => readFromSAF(u, s)));
          return results.flat().sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
        };
        const mountStart = Date.now();
        const items = await pollUntil(
          readAll,
          list => list.length > 0,
          { maxMs: 4000, initialDelay: 250, backoff: 1.5, maxDelay: 1200 },
        );
        logSafMountTime(Date.now() - mountStart);
        setStatuses(items);
        if (items.length > 0) persistStatusesCache(items);
      } finally {
        setIsLoading(false);
        setIsGrantingAccess(false);
        safRequestInFlight.current = false;
      }
    } catch (e) {
      console.error('[SAF] requestSAF error:', e);
      setIsRequestingSAF(false);
      setIsGrantingAccess(false);
      safRequestInFlight.current = false;
    }
  }, []);

  // ── SAF readers ───────────────────────────────────────────────────────────
  function buildChildDocUri(treeUri: string, childRelativePath: string): string | null {
    try {
      const match = treeUri.match(/^(content:\/\/[^/]+\/tree\/)(.+)$/);
      if (!match) return null;
      const prefix = match[1];
      const treeDocId = match[2];
      const decodedTree = decodeURIComponent(treeDocId);
      const childDocId = decodedTree + childRelativePath;
      return `${prefix}${treeDocId}/document/${encodeURIComponent(childDocId)}`;
    } catch { return null; }
  }

  function safUriToFileName(uri: string): string {
    try {
      return decodeURIComponent(uri.split('/').pop() || '').split('/').pop() || '';
    } catch { return ''; }
  }

  const BFS_TIMEOUT_MS = 4000;
  const crawlStart = Date.now();
  async function bfsFindStatuses(uri: string, depth: number): Promise<string | null> {
    if (Date.now() - crawlStart > BFS_TIMEOUT_MS) return null;
    if (depth > SAF_BFS_MAX_DEPTH) return null;
    let entries: string[];
    try {
      entries = await withTimeout(
        FileSystem.StorageAccessFramework.readDirectoryAsync(uri),
        1500,
        [] as string[],
        `BFS depth=${depth}`,
      );
    } catch { return null; }
    for (const entry of entries) {
      const name = safUriToFileName(entry);
      const nameLower = name.toLowerCase();
      if (name === '.Statuses') return entry;
      // Descend into known intermediate folders OR any com.whatsapp* package
      // (covers WA, WA Business, GB WhatsApp, WhatsApp Plus, etc.)
      if (SAF_KNOWN_INTERMEDIATE.has(nameLower) || nameLower.startsWith('com.whatsapp')) {
        const found = await bfsFindStatuses(entry, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  async function readFromSAF(safDirUri: string, forcedSource?: StatusSource): Promise<StatusItem[]> {
    const decodedUri = decodeURIComponent(safDirUri).toLowerCase();
    const source: StatusSource =
      forcedSource ||
      (decodedUri.includes('w4b') || decodedUri.includes('business')
        ? 'whatsapp_business'
        : 'whatsapp');

    // Native path (EAS / custom build)
    if (SafReaderModule.isAvailable()) {
      try {
        const files = await SafReaderModule.scanForStatuses(safDirUri);
        if (files.length === 0) return [];
        const items: StatusItem[] = files.map(f => {
          // Detect source per-file so that an android/media root grant correctly
          // tags WA Business files as 'whatsapp_business' and regular WA as 'whatsapp'.
          const fileSource = forcedSource ?? getSourceFromUri(f.uri);
          return {
            id: getFileId(f.uri) + '_' + fileSource,
            uri: f.uri,
            type: getMediaType(f.name),
            name: f.name,
            modTime: f.modTime,
            size: f.size,
            source: fileSource,
          };
        });
        if (!resolvedUriCache.current.has(safDirUri)) {
          resolvedUriCache.current.set(safDirUri, safDirUri + '/__native_resolved__');
          persistResolvedUriCache();
        }
        return items;
      } catch (e) {
        __DEV__ && console.warn('[SAF-Native] failed, falling back to JS:', e);
      }
    }

    // JS fallback (Expo Go)
    return readFromSAFJsFallback(safDirUri, source);
  }

  async function readFromSAFJsFallback(safDirUri: string, source: StatusSource): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    try {
      const decoded = decodeURIComponent(safDirUri).toLowerCase();

      // ── Android/media root grant path ─────────────────────────────────────
      // When the user granted Android/media (the recommended flow), enumerate
      // all com.whatsapp* subdirectories and scan each one independently.
      // This automatically covers WA, WA Business, GB WhatsApp, WA Plus, etc.
      if (decoded.endsWith('android/media')) {
        let mediaSubdirs: string[] = [];
        try {
          mediaSubdirs = await withTimeout(
            FileSystem.StorageAccessFramework.readDirectoryAsync(safDirUri),
            2000, [] as string[], 'android/media subdir list',
          );
        } catch {}

        const waSubdirs = mediaSubdirs.filter(d =>
          safUriToFileName(d).toLowerCase().startsWith('com.whatsapp'),
        );

        for (const waSubdir of waSubdirs) {
          const subdirName = safUriToFileName(waSubdir).toLowerCase();
          const waSource: StatusSource =
            subdirName.includes('w4b') || subdirName.includes('business')
              ? 'whatsapp_business'
              : 'whatsapp';

          // Navigate into <WA-package>/<AppName>/Media/.Statuses
          // Try listing the WA package dir to find its app folder
          let appFolders: string[] = [];
          try {
            appFolders = await withTimeout(
              FileSystem.StorageAccessFramework.readDirectoryAsync(waSubdir),
              1500, [] as string[], `list ${subdirName}`,
            );
          } catch { continue; }

          for (const appFolder of appFolders) {
            const appFolderName = safUriToFileName(appFolder).toLowerCase();
            if (!appFolderName.startsWith('whatsapp')) continue;

            // Navigate into AppFolder/Media
            let mediaFolders: string[] = [];
            try {
              mediaFolders = await withTimeout(
                FileSystem.StorageAccessFramework.readDirectoryAsync(appFolder),
                1500, [] as string[], `list ${appFolderName}`,
              );
            } catch { continue; }

            const mediaDir = mediaFolders.find(f =>
              safUriToFileName(f).toLowerCase() === 'media',
            );
            if (!mediaDir) continue;

            // Navigate into Media/.Statuses
            let mediaSubs: string[] = [];
            try {
              mediaSubs = await withTimeout(
                FileSystem.StorageAccessFramework.readDirectoryAsync(mediaDir),
                1500, [] as string[], 'list Media',
              );
            } catch { continue; }

            const statusesDir = mediaSubs.find(f => safUriToFileName(f) === '.Statuses');
            if (!statusesDir) continue;

            // Read files from .Statuses
            try {
              const files = await withTimeout(
                FileSystem.StorageAccessFramework.readDirectoryAsync(statusesDir),
                2500, [] as string[], 'read .Statuses',
              );
              for (const fileUri of files) {
                const fileName = safUriToFileName(fileUri);
                if (!isValidStatusFile(fileName)) continue;
                items.push({
                  id: getFileId(fileUri) + '_' + waSource,
                  uri: fileUri,
                  type: getMediaType(fileName),
                  name: fileName,
                  source: waSource,
                });
              }
            } catch {}
            break; // found .Statuses for this WA package, move to next
          }
        }

        if (items.length > 0) {
          // Cache as a special sentinel — android/media grants don't have a single targetUri
          resolvedUriCache.current.set(safDirUri, safDirUri + '/__media_root__');
          persistResolvedUriCache();
          return items;
        }
        // If dynamic enumeration found nothing (WA not installed yet, or no statuses viewed),
        // fall through to the BFS which will try harder.
      }

      // ── Specific folder grant path (deep WA path or legacy) ───────────────
      let targetUri: string | null = resolvedUriCache.current.get(safDirUri) ?? null;
      if (
        targetUri?.endsWith('/__native_resolved__') ||
        targetUri?.endsWith('/__media_root__')
      ) targetUri = null;

      if (!targetUri) {
        if (safUriToFileName(safDirUri) === '.Statuses') {
          targetUri = safDirUri;
        }
        if (!targetUri) {
          const candidates = [
            '/.Statuses', '/Media/.Statuses',
            '/WhatsApp/Media/.Statuses', '/WhatsApp Business/Media/.Statuses',
          ];
          for (const rel of candidates) {
            const uri = buildChildDocUri(safDirUri, rel);
            if (!uri) continue;
            try {
              await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
              targetUri = uri; break;
            } catch {}
          }
        }
        if (!targetUri) targetUri = await bfsFindStatuses(safDirUri, 0);
        if (!targetUri) return [];
        resolvedUriCache.current.set(safDirUri, targetUri);
        persistResolvedUriCache();
      }

      const files = await withTimeout(
        FileSystem.StorageAccessFramework.readDirectoryAsync(targetUri),
        3000,
        [] as string[],
        'SAF readDirectoryAsync',
      );
      for (const fileUri of files) {
        const fileName = safUriToFileName(fileUri);
        if (!isValidStatusFile(fileName)) continue;
        items.push({
          id: getFileId(fileUri) + '_' + source,
          uri: fileUri,
          type: getMediaType(fileName),
          name: fileName,
          source,
        });
      }
      return items;
    } catch (e) {
      console.error('[SAF-JS] readFromSAFJsFallback failed:', e);
      return [];
    }
  }

  // ── Load statuses (SAF path) ──────────────────────────────────────────────
  const loadStatuses = useCallback(async (silent = false) => {
    if (isLoadingRef.current) return;
    if (!safGrantedRef.current) return;
    isLoadingRef.current = true;
    if (!silent) setIsLoading(true);
    try {
      let items: StatusItem[] = [];
      const safEntries = Object.entries(safUrisRef.current) as [StatusSource, string][];
      if (safEntries.length > 0) {
        const mountStart = Date.now();
        const readAllSequential = async (): Promise<StatusItem[]> => {
          const results: StatusItem[] = [];
          for (const [source, uri] of safEntries) {
            try {
              const list = await readFromSAF(uri, source);
              results.push(...list);
              if (safEntries.length > 1) await new Promise(r => setTimeout(r, 50));
            } catch (e) {
              __DEV__ && console.warn(`[SAF] Failed to read ${source}:`, e);
            }
          }
          return results;
        };
        items = await readAllSequential();
        if (items.length === 0) {
          resolvedUriCache.current.clear();
          items = await pollUntil(
            readAllSequential,
            list => list.length > 0,
            { maxMs: 2500, initialDelay: 300, backoff: 1.5, maxDelay: 800 },
          );
        }
        logSafMountTime(Date.now() - mountStart);
      } else if (safUriRef.current) {
        items = await readFromSAF(safUriRef.current);
      }

      items.sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
      setStatuses(prev => {
        if (prev.length === 0) return items;
        const prevById = new Map(prev.map(p => [p.id, p]));
        let changed = items.length !== prev.length;
        const merged = items.map(item => {
          const existing = prevById.get(item.id);
          if (existing && existing.modTime === item.modTime && existing.size === item.size)
            return existing;
          changed = true;
          return item;
        });
        if (!changed) {
          for (let i = 0; i < merged.length; i++) {
            if (merged[i] !== prev[i]) { changed = true; break; }
          }
        }
        return changed ? merged : prev;
      });
      if (items.length > 0) {
        persistStatusesCache(items);
        const queueItems = items.map(it => ({ id: it.id, uri: it.uri, type: it.type }));
        const currentIds = new Set(items.map(it => it.id));

        // ── Java pre-copy (THE competitor-app pattern) ────────────────────
        // Fire-and-forget: copies ALL videos to local cache on a Java
        // background thread right now so that by the time the user taps
        // any video it is already at a file:// path. ExoPlayer then gets
        // a seekable local file — zero SAF streaming latency.
        // Only runs when the native module is linked (EAS / custom build).
        if (SafReaderModule.isAvailable()) {
          const videoItems = items
            .filter(it => it.type === 'video')
            .map(it => ({ uri: it.uri, id: it.id, name: it.name }));
          if (videoItems.length > 0) {
            const rawCacheDir = (FileSystem.cacheDirectory ?? '').replace(/\/$/, '');
            InteractionManager.runAfterInteractions(() => {
              SafReaderModule.preCopyAll(rawCacheDir, videoItems)
                .then(n => { __DEV__ && console.log(`[SafReader] preCopyAll: ${n} videos pre-cached`); })
                .catch(e => { __DEV__ && console.warn('[SafReader] preCopyAll error:', e); });
            });
          }
        }

        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => {
            ThumbnailCache.prune(currentIds).catch(() => {});
            ThumbnailCache.enqueue(queueItems);
          }, 600);
        });
      }
    } catch (e) {
      console.error('[Loader] Error loading statuses:', e);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  loadStatusesRef.current = loadStatuses;

  const refresh = useCallback(async (silent = true) => {
    resolvedUriCache.current.clear();
    setIsRefreshing(true);
    await loadStatusesRef.current(silent);
    await loadSavedItems();
    setIsRefreshing(false);
  }, []);

  // ── Rating prompt ─────────────────────────────────────────────────────────
  async function maybeShowRatingPrompt() {
    try {
      const dismissed = await AsyncStorage.getItem(STORAGE_KEYS.RATING_PROMPTED);
      if (dismissed === 'never') return;
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SAVES);
      const count = raw ? parseInt(raw, 10) : 0;
      const newCount = count + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_SAVES, String(newCount));
      if (newCount % RATING_TRIGGER_COUNT === 0) {
        Alert.alert(
          '⭐ Enjoying StatusVault?',
          `You've saved ${newCount} statuses! A quick rating helps us grow and keeps the app free.`,
          [
            { text: 'Rate Now', onPress: () => Linking.openURL(PLAY_STORE_URL).catch(() => {}) },
            { text: 'Maybe Later', style: 'cancel' },
            {
              text: 'Never', style: 'destructive',
              onPress: async () => {
                await AsyncStorage.setItem(STORAGE_KEYS.RATING_PROMPTED, 'never');
              },
            },
          ],
        );
      }
    } catch {}
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveStatus = useCallback(async (item: StatusItem): Promise<boolean> => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const savedDir = `${FileSystem.documentDirectory}saved/`;
      const dirInfo = await FileSystem.getInfoAsync(savedDir);
      if (!dirInfo.exists)
        await FileSystem.makeDirectoryAsync(savedDir, { intermediates: true });

      const duplicate = savedItemsRef.current.find(s => s.id === item.id || s.name === item.name);
      if (duplicate) {
        try {
          const dupInfo = await FileSystem.getInfoAsync(duplicate.localUri);
          if (dupInfo.exists) return true;
        } catch {}
      }

      const ext = item.name.split('.').pop() || 'jpg';
      const filename = `status_${Date.now()}.${ext}`;
      const destUri = `${savedDir}${filename}`;

      if (item.uri.startsWith('content://') && SafReaderModule.isAvailable()) {
        await enqueueCopy(() => SafReaderModule.copyFileToCache(item.uri, destUri.replace('file://', '')));
      } else {
        await enqueueCopy(() => FileSystem.copyAsync({ from: item.uri, to: destUri }));
      }

      const newSaved: SavedItem = { ...item, localUri: destUri, savedAt: Date.now() };
      const updated = [newSaved, ...savedItemsRef.current.filter(s => s.id !== item.id)];
      setSavedItems(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));

      InteractionManager.runAfterInteractions(() => {
        MediaLibrary.createAssetAsync(destUri)
          .then(asset => MediaLibrary.createAlbumAsync('StatusVault', asset, false))
          .catch(() => {});
      });

      maybeShowRatingPrompt();
      return true;
    } catch (e) {
      console.error('[Media] saveStatus failed:', e);
      return false;
    }
  }, []);

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteFromSaved = useCallback(async (item: SavedItem) => {
    try { await FileSystem.deleteAsync(item.localUri, { idempotent: true }); } catch {}
    const updated = savedItemsRef.current.filter(s => s.id !== item.id);
    setSavedItems(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));
  }, []);

  // ── Share (simplified — no Firebase referral link) ────────────────────────
  const shareStatus = useCallback(async (item: StatusItem | SavedItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      let shareUri: string;
      if ('localUri' in item) {
        shareUri = (item as SavedItem).localUri;
      } else if (!item.uri.startsWith('content://')) {
        shareUri = item.uri;
      } else {
        shareUri = await prepareStatusForViewingFn(item as StatusItem, { forShare: true });
        if (shareUri === item.uri) {
          const ext = item.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
          const safeId = item.id.replace(/[:\/\\?%*|"<>]/g, '_');
          const shareFile = `${FileSystem.cacheDirectory}share_${safeId}.${ext}`;
          const shareInfo = await FileSystem.getInfoAsync(shareFile);
          if (!shareInfo.exists) {
            try { await FileSystem.copyAsync({ from: item.uri, to: shareFile }); } catch {}
          }
          shareUri = shareFile;
        }
      }
      await Sharing.shareAsync(shareUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (typeof shareUri === 'string' && shareUri.includes('/share_')) {
        setTimeout(() => {
          FileSystem.deleteAsync(shareUri, { idempotent: true }).catch(() => {});
        }, 5000);
      }
    } catch (e) {
      console.error('Share error:', e);
    }
  }, []);

  const isStatusSaved = useCallback((id: string): boolean => {
    return savedItemsRef.current.some(s => s.id === id);
  }, []);

  // ── Prepare for viewing ───────────────────────────────────────────────────
  //
  // RULE: Videos must NEVER be streamed from SAF content:// URIs.
  // ExoPlayer opens the SAF file descriptor and buffers ~1 s of data fine,
  // but when it tries to refill the buffer the SAF DocumentProvider (a
  // separate Android process) is too slow to deliver bytes — the buffer
  // starves and the video freezes at exactly the 1-second mark every time.
  //
  // Fix: always copy video content:// URIs to a local file:// cache path
  // before handing them to ExoPlayer. Images are fine with content:// because
  // expo-image does a single-shot decode (no streaming buffer to refill).
  //
  // In-flight dedup: if a copy for this item ID is already running (e.g.
  // tapped from the grid while the viewer is also preparing), both callers
  // share the same promise instead of queuing two sequential copies.
  async function prepareStatusForViewingFn(
    item: StatusItem,
    opts?: { forShare?: boolean; forPlayback?: boolean },
  ): Promise<string> {
    if (!item.uri.startsWith('content://')) return item.uri;

    // Images: a single-shot decode from content:// is fine — no streaming.
    // Only copy when explicitly sharing (needs a shareable file:// path).
    if (item.type !== 'video' && !opts?.forShare) return item.uri;

    const ext = item.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
    const safeId = item.id.replace(/[:\/\\?%*|"<>]/g, '_');
    const tempUri = `${FileSystem.cacheDirectory}view_${safeId}.${ext}`;

    // Fast path: cached file already exists.
    try {
      const info = await FileSystem.getInfoAsync(tempUri);
      if (info.exists && (info as any).size > 0) return tempUri;
    } catch {}

    // Dedup: reuse an in-flight copy promise for the same item.
    const existing = copyInFlight.get(item.id);
    if (existing) return existing;

    const rawDest = tempUri.replace('file://', '');
    const useNativeCopy = SafReaderModule.isAvailable();

    const copyPromise: Promise<string> = enqueueCopy(async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (useNativeCopy) {
            await SafReaderModule.copyFileToCache(item.uri, rawDest);
          } else {
            await FileSystem.copyAsync({ from: item.uri, to: tempUri });
          }
          const verify = await FileSystem.getInfoAsync(tempUri);
          if (verify.exists && (verify as any).size > 0) return tempUri;
          try { await FileSystem.deleteAsync(tempUri, { idempotent: true }); } catch {}
        } catch {
          try { await FileSystem.deleteAsync(tempUri, { idempotent: true }); } catch {}
        }
      }
      throw new Error(`Cache copy failed for ${item.name}`);
    }).finally(() => {
      copyInFlight.delete(item.id);
    }) as Promise<string>;

    copyInFlight.set(item.id, copyPromise);
    return copyPromise;
  }

  const prepareStatusForViewing = useCallback(
    (item: StatusItem, opts?: { forShare?: boolean; forPlayback?: boolean }) =>
      prepareStatusForViewingFn(item, opts),
    [],
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanupCacheFiles = useCallback(async (maxAgeMs = 4 * 60 * 60 * 1000) => {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;
    const rawDir = cacheDir.replace(/\/$/, '');

    if (SafReaderModule.isAvailable()) {
      // ── Java path — single directory walk, no per-file bridge round-trips ──
      // Java scans the directory, checks lastModified() for every view_* and
      // share_* file, and deletes old ones in one call. Replaces the JS loop
      // that called getInfoAsync + deleteAsync per file.
      try {
        await SafReaderModule.cleanupCacheDir(rawDir, ['view_', 'share_'], maxAgeMs);
      } catch {}
      return;
    }

    // JS fallback (Expo Go / no native module)
    try {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const now = Date.now();
      for (const file of files) {
        if (!file.startsWith('view_') && !file.startsWith('share_')) continue;
        const fileUri = `${cacheDir}${file}`;
        try {
          const info = await FileSystem.getInfoAsync(fileUri);
          const fileAge = info.modificationTime
            ? now - info.modificationTime * 1000
            : now - 1000000;
          if (fileAge > maxAgeMs) await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch {}
      }
    } catch {}
  }, []);

  cleanupCacheFilesRef.current = cleanupCacheFiles;

  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      const t = setTimeout(() => {
        if (!cancelled) {
          cleanupCacheFiles().catch(() => {});
          setTimeout(() => { if (!cancelled) cleanupDocumentCache().catch(() => {}); }, 1000);
        }
      }, 3000);
      return () => clearTimeout(t);
    });
    return () => {
      cancelled = true;
      // @ts-ignore
      handle?.cancel?.();
    };
  }, [cleanupCacheFiles]);

  // ── Foreground: SAF revocation check + cache sweep ────────────────────────
  const lastForegroundSweepRef = useRef<number>(0);
  useEffect(() => {
    let prevAppState = AppState.currentState;
    const sub = AppState.addEventListener('change', nextState => {
      const wasBackground = prevAppState === 'background';
      prevAppState = nextState;
      if (nextState !== 'active' || !wasBackground) return;
      const now = Date.now();
      const sinceLastSweep = now - lastForegroundSweepRef.current;
      InteractionManager.runAfterInteractions(async () => {
        const uris = safUrisRef.current;
        if (uris.whatsapp || uris.whatsapp_business) {
          let anyRevoked = false;
          const stillValid: Partial<Record<StatusSource, string>> = {};
          for (const src of ['whatsapp', 'whatsapp_business'] as StatusSource[]) {
            const uri = uris[src];
            if (!uri) continue;
            try {
              await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
              stillValid[src] = uri;
            } catch {
              anyRevoked = true;
              resolvedUriCache.current.delete(uri);
            }
          }
          if (anyRevoked) {
            const hasAny = Object.keys(stillValid).length > 0;
            setSafUris(stillValid);
            setSafUri(stillValid.whatsapp || stillValid.whatsapp_business || null);
            setSafGranted(hasAny);
            try {
              if (hasAny) {
                await AsyncStorage.setItem(STORAGE_KEYS.SAF_URIS, JSON.stringify(stillValid));
              } else {
                await AsyncStorage.multiRemove([STORAGE_KEYS.SAF_URIS, STORAGE_KEYS.SAF_URI]);
                await AsyncStorage.removeItem(STORAGE_KEYS.RESOLVED_URIS);
              }
            } catch {}
          }
        }
        if (sinceLastSweep > 30 * 60 * 1000) {
          lastForegroundSweepRef.current = now;
          cleanupCacheFilesRef.current(2 * 60 * 60 * 1000).catch(() => {});
        }
      });
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Context value ─────────────────────────────────────────────────────────
  const value: MediaContextValue = useMemo(() => ({
    statuses,
    savedItems,
    isLoading,
    isRefreshing,
    isInitializing,
    isRequestingSAF,
    isGrantingAccess,
    hasPermission,
    safGranted,
    safUri,
    safUris,
    androidVersion,
    storageMethod,
    permissionStatus,
    requestPermissions,
    requestSAF,
    loadStatuses,
    refresh,
    saveStatus,
    deleteFromSaved,
    shareStatus,
    isStatusSaved,
    prepareStatusForViewing,
    cleanupCacheFiles,
  }), [
    statuses, savedItems, isLoading, isRefreshing, isInitializing,
    isRequestingSAF, isGrantingAccess, hasPermission, safGranted,
    safUri, safUris, androidVersion, storageMethod, permissionStatus,
    requestPermissions, requestSAF, loadStatuses, refresh,
    saveStatus, deleteFromSaved, shareStatus, isStatusSaved,
    prepareStatusForViewing, cleanupCacheFiles,
  ]);

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}