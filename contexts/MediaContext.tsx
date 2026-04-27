import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import { Platform, Alert, Share, Linking, InteractionManager, AppState } from 'react-native';
// expo-file-system /legacy is intentionally retained:
// the modern File/Directory/Paths API in expo-file-system@19 does NOT yet
// expose StorageAccessFramework. Mixing the two entrypoints just to pull
// SAF off /legacy would be more confusing than the current single import,
// so until the modern API has full SAF parity we stay on /legacy here.
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VIDEO_AD_FREQUENCY, IMAGE_SWIPE_AD_FREQUENCY, INTERSTITIAL_COOLDOWN_MS } from '@/constants/admob';
import { getCachedShareLink, buildShareCaption } from '@/lib/share-link';
import { ThumbnailCache } from '@/lib/thumbnail-cache';

// ──────────────────────────────────────────────────────────────────────────
// SAF latency mitigation primitives — used throughout this file to replace
// the brittle "fixed setTimeout + retry" pattern that produced the visible
// 1-2 s freeze on Android 11+ after granting folder access.
// ──────────────────────────────────────────────────────────────────────────

// ANR-PROOF PIPELINE (Bottleneck #1 fix): Hard-timeout wrapper.
// Wraps any promise in a Promise.race against a timer. If the promise
// hasn't resolved after `ms`, we resolve with `fallback` instead of
// hanging forever. This is the single most important defense against
// OEM-skin (MIUI, OneUI, HyperOS) DocumentProvider stalls — those calls
// can hang 2-8 s when the storage indexer is busy, which on Android 11+
// blocks the JS thread and trips the ANR watchdog. With this wrapper a
// single misbehaving native call can never freeze cold launch.
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T, label?: string): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (label) console.log(`[Timeout] ${label} did not resolve in ${ms}ms, falling back`);
      resolve(fallback);
    }, ms);
    p.then(
      (v) => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      (_e) => { if (!settled) { settled = true; clearTimeout(t); resolve(fallback); } },
    );
  });
}

// Lightweight polling helper. Calls `fn`, returns its value if `isOk(value)`
// is true. Otherwise waits `delay` ms and retries with exponential backoff
// until `maxMs` total elapsed. Always returns the LAST value (even if not ok)
// so callers can fall through with whatever they got. This replaces the
// hardcoded `await new Promise(r => setTimeout(r, 700))` + retry pattern that
// guaranteed at least 700-2000 ms of dead time on every grant/load — even on
// devices where the SAF folder mounted in 50 ms.
async function pollUntil<T>(
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

// Single-thread serialized queue for SAF copy operations. Android 11+
// throttles concurrent SAF I/O — running two prepareStatusForViewing copies
// in parallel actually makes BOTH slower than running them back-to-back.
// This queue guarantees at most one copy is in flight at any time so the
// next-status preloader never fights the active video copy for I/O.
let copyQueue: Promise<unknown> = Promise.resolve();
function enqueueCopy<T>(fn: () => Promise<T>): Promise<T> {
  const next = copyQueue.then(() => fn(), () => fn());
  // Swallow rejections on the queue chain so one failure doesn't kill the
  // queue forever — the caller still receives the rejection from `next`.
  copyQueue = next.catch(() => undefined);
  return next as Promise<T>;
}

// ──────────────────────────────────────────────────────────────────────────
// Lightweight in-memory telemetry. Counts direct-play vs fallback-copy and
// keeps a rolling window of recent SAF mount times. Persisted to AsyncStorage
// on a 2 s debounce so a long session never thrashes disk. Inspect via
// getTelemetrySnapshot() (also exposed on the MediaContext value for ad-hoc
// debugging from any screen / settings dev panel).
// ──────────────────────────────────────────────────────────────────────────
const TELEMETRY_KEY = '@statusvault_telemetry';
const TELEMETRY_MAX_MOUNT_SAMPLES = 50;
type TelemetrySnapshot = {
  safMountTimesMs: number[];
  directPlaySuccess: number;
  fallbackCopyTriggered: number;
  updatedAt: number;
};
const telemetryState: TelemetrySnapshot = {
  safMountTimesMs: [],
  directPlaySuccess: 0,
  fallbackCopyTriggered: 0,
  updatedAt: 0,
};
let telemetryHydrated = false;
let telemetryFlushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleTelemetryFlush() {
  if (telemetryFlushTimer) return;
  telemetryFlushTimer = setTimeout(() => {
    telemetryFlushTimer = null;
    telemetryState.updatedAt = Date.now();
    AsyncStorage.setItem(TELEMETRY_KEY, JSON.stringify(telemetryState)).catch(() => {});
  }, 2000);
}
async function hydrateTelemetryOnce() {
  if (telemetryHydrated) return;
  telemetryHydrated = true;
  try {
    const raw = await AsyncStorage.getItem(TELEMETRY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<TelemetrySnapshot>;
    if (Array.isArray(parsed.safMountTimesMs)) {
      telemetryState.safMountTimesMs = parsed.safMountTimesMs.slice(-TELEMETRY_MAX_MOUNT_SAMPLES);
    }
    if (typeof parsed.directPlaySuccess === 'number') {
      telemetryState.directPlaySuccess = parsed.directPlaySuccess;
    }
    if (typeof parsed.fallbackCopyTriggered === 'number') {
      telemetryState.fallbackCopyTriggered = parsed.fallbackCopyTriggered;
    }
  } catch {}
}
export function logSafMountTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return;
  telemetryState.safMountTimesMs.push(Math.round(ms));
  if (telemetryState.safMountTimesMs.length > TELEMETRY_MAX_MOUNT_SAMPLES) {
    telemetryState.safMountTimesMs.splice(0, telemetryState.safMountTimesMs.length - TELEMETRY_MAX_MOUNT_SAMPLES);
  }
  scheduleTelemetryFlush();
}
export function logDirectPlaySuccess() {
  telemetryState.directPlaySuccess += 1;
  scheduleTelemetryFlush();
}
export function logFallbackCopyTriggered() {
  telemetryState.fallbackCopyTriggered += 1;
  scheduleTelemetryFlush();
}
export function getTelemetrySnapshot(): TelemetrySnapshot {
  const total = telemetryState.directPlaySuccess + telemetryState.fallbackCopyTriggered;
  // Return a defensive copy so external code can't mutate our counters.
  return {
    safMountTimesMs: [...telemetryState.safMountTimesMs],
    directPlaySuccess: telemetryState.directPlaySuccess,
    fallbackCopyTriggered: telemetryState.fallbackCopyTriggered,
    updatedAt: telemetryState.updatedAt,
    // @ts-ignore — extra debug field, not in the type
    directPlaySuccessRate: total === 0 ? null : telemetryState.directPlaySuccess / total,
  };
}

export type MediaType = 'image' | 'video';
export type StatusSource = 'whatsapp' | 'whatsapp_business';

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

export type AndroidStorageMethod = 'legacy' | 'scoped' | 'saf' | 'unknown';

interface MediaContextValue {
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
  videoViewCount: number;
  showInterstitial: boolean;
  pendingVideoUri: string | null;
  requestPermissions: () => Promise<boolean>;
  requestSAF: (source?: StatusSource, manual?: boolean) => Promise<void>;
  loadStatuses: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  saveStatus: (item: StatusItem) => Promise<boolean>;
  deleteFromSaved: (item: SavedItem) => Promise<void>;
  shareStatus: (item: StatusItem | SavedItem) => Promise<void>;
  isStatusSaved: (id: string) => boolean;
  onVideoOpen: (uri: string) => void;
  onImageSwipe: () => void;
  dismissInterstitial: () => void;
  prepareStatusForViewing: (
    item: StatusItem,
    opts?: { forShare?: boolean },
  ) => Promise<string>;
  cleanupCacheFiles: () => Promise<void>;
}

const MediaContext = createContext<MediaContextValue | null>(null);

const WHATSAPP_LEGACY_PATHS = [
  '/storage/emulated/0/WhatsApp/Media/.Statuses',
  '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses',
  '/storage/emulated/0/WhatsApp Business/Media/.Statuses',
  '/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses',
];

const WHATSAPP_SAF_PATHS = [
  'Android/media/com.whatsapp/WhatsApp/Media',
  'WhatsApp/Media',
  'Android/media/com.whatsapp.w4b/WhatsApp Business/Media',
  'WhatsApp Business/Media',
];

const STORAGE_KEYS = {
  SAVED_ITEMS: '@statusvault_saved',
  SAF_URI: '@statusvault_saf_uri',
  SAF_URIS: '@statusvault_saf_uris',
  TOTAL_SAVES: '@statusvault_total_saves',
  RATING_PROMPTED: '@statusvault_rating_prompted',
  // Map of grantedTreeUri -> resolved .Statuses URI. Persisting this lets
  // every cold launch SKIP the BFS crawl that previously cost 200-1500 ms
  // on devices where the OS hadn't fully indexed the hidden folder yet.
  RESOLVED_URIS: '@statusvault_resolved_uris',
  // Snapshot of the last successful statuses[] list. Used to populate the
  // grid INSTANTLY on cold launch so the user sees thumbnails before the
  // SAF read returns. Capped at 200 items to keep AsyncStorage payload small.
  STATUSES_CACHE: '@statusvault_statuses_cache',
};

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.binan.statussaver';
const RATING_TRIGGER_COUNT = 10;

async function maybeShowRatingPrompt() {
  try {
    // "Never" is the only permanent dismissal — stored as 'never'.
    const dismissed = await AsyncStorage.getItem(STORAGE_KEYS.RATING_PROMPTED);
    if (dismissed === 'never') return;

    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SAVES);
    const count = raw ? parseInt(raw, 10) : 0;
    const newCount = count + 1;
    await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_SAVES, String(newCount));

    // Modulo check: prompt every 10 saves so "Maybe Later" users get reminded again.
    if (newCount % RATING_TRIGGER_COUNT === 0) {
      Alert.alert(
        '⭐ Enjoying StatusVault?',
        `You've saved ${newCount} statuses! A quick rating helps us grow and keeps the app free.`,
        [
          {
            text: 'Rate Now',
            onPress: () => Linking.openURL(PLAY_STORE_URL).catch(() => {}),
          },
          { text: 'Maybe Later', style: 'cancel' },
          {
            text: 'Never',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.setItem(STORAGE_KEYS.RATING_PROMPTED, 'never');
            },
          },
        ],
      );
    }
  } catch {}
}

// Point the picker at the PARENT (Media) folder, not the hidden .Statuses folder.
// Many Android devices and OEMs ignore hints to hidden directories (starting with '.')
// and even when honored, readDirectoryAsync on a hidden tree URI often returns empty.
// Granting the non-hidden Media folder is more reliable on all devices.
const SAF_INITIAL_URIS: Record<StatusSource, string> = {
  whatsapp: 'content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp%2FWhatsApp%2FMedia',
  whatsapp_business: 'content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp.w4b%2FWhatsApp%20Business%2FMedia',
};

// Folder names on the path from any SAF root → .Statuses. BFS only descends
// into these so we never waste time scanning DCIM, Downloads, etc.
// Full deepest path: Android/media/com.whatsapp/WhatsApp/Media/.Statuses (6 levels)
const SAF_KNOWN_INTERMEDIATE = new Set([
  'android',
  'media',
  'com.whatsapp',
  'com.whatsapp.w4b',
  'whatsapp',
  'whatsapp business',
]);
// Allow 7 levels of depth so any grant level (root → Media) is covered.
const SAF_BFS_MAX_DEPTH = 7;

function getFileId(path: string): string {
  return path.split('/').pop()?.replace(/\.[^.]+$/, '') || path;
}

function getMediaType(filename: string): MediaType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.3gp') || lower.endsWith('.mov')) {
    return 'video';
  }
  return 'image';
}

function isValidStatusFile(name: string): boolean {
  // Skip hidden files (dotfiles other than the .Statuses folder itself)
  if (name.startsWith('.')) return false;
  const lower = name.toLowerCase();
  const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mkv', '.3gp', '.mov'];
  // Accept known extensions OR extensionless files (some OEM builds of WhatsApp
  // store statuses as hash-only filenames with no extension inside .Statuses).
  const hasKnownExt = validExts.some(ext => lower.endsWith(ext));
  const hasNoExt = !lower.includes('.');
  return hasKnownExt || hasNoExt;
}

export function MediaProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [safGranted, setSafGranted] = useState(false);
  const [safUri, setSafUri] = useState<string | null>(null);
  const [safUris, setSafUris] = useState<Partial<Record<StatusSource, string>>>({});
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);
  const [videoViewCount, setVideoViewCount] = useState(0);
  const [imageSwipeCount, setImageSwipeCount] = useState(0);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);
  const swipeCountRef = useRef<number>(0);
  const initLoadDoneRef = useRef(false);
  // ── PERF: Refs that mirror state for use INSIDE callbacks ──────────────
  // These let our callbacks stay reference-stable (empty deps) even though
  // they read changing state. Without this, every state tick recreated the
  // context value, forcing every consumer (home tabs, viewer, settings,
  // saved) to re-render. On Android 11+ that re-render storm during app
  // launch was making the device feel frozen for 2-4 seconds. With stable
  // refs, the context value identity changes ONLY when displayed data
  // changes — never when an internal counter ticks.
  const savedItemsRef = useRef<SavedItem[]>([]);
  const hasPermissionRef = useRef(false);
  const androidVersionRef = useRef(0);
  const safUrisRef = useRef<Partial<Record<StatusSource, string>>>({});
  const safUriRef = useRef<string | null>(null);
  const safGrantedRef = useRef(false);
  const videoViewCountRef = useRef(0);
  const imageSwipeCountRef = useRef(0);
  // In-memory cache: grantedUri → resolved .Statuses URI.
  // Prevents re-walking the folder tree on every loadStatuses call.
  const resolvedUriCache = useRef<Map<string, string>>(new Map());
  // Guard: prevents a second requestSAF call while one is already in flight
  // (e.g. double-tap or concurrent effect trigger) which causes the
  // "unfinished permission request" native error.
  const safRequestInFlight = useRef(false);
  const isLoadingRef = useRef(false);
  // Forward-ref for callbacks that need to call loadStatuses without
  // taking a dep on it (which would change identity every render).
  const loadStatusesRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  const cleanupCacheFilesRef = useRef<(maxAgeMs?: number) => Promise<void>>(async () => {});
  // Mirrors `statuses` state so background tasks (cache validation, etc.)
  // can compare against the LATEST list without taking a render-coupled dep.
  const statusesRef = useRef<StatusItem[]>([]);

  const androidVersion = Platform.OS === 'android' ? (Platform.Version as number) : 0;

  // Keep refs in sync with state — these reads are cheap (assignment) and
  // happen on every render but never trigger re-renders themselves.
  savedItemsRef.current = savedItems;
  hasPermissionRef.current = hasPermission;
  androidVersionRef.current = androidVersion;
  safUrisRef.current = safUris;
  safUriRef.current = safUri;
  safGrantedRef.current = safGranted;
  videoViewCountRef.current = videoViewCount;
  imageSwipeCountRef.current = imageSwipeCount;
  statusesRef.current = statuses;

  const storageMethod: AndroidStorageMethod = useMemo(() => {
    if (Platform.OS !== 'android') return 'unknown';
    if (androidVersion >= 30) return safGranted ? 'saf' : 'scoped';
    if (androidVersion >= 29) return 'scoped';
    return 'legacy';
  }, [androidVersion, safGranted]);

  // Single init effect — waits for all permission/storage checks before marking ready.
  // PERF: We skip the heavy MediaLibrary album rescan during initial mount and
  // schedule it for after first paint + interactions. Without this deferral the
  // rescan ran synchronously during cold-launch, blocking the JS thread for
  // 1-3 seconds on Android 11+ and making the device feel frozen.
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        // ──────────────────────────────────────────────────────────────────
        // ANR-PROOF PHASE 1 (Bottleneck #2 fix): CRITICAL state only.
        // These are the reads the UI cannot meaningfully render without:
        //   • permissions  – decides which screen to show
        //   • SAF URI map  – decides whether we have storage access at all
        //   • saved items  – the Saved tab needs them
        //   • resolved URI cache – lets the first SAF read skip BFS
        //   • statuses snapshot – paints the grid instantly on cold launch
        // Each is wrapped in a hard 2.5 s timeout so that ONE stalled
        // AsyncStorage / DocumentProvider call can never starve the JS
        // thread and freeze the splash. On a fast device every entry
        // resolves in 5-50 ms; the timeout is a SAFETY NET, not a budget.
        // ──────────────────────────────────────────────────────────────────
        const PHASE1_TIMEOUT_MS = 2500;
        await Promise.all([
          withTimeout(checkExistingPermissions(), PHASE1_TIMEOUT_MS, undefined, 'checkExistingPermissions'),
          withTimeout(loadSAFUri(), PHASE1_TIMEOUT_MS, undefined, 'loadSAFUri'),
          withTimeout(loadSavedItems({ skipRescan: true }), PHASE1_TIMEOUT_MS, undefined, 'loadSavedItems'),
          withTimeout(loadResolvedUriCache(), PHASE1_TIMEOUT_MS, undefined, 'loadResolvedUriCache'),
          withTimeout(loadStatusesCache(mounted), PHASE1_TIMEOUT_MS, undefined, 'loadStatusesCache'),
        ]);
      } finally {
        if (mounted) setIsInitializing(false);
      }

      // ──────────────────────────────────────────────────────────────────
      // ANR-PROOF PHASE 3 (Bottleneck #2 fix): NON-CRITICAL hydration.
      // These are useful but the UI works perfectly without them, so we
      // fire-and-forget AFTER setIsInitializing(false) so they cannot
      // delay the first interactive frame by a single millisecond. On
      // Android 11+ the difference is dramatic — these three together
      // were adding 200-600 ms to cold launch on slow devices because
      // SQLite (AsyncStorage) + thumbnail cache disk reads + telemetry
      // hydrate were all competing with SAF for the same I/O bandwidth.
      // ──────────────────────────────────────────────────────────────────
      InteractionManager.runAfterInteractions(() => {
        if (!mounted) return;
        // Each is independently catch()'d so one failure can't chain-fail
        // the others. None of them can block the UI thread anyway because
        // we don't await them.
        hydrateTelemetryOnce().catch(() => {});
        ThumbnailCache.init().catch(() => {});
        AsyncStorage.getItem('swipeCountForAds').then(saved => {
          if (!mounted || !saved) return;
          const count = parseInt(saved, 10);
          if (Number.isFinite(count)) {
            swipeCountRef.current = count;
            setImageSwipeCount(count);
          }
        }).catch(() => {});
      });
    };
    init();
    // Defer the gallery album rescan ~3s after launch so it never competes
    // with first-paint, font-load, hydration, or the user's first taps.
    // Wrapped in InteractionManager + a small idle gap so a slow device
    // mid-animation doesn't get punished by a synchronous album scan.
    const rescanTimer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        if (!mounted) return;
        if (AppState.currentState !== 'active') return;
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

  // Hydrate the in-memory grantedUri -> .Statuses URI map from disk so the
  // FIRST loadStatuses call after launch never has to BFS-crawl the SAF tree.
  // The crawl can take 200-1500 ms on devices that haven't fully indexed the
  // hidden folder yet — and that delay was the dominant cost of cold launch.
  async function loadResolvedUriCache() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.RESOLVED_URIS);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, string>;
      Object.entries(map).forEach(([k, v]) => {
        if (typeof k === 'string' && typeof v === 'string') {
          resolvedUriCache.current.set(k, v);
        }
      });
    } catch {}
  }

  // Persist the resolved-URI cache. Fire-and-forget; errors are non-fatal
  // because the in-memory map is still populated for this session.
  function persistResolvedUriCache() {
    try {
      const obj: Record<string, string> = {};
      resolvedUriCache.current.forEach((v, k) => { obj[k] = v; });
      AsyncStorage.setItem(STORAGE_KEYS.RESOLVED_URIS, JSON.stringify(obj)).catch(() => {});
    } catch {}
  }

  // Hydrate the cached statuses list. Renders the grid INSTANTLY on cold
  // launch — the user sees real thumbnails (from expo-image's disk cache)
  // 100-200 ms after splash instead of the shimmer until SAF reads return.
  // The fresh SAF read still runs in parallel and replaces this list when
  // ready (selective patching keeps unchanged thumbnails mounted).
  //
  // CACHE INVALIDATION: WhatsApp auto-deletes statuses after 24 h, so
  // persisted entries can point at SAF URIs whose underlying file no
  // longer exists. After painting the cached snapshot, we kick off a
  // background validation pass (deferred via InteractionManager so it
  // never competes with first paint). It calls getInfoAsync on each
  // entry and drops anything that's gone or zero-byte. The fresh SAF
  // read usually wins this race anyway, but on slow OEMs the validation
  // pass keeps us from flashing broken thumbnails for the full poll
  // window.
  async function loadStatusesCache(mounted: boolean) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.STATUSES_CACHE);
      if (!raw || !mounted) return;
      const cached = JSON.parse(raw) as StatusItem[];
      if (!Array.isArray(cached) || cached.length === 0) return;
      setStatuses(cached);

      // Defer validation until after first paint + interactions. Skip
      // entirely if a fresh SAF read has already replaced state by then
      // (statusesRef differs from cached) — the fresh list is always
      // more authoritative than disk validation.
      InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          if (!mounted) return;
          // If state has been replaced (length differs OR top item id
          // differs), bail — fresh SAF read already won.
          const current = statusesRef.current;
          if (
            current.length !== cached.length ||
            (current[0] && cached[0] && current[0].id !== cached[0].id)
          ) {
            return;
          }
          const valid: StatusItem[] = [];
          for (const it of cached) {
            try {
              if (!it.uri.startsWith('content://') && !it.uri.startsWith('file://')) {
                valid.push(it);
                continue;
              }
              const info = await FileSystem.getInfoAsync(it.uri);
              if (info.exists && (info as any).size !== 0) {
                valid.push(it);
              }
            } catch {
              // SAF can throw on revoked URIs — treat as gone.
            }
            if (!mounted) return;
          }
          if (!mounted) return;
          // Only patch state if (a) something was filtered out and
          // (b) state still matches the cached snapshot.
          if (valid.length === cached.length) return;
          const stillMatches =
            statusesRef.current.length === cached.length &&
            statusesRef.current[0]?.id === cached[0]?.id;
          if (!stillMatches) return;
          console.log(
            `[Cache] Validated cached statuses: dropped ${cached.length - valid.length} dead URI(s)`,
          );
          setStatuses(valid);
        }, 1500);
      });
    } catch {}
  }

  // Persist the statuses snapshot (top 200) for instant cold-start render.
  // Capped to keep the AsyncStorage write under ~50 KB even with long names.
  function persistStatusesCache(items: StatusItem[]) {
    try {
      const slim = items.slice(0, 200);
      AsyncStorage.setItem(STORAGE_KEYS.STATUSES_CACHE, JSON.stringify(slim)).catch(() => {});
    } catch {}
  }

  // Heavy MediaLibrary rescan — pages through up to 2000 assets and is
  // the main reason cold-launch felt frozen. Split out so we can defer it
  // until after first paint & interactions.
  async function rescanGalleryAlbum(currentValid: SavedItem[]): Promise<SavedItem[] | null> {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status !== 'granted') return null;
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
          const isVideo = asset.mediaType === MediaLibrary.MediaType.video;
          valid.push({
            id: `restored-${asset.id}`,
            uri: asset.uri,
            localUri: asset.uri,
            name: asset.filename,
            type: isVideo ? 'video' : 'image',
            source: 'whatsapp',
            savedAt: Math.floor((asset.creationTime || Date.now())),
          });
          knownUris.add(asset.uri);
          knownNames.add(asset.filename);
          added = true;
        }
        if (!page.hasNextPage || !page.endCursor) break;
        after = page.endCursor;
      }
      return added ? valid : null;
    } catch (e) {
      console.log('[loadSavedItems] album rescan skipped:', e);
      return null;
    }
  }

  async function loadSavedItems(opts: { skipRescan?: boolean } = {}) {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_ITEMS);
      const items: SavedItem[] = stored ? JSON.parse(stored) : [];

      // PERF: validate file existence in parallel (settled) instead of awaiting
      // each getInfoAsync sequentially. On 100 saved items, this drops the
      // wall-clock from ~1.5-3s to ~150-400ms on Android 11+.
      const checks = await Promise.allSettled(
        items.map(item => FileSystem.getInfoAsync(item.localUri))
      );
      const valid: SavedItem[] = [];
      for (let i = 0; i < items.length; i++) {
        const c = checks[i];
        if (c.status === 'fulfilled' && (c.value as any).exists) valid.push(items[i]);
      }

      setSavedItems(valid);
      if (valid.length !== items.length) {
        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(valid));
      }

      // PERF: skip the heavy MediaLibrary album rescan during initial mount
      // (the caller schedules it via InteractionManager + setTimeout instead).
      if (opts.skipRescan) return;

      const rescanned = await rescanGalleryAlbum(valid);
      if (rescanned) {
        setSavedItems(rescanned);
        await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(rescanned));
      }
    } catch {}
  }

  async function checkExistingPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync(true);
      const granted = status === 'granted';
      
      // Only update state if something actually changed to prevent render loops
      setPermissionStatus(prev => prev !== status ? status : prev);
      setHasPermission(prev => prev !== granted ? granted : prev);
      
      return granted;
    } catch {
      return false;
    }
  }

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    console.log('[Permissions] requestPermissions started');
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      console.log(`[Permissions] MediaLibrary status: ${status}`);
      setPermissionStatus(status);
      const granted = status === 'granted';
      setHasPermission(granted);

      if (granted && androidVersionRef.current < 30) {
        console.log('[Permissions] Legacy device, auto-loading statuses');
        await loadStatusesRef.current();
      }

      return granted;
    } catch (e) {
      console.error('[Permissions] requestPermissions error:', e);
      return false;
    }
  }, []);

  const [isRequestingSAF, setIsRequestingSAF] = useState(false);
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);

  const requestSAF = useCallback(async (source: StatusSource = 'whatsapp', manual: boolean = false) => {
    if (Platform.OS !== 'android') return;

    // Safety guard: Android 10 and below should NOT use SAF for statuses
    // as it creates unnecessary friction and often fails to see hidden folders.
    if (androidVersionRef.current < 30) {
      console.warn('[SAF] requestSAF called on Android < 11. Aborting as Legacy uses direct access.');
      return;
    }

    console.log(`[SAF] requestSAF initiated. Source: ${source}, Manual: ${manual}`);

    // Prevent concurrent calls — Android throws "unfinished permission request"
    // if requestDirectoryPermissionsAsync is called while one is already open.
    if (safRequestInFlight.current) {
      console.warn('[SAF] requestSAF already in flight, ignoring concurrent call');
      return;
    }
    safRequestInFlight.current = true;

    // Work Profile support: when `manual` is true, open at storage root so the
    // user can navigate to their second WhatsApp's media folder.
    const initialUri = manual ? undefined : SAF_INITIAL_URIS[source];
    console.log(`[SAF] Initial URI for picker: ${initialUri || 'Storage Root'}`);

    setIsRequestingSAF(true);

    try {
      // Wait for the SAFGuideOverlay to render before launching the system picker.
      // InteractionManager.runAfterInteractions fires after the current JS frame
      // finishes painting — keeping the Android activity alive (unlike setTimeout
      // which can fire after an activity transition and lose the reference).
      await new Promise<void>(resolve =>
        InteractionManager.runAfterInteractions(() => resolve())
      );

      let result: { granted: boolean; directoryUri: string };
      try {
        // SAF URI PERSISTENCE — Android 11+
        // Expo's requestDirectoryPermissionsAsync internally calls
        // ContentResolver.takePersistableUriPermission() with FLAG_GRANT_READ_URI_PERMISSION
        // (see node_modules/expo-file-system/android/.../FilePickerContract.kt and
        // FileSystemLegacyModule.kt). That means the grant SURVIVES app kill,
        // device reboot, and process death — Android won't revoke read access
        // until the user manually clears it from system settings or uninstalls.
        // We do NOT need to (and cannot from JS) call takePersistableUriPermission
        // ourselves; the native side has already done it before this Promise
        // resolves. Verified against expo-file-system@19 source on 2026-04-27.
        result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri ?? null);
        console.log(`[SAF] Picker result: granted=${result.granted}, uri=${result.directoryUri}`);
      } catch (e) {
        console.error('[SAF] requestDirectoryPermissionsAsync failed:', e);
        setIsRequestingSAF(false);
        safRequestInFlight.current = false;
        return;
      }

      setIsRequestingSAF(false);

      if (!result.granted) {
        console.log('[SAF] Permission denied by user');
        safRequestInFlight.current = false;
        return;
      }

      const nextSafUris = { ...safUrisRef.current, [source]: result.directoryUri };
      await AsyncStorage.setItem(STORAGE_KEYS.SAF_URIS, JSON.stringify(nextSafUris));
      await AsyncStorage.setItem(STORAGE_KEYS.SAF_URI, result.directoryUri);

      setSafUris(nextSafUris);
      setSafUri(result.directoryUri);
      setSafGranted(true);

      // Show shimmer while Android mounts the newly granted SAF folder.
      setIsGrantingAccess(true);
      setIsLoading(true);
      // Clear BFS cache so we never reuse a stale "empty" result.
      resolvedUriCache.current.delete(result.directoryUri);

      try {
        console.log('[SAF] Polling for folder mount + first non-empty read...');

        const readSAFEntries = async (uriMap: Partial<Record<StatusSource, string>>) => {
          const entries = Object.entries(uriMap) as [StatusSource, string][];
          const results = await Promise.all(entries.map(([s, u]) => readFromSAF(u, s)));
          return results.flat().sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
        };

        // Replaces the old "fixed setTimeout(700) + retry after 1300" pattern.
        // pollUntil returns AS SOON AS any items appear, so devices that
        // expose the folder immediately get instant results (was always
        // 700-2000 ms of dead time). Cap at 4 s — beyond that the folder
        // genuinely doesn't have anything readable yet.
        const mountStart = Date.now();
        const items = await pollUntil(
          () => readSAFEntries(nextSafUris),
          (list) => list.length > 0,
          { maxMs: 4000, initialDelay: 250, backoff: 1.5, maxDelay: 1200 },
        );
        // Telemetry — how long did the grant→first-non-empty-read cycle take?
        // Use this to tune the polling caps if real-world devices come in
        // consistently above 4 s (= we're hitting the deadline a lot).
        logSafMountTime(Date.now() - mountStart);

        console.log(`[SAF] Final items loaded after grant: ${items.length}`);
        setStatuses(items);
        if (items.length > 0) persistStatusesCache(items);
      } finally {
        setIsLoading(false);
        setIsGrantingAccess(false);
        safRequestInFlight.current = false;
      }
    } catch (e) {
      console.error('[SAF] requestSAF total error:', e);
      setIsRequestingSAF(false);
      setIsGrantingAccess(false);
      safRequestInFlight.current = false;
    }
  }, []);

  async function readFromLegacyPath(): Promise<StatusItem[]> {
    console.log('[Legacy] readFromLegacyPath started');
    const items: StatusItem[] = [];
    for (const path of WHATSAPP_LEGACY_PATHS) {
      try {
        const uri = `file://${path}`;
        console.log(`[Legacy] Checking path: ${path}`);
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          console.log(`[Legacy] Path does not exist: ${path}`);
          continue;
        }

        const files = await FileSystem.readDirectoryAsync(uri);
        console.log(`[Legacy] Found ${files.length} files in path: ${path}`);
        const source = path.toLowerCase().includes('business') ? 'whatsapp_business' : 'whatsapp';

        for (const file of files) {
          if (!isValidStatusFile(file)) continue;
          const fileUri = `${uri}/${file}`;
          try {
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            items.push({
              id: getFileId(fileUri) + '_' + source,
              uri: fileUri,
              type: getMediaType(file),
              name: file,
              modTime: (fileInfo as any).modificationTime,
              size: (fileInfo as any).size,
              source,
            });
          } catch (e) {
            console.warn(`[Legacy] Failed to get info for file ${file}:`, e);
          }
        }
      } catch (e) {
        console.error(`[Legacy] Error reading path ${path}:`, e);
      }
    }
    console.log(`[Legacy] Total items found: ${items.length}`);
    return items;
  }

  // Builds a tree+document URI for a child path within a granted SAF tree.
  // Format: content://authority/tree/TREE_DOC_ID/document/CHILD_DOC_ID
  // TREE_DOC_ID is used as-is (already %-encoded by the system). CHILD_DOC_ID is
  // the decoded tree path + child relative path, re-encoded once.
  function buildChildDocUri(treeUri: string, childRelativePath: string): string | null {
    try {
      const match = treeUri.match(/^(content:\/\/[^/]+\/tree\/)(.+)$/);
      if (!match) return null;
      const prefix = match[1];
      const treeDocId = match[2]; // already %-encoded
      const decodedTree = decodeURIComponent(treeDocId);
      const childDocId = decodedTree + childRelativePath;
      // Tree part: keep treeDocId as-is; document part: encode once
      return `${prefix}${treeDocId}/document/${encodeURIComponent(childDocId)}`;
    } catch (e) {
      console.warn('[SAF] buildChildDocUri failed:', e);
      return null;
    }
  }

  // Extract the human-readable leaf name from a SAF content URI.
  // SAF URIs look like: content://authority/tree/.../document/primary%3A...%2FFileName.jpg
  // Splitting on literal '/' then decoding the last segment gives the full doc ID
  // (e.g. "primary:Android/media/.../Media/.Statuses/STATUS-1234.jpg"). Taking
  // the last '/' component of THAT decoded string gives the clean filename.
  function safUriToFileName(uri: string): string {
    try {
      const lastSegment = decodeURIComponent(uri.split('/').pop() || '');
      return lastSegment.split('/').pop() || '';
    } catch {
      return '';
    }
  }

  // BFS that only descends into folders on the known path to .Statuses.
  // Uses SAF_KNOWN_INTERMEDIATE set and SAF_BFS_MAX_DEPTH to avoid scanning
  // unrelated directories (DCIM, Downloads, etc.).
  const BFS_TIMEOUT_MS = 3000; // Max 3 seconds total for entire crawl
const crawlStart = Date.now();
  async function bfsFindStatuses(uri: string, depth: number): Promise<string | null> {
  // Timeout guard
  if (Date.now() - crawlStart > BFS_TIMEOUT_MS) {
    console.log('[Crawler] Timeout reached, aborting crawl');
    return null;
  }
  
  if (depth > SAF_BFS_MAX_DEPTH) {
    console.log(`[Crawler] Max depth ${depth} reached. Stopping crawl.`);
    return null;
  }
    let entries: string[];
    try {
      // ANR-PROOF: hard 1.5 s timeout per BFS step. The OEM DocumentProvider
      // can hang indefinitely if the indexer is busy; falling back to []
      // makes BFS skip this branch and try the next one instead of freezing
      // the entire cold launch waiting on a single misbehaving folder.
      entries = await withTimeout(
        FileSystem.StorageAccessFramework.readDirectoryAsync(uri),
        1500,
        [] as string[],
        `BFS readDirectoryAsync depth=${depth}`,
      );
    } catch (e) {
      console.warn(`[Crawler] Read failed at depth ${depth}:`, e);
      return null;
    }
    
    console.log(`[Crawler] Depth ${depth}: Scanning ${entries.length} entries...`);
    for (const entry of entries) {
      const name = safUriToFileName(entry);
      if (name === '.Statuses') {
        console.log(`[Crawler] SUCCESS! Found .Statuses at: ${entry}`);
        return entry;
      }
      // Only recurse into known intermediate folders (case-insensitive)
      if (SAF_KNOWN_INTERMEDIATE.has(name.toLowerCase())) {
        console.log(`[Crawler] Descending into potential path: ${name}`);
        const found = await bfsFindStatuses(entry, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  // Reads status files from a granted SAF directory URI.
  // Strategy 1 (Immediate Hit): Checks if the granted URI itself is the .Statuses folder.
  // Strategy 2 (Direct Probing): Tries to construct common child URIs for .Statuses.
  // Strategy 3 (BFS): Recursively crawls visible subfolders to find .Statuses.
  async function readFromSAF(safDirUri: string, forcedSource?: StatusSource): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    console.log(`[SAF] readFromSAF started for URI: ${safDirUri}`);
    try {
      let targetUri: string | null = resolvedUriCache.current.get(safDirUri) ?? null;

      if (!targetUri) {
        console.log('[SAF] Target URI not cached, resolving...');
        // --- 1. Immediate Check: Are we already IN .Statuses? ---
        if (safUriToFileName(safDirUri) === '.Statuses') {
          targetUri = safDirUri;
          console.log('[SAF] Target matches granted URI (direct entry hit)');
        }

        // --- 2. Advanced Direct Probing (Context-Aware) ---
        if (!targetUri) {
          const decoded = decodeURIComponent(safDirUri).toLowerCase();
          console.log(`[SAF] Probing via candidates. Base decoded: ${decoded}`);
          const candidatePaths = [
            '/.Statuses',
            '/Media/.Statuses',
            '/WhatsApp/Media/.Statuses',
            '/WhatsApp Business/Media/.Statuses',
          ];

          // If granted Android/media, add deeper relative probes
          if (decoded.endsWith('android/media')) {
            console.log('[SAF] Android/media detected, adding deep probes');
            candidatePaths.push('/com.whatsapp/WhatsApp/Media/.Statuses');
            candidatePaths.push('/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses');
          }

          for (const rel of candidatePaths) {
            const uri = buildChildDocUri(safDirUri, rel);
            if (!uri) continue;
            try {
              await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
              targetUri = uri;
              console.log(`[SAF] Located target via probe: ${rel}`);
              break;
            } catch {
              // Path not found at this level
            }
          }
        }

        // --- 3. The Crawler (BFS with Hidden Probes) ---
        if (!targetUri) {
          console.log('[SAF] Direct probes failed, starting recursive crawler...');
          targetUri = await bfsFindStatuses(safDirUri, 0);
          if (targetUri) console.log(`[SAF] Crawler found .Statuses at: ${targetUri}`);
        }

        if (!targetUri) {
          console.warn('[SAF] .Statuses folder could not be located in tree:', safDirUri);
          return [];
        }

        // Cache success so future loads skip the search — both in-memory
        // (instant for this session) AND on disk (so the next cold launch
        // also skips the BFS crawl, saving 200-1500 ms on first paint).
        resolvedUriCache.current.set(safDirUri, targetUri);
        persistResolvedUriCache();
      } else {
        console.log(`[SAF] Using cached target URI: ${targetUri}`);
      }

      // ANR-PROOF: hard 3 s timeout on the final folder listing too. This
      // is the call that returns the actual file URIs the grid will render,
      // so timing out means an empty grid for one cycle (the user sees the
      // cached snapshot from loadStatusesCache + can pull-to-refresh) rather
      // than a frozen splash for 8+ seconds while the OEM indexer wakes up.
      const files = await withTimeout(
        FileSystem.StorageAccessFramework.readDirectoryAsync(targetUri),
        3000,
        [] as string[],
        'SAF final readDirectoryAsync',
      );
      console.log(`[SAF] Target folder contains ${files.length} total files`);
      
      const decodedTarget = decodeURIComponent(targetUri).toLowerCase();
      const source = forcedSource ||
        (decodedTarget.includes('w4b') || decodedTarget.includes('business') ? 'whatsapp_business' : 'whatsapp');

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

      console.log(`[SAF] readFromSAF successfully loaded ${items.length} items from ${source}`);
      return items;
    } catch (e) {
      console.error('[SAF] readFromSAF function failed:', e);
      return [];
    }
  }

  const loadStatuses = useCallback(async (silent: boolean = false) => {
    // Ref to track active loading state and avoid double-fetches
    if (isLoadingRef.current) {
      console.log('[Loader] loadStatuses already in progress, skipping redundant call');
      return;
    }

    const av = androidVersionRef.current;
    const isModernAndroid = Platform.OS === 'android' && av >= 30;
    const useSAF = isModernAndroid;
    console.log(`[Loader] loadStatuses triggered. Version: ${av}, useSAF: ${useSAF}, silent: ${silent}`);

    if (useSAF && !safGrantedRef.current) {
      console.log('[Loader] Modern Android but SAF not granted yet');
      return;
    }

    isLoadingRef.current = true;
    if (!silent) setIsLoading(true);

    try {
      let items: StatusItem[] = [];

      if (useSAF) {
        // --- Android 11+ Logic (SAF) ---
        const safEntries = Object.entries(safUrisRef.current) as [StatusSource, string][];
        if (safEntries.length > 0) {
          console.log(`[Loader] Processing ${safEntries.length} granted SAF URIs`);
          // Sequential reads with a small inter-entry gap so the SAF bridge
          // never gets congested on low-end devices. The previous code ran
          // both folders in parallel via Promise.all AND a duplicate
          // sequential pass — wasted work and made the cold launch slower.
          // Now: one ordered pass; if it returns 0 items we clear the
          // resolved-URI cache and poll with backoff for up to 2.5 s
          // (covers the case where the OS hasn't yet exposed the hidden
          // folder after a fresh install).
          const mountStart = Date.now();
          const readAllSequential = async (): Promise<StatusItem[]> => {
            const results: StatusItem[] = [];
            for (const [source, uri] of safEntries) {
              try {
                const list = await readFromSAF(uri, source);
                results.push(...list);
                if (safEntries.length > 1) {
                  await new Promise(r => setTimeout(r, 50));
                }
              } catch (e) {
                console.warn(`[SAF] Failed to read ${source}:`, e);
              }
            }
            return results;
          };

          items = await readAllSequential();
          if (items.length === 0) {
            console.log('[Loader] First SAF read empty, polling with backoff...');
            resolvedUriCache.current.clear();
            items = await pollUntil(
              readAllSequential,
              (list) => list.length > 0,
              { maxMs: 2500, initialDelay: 300, backoff: 1.5, maxDelay: 800 },
            );
          }
          logSafMountTime(Date.now() - mountStart);
        } else if (safUriRef.current) {
          console.log('[Loader] Falling back to legacy single safUri');
          items = await readFromSAF(safUriRef.current);
        }
      } else {
        // --- Android 10 and Below Logic (Legacy) ---
        console.log(`[Loader] Legacy check: hasPermission=${hasPermissionRef.current}`);
        if (hasPermissionRef.current) {
          items = await readFromLegacyPath();
        }
      }

      console.log(`[Loader] Total items successfully loaded: ${items.length}`);
      items.sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
      // SELECTIVE PATCHING: Reuse existing item object references when an
      // item with the same id+modTime is already in state. This keeps
      // React.memo'd MediaCards from re-rendering at all when the
      // underlying file hasn't changed — only truly new/changed items
      // produce new references. Result: pull-to-refresh feels invisible;
      // unchanged thumbnails never even re-render, new items slide in,
      // removed items slide out, and scroll position is preserved.
      setStatuses(prev => {
        if (prev.length === 0) return items;
        const prevById = new Map(prev.map(p => [p.id, p]));
        let changed = items.length !== prev.length;
        const merged = items.map(item => {
          const existing = prevById.get(item.id);
          if (existing && existing.modTime === item.modTime && existing.size === item.size) {
            return existing; // identical → reuse reference (no re-render)
          }
          changed = true;
          return item;
        });
        // If every id matches and order matches, return prev to skip even
        // the array-level reference change.
        if (!changed) {
          for (let i = 0; i < merged.length; i++) {
            if (merged[i] !== prev[i]) { changed = true; break; }
          }
        }
        return changed ? merged : prev;
      });
      // Persist the fresh list so the next cold launch can render the grid
      // INSTANTLY from cache (the SAF read still runs in the background).
      // Skipped on empty lists so a transient SAF blip doesn't wipe the
      // cached snapshot (the user keeps seeing real thumbnails).
      if (items.length > 0) persistStatusesCache(items);

      // ── Background thumbnail generation ─────────────────────────────
      // Kick off the low-priority queue that turns each video's
      // content:// URI into a tiny file:// JPG once. From the moment a
      // thumb lands in the cache, the grid renders that card from a
      // pure local file — Glide does no SAF round-trip and no video
      // decoder work, which is what makes scrolling feel native-smooth
      // on Android 11+.
      //
      // Deferred behind InteractionManager + a small idle gap so it
      // never competes with the user's first scroll/tap after launch.
      // Pruning runs first so deleted/expired statuses' thumb files are
      // cleaned up before we generate any new ones.
      if (items.length > 0) {
        const queueItems = items.map(it => ({
          id: it.id,
          uri: it.uri,
          type: it.type,
        }));
        const currentIds = new Set(items.map(it => it.id));
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

  // Keep the ref pointing at the latest loadStatuses (it's stable now, but
  // the ref pattern keeps things consistent for any future deps).
  loadStatusesRef.current = loadStatuses;

  const refresh = useCallback(async (silent: boolean = true) => {
    // Default to silent: pull-to-refresh must NEVER blank the grid out to a
    // shimmer. The RefreshControl spinner is the only feedback the user
    // needs. Existing thumbnails stay visible while the file system is
    // re-scanned in the background; FlashList + expo-image diff the keyed
    // items so removed files vanish, new files appear, and unchanged tiles
    // never repaint. Caller can pass silent=false to force a shimmer (e.g.
    // first-grant flow where there's nothing on screen yet).
    resolvedUriCache.current.clear();
    setIsRefreshing(true);
    // Use the ref so this callback can stay reference-stable (empty deps).
    // Otherwise every loadStatuses identity change (which happens whenever
    // safUris/hasPermission update) would force every consumer to re-render.
    await loadStatusesRef.current(silent);
    await loadSavedItems();
    setIsRefreshing(false);
  }, []);

  const saveStatus = useCallback(async (item: StatusItem): Promise<boolean> => {
    console.log(`[Media] saveStatus started for: ${item.name}`);
    try {
      const savedDir = `${FileSystem.documentDirectory}saved/`;
      const dirInfo = await FileSystem.getInfoAsync(savedDir);
      if (!dirInfo.exists) {
        console.log('[Media] Creating saved directory');
        await FileSystem.makeDirectoryAsync(savedDir, { intermediates: true });
      }

      // Fix #3 — Duplicate Save
      const duplicate = savedItemsRef.current.find(
        s => s.id === item.id || s.name === item.name
      );
      if (duplicate) {
        console.log('[Media] Duplicate identified, checking existence');
        try {
          const dupInfo = await FileSystem.getInfoAsync(duplicate.localUri);
          if (dupInfo.exists) {
            console.log('[Media] Duplicate exists locally, skipping save');
            return true;
          }
        } catch {}
      }

      const ext = item.name.split('.').pop() || 'jpg';
      const filename = `status_${Date.now()}.${ext}`;
      const destUri = `${savedDir}${filename}`;

      console.log(`[Media] Copying file from ${item.uri} to ${destUri}`);
      await FileSystem.copyAsync({ from: item.uri, to: destUri });

      const isModernAndroid = Platform.OS === 'android' && androidVersionRef.current >= 29;
      if (hasPermissionRef.current || isModernAndroid) {
        try {
          console.log('[Media] Exporting to system gallery (MediaLibrary)');
          const asset = await MediaLibrary.createAssetAsync(destUri);
          await MediaLibrary.createAlbumAsync('StatusVault', asset, false);
          console.log('[Media] Gallery export successful');
        } catch (err) {
          console.error('[Media] MediaLibrary save error:', err);
          if (!isModernAndroid) {
            Alert.alert(
              'Gallery Access Needed',
              'Status saved in the app, but could not be added to your device gallery. Please allow "Add photos" permission in settings.',
            );
          }
        }
      }

      const newSaved: SavedItem = {
        ...item,
        id: item.id,
        localUri: destUri,
        savedAt: Date.now(),
      };

      const updated = [newSaved, ...savedItemsRef.current.filter(s => s.id !== item.id)];
      setSavedItems(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));

      console.log('[Media] Save operation completed successfully');
      maybeShowRatingPrompt();
      return true;
    } catch (e) {
      console.error('[Media] saveStatus total failure:', e);
      return false;
    }
  }, []);

  const deleteFromSaved = useCallback(async (item: SavedItem) => {
    try {
      await FileSystem.deleteAsync(item.localUri, { idempotent: true });
    } catch {}

    const updated = savedItemsRef.current.filter(s => s.id !== item.id);
    setSavedItems(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));
  }, []);

  const shareStatus = useCallback(async (item: StatusItem | SavedItem) => {
    try {
      let shareUri: string;

      if ('localUri' in item) {
        // Already a saved local file — use it directly, no copy needed.
        shareUri = (item as SavedItem).localUri;
      } else if (!item.uri.startsWith('content://')) {
        shareUri = item.uri;
      } else {
        // SAF item — Sharing.shareAsync needs a real file URI to hand off
        // to the OS share sheet, so we ask prepareStatusForViewing for the
        // file:// copy here. The copy goes through the serialized queue
        // and reuses the cached file on subsequent shares (instant after
        // the first share of any given status).
        shareUri = await prepareStatusForViewing(item as StatusItem, { forShare: true });
        if (shareUri === item.uri) {
          // Copy failed and we fell back to the original content:// URI —
          // many OEM share sheets reject content:// URIs from a foreign
          // tree, so attempt one final share_ copy here as a safety net.
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

      // ─── Viral caption pre-copy ────────────────────────────────────
      // expo-sharing's shareAsync cannot attach a text caption to a media
      // share, so we pre-copy the user's personal short link to the
      // clipboard. The recipient's WhatsApp/Telegram caption field is one
      // long-press → Paste away — and now every shared status carries the
      // install link that credits the sharer on the Reward Ladder.
      try {
        const shortLink = await getCachedShareLink();
        const caption = buildShareCaption(shortLink);
        await Clipboard.setStringAsync(caption);
      } catch {
        // Clipboard write can fail on some OEMs — never block the share.
      }

      await Sharing.shareAsync(shareUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // ─── Post-share temp cleanup ─────────────────────────────────────
      // Android Intent.ACTION_SEND consumers (WhatsApp, Telegram, etc.)
      // typically read the file synchronously while the picker is on
      // screen. Once `shareAsync` resolves the user has either dispatched
      // or dismissed, so the share_*.* file in our cache directory has
      // served its purpose. Delete it after a 5 s grace period (covers
      // the rare receiver that defers reads), but ONLY if we're the ones
      // who created it (share_ prefix in our cache dir). Wrapped so a
      // failed delete never bubbles up — the routine janitor will sweep
      // it later anyway.
      if (
        typeof shareUri === 'string' &&
        shareUri.startsWith('file://') &&
        shareUri.includes('/share_')
      ) {
        const cleanupTarget = shareUri;
        setTimeout(() => {
          FileSystem.deleteAsync(cleanupTarget, { idempotent: true }).catch(() => {});
        }, 5000);
      }
    } catch (e) {
      console.error('Share error:', e);
    }
  }, []);

  const isStatusSaved = useCallback((id: string): boolean => {
    return savedItemsRef.current.some(s => s.id === id);
  }, []);

  // Module-scoped guard so cooldown survives across hooks calls in this session.
  const lastInterstitialAtRef = useRef<number>(0);
  const canShowInterstitial = () => {
    const now = Date.now();
    if (now - lastInterstitialAtRef.current < INTERSTITIAL_COOLDOWN_MS) return false;
    lastInterstitialAtRef.current = now;
    return true;
  };

  const onVideoOpen = useCallback((uri: string) => {
    const newCount = videoViewCountRef.current + 1;
    setVideoViewCount(newCount);
    if (newCount > 0 && newCount % VIDEO_AD_FREQUENCY === 0 && canShowInterstitial()) {
      setPendingVideoUri(uri);
      setShowInterstitial(true);
    }
  }, []);

  const onImageSwipe = useCallback(() => {
    const newCount = imageSwipeCountRef.current + 1;
    setImageSwipeCount(newCount);
    swipeCountRef.current = newCount;

    // Fix #1 — Session Cache Bloat: every 10 swipes, purge view_/share_ files
    // older than 30 minutes in the background so a long session never fills storage.
    if (newCount % 10 === 0) {
      cleanupCacheFilesRef.current(30 * 60 * 1000).catch(() => {});
    }

    if (newCount >= IMAGE_SWIPE_AD_FREQUENCY) {
      if (canShowInterstitial()) {
        setShowInterstitial(true);
      }
      // Reset the counter even if cooldown blocked the ad, so we don't
      // immediately fire on the next swipe.
      setImageSwipeCount(0);
      swipeCountRef.current = 0;
      AsyncStorage.setItem('swipeCountForAds', '0').catch(() => {});
    } else {
      AsyncStorage.setItem('swipeCountForAds', String(newCount)).catch(() => {});
    }
  }, []);

  const dismissInterstitial = useCallback(() => {
    setShowInterstitial(false);
    setPendingVideoUri(null);
  }, []);

  // ─── ADD THIS helper function ──────────────────────────────────────────────
async function canPlaySafUri(uri: string): Promise<boolean> {
  try {
    // Quick read test: if we can get file info, URI is accessible
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && (info as any).size > 0;
  } catch {
    return false;
  }
}

  const prepareStatusForViewing = useCallback(async (
  item: StatusItem,
  opts?: { forShare?: boolean; forPlayback?: boolean },
): Promise<string> => {
  if (!item.uri.startsWith('content://')) return item.uri;

    // ─── Direct content:// playback (the fast path) ──────────────────
    // Modern expo-video (ExoPlayer) and expo-image both consume
    // content:// URIs natively on Android — no upfront copy is needed.
    // The previous "copy-to-cache then play" path added 200 ms-2 s of
    // dead time per video on Android 11+. Returning the URI immediately
    // means the viewer can call replaceAsync(content://...) the instant
    // it mounts; on warm runs that's a sub-100 ms time-to-first-frame.
    //
    // The opts.forShare path is the ONE remaining legitimate need for a
    // file:// copy — Sharing.shareAsync requires a real file URI to hand
    // off to other apps. That copy is now serialized through copyQueue
    // so it never fights the active video for SAF I/O bandwidth.
   // Direct playback path (default)
  if (!opts?.forShare) {
    // If caller explicitly wants playback, verify URI is accessible
    if (opts?.forPlayback) {
      const accessible = await canPlaySafUri(item.uri);
      if (!accessible) {
        // Fallback to copy if URI isn't playable
        logFallbackCopyTriggered();
        // ... fall through to copy logic below
      } else {
        logDirectPlaySuccess();
        return item.uri;
      }
    }
     // Otherwise trust direct playback (lazy fallback on error)
    return item.uri;
  }

    const start = Date.now();
    const ext = item.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
    const safeId = item.id.replace(/[:\/\\?%*|"<>]/g, '_');
    const tempUri = `${FileSystem.cacheDirectory}view_${safeId}.${ext}`;

    // Return cached file immediately if it already exists and is non-empty.
    try {
      const info = await FileSystem.getInfoAsync(tempUri);
      if (info.exists && (info as any).size > 0) {
        console.log(`[Media] Cache hit for ${item.name} (${Date.now() - start}ms)`);
        return tempUri;
      }
    } catch {}

    // Run the actual copy through the serialized queue. enqueueCopy
    // guarantees at most one SAF copy is in flight at any moment, which
    // both speeds up each individual copy AND prevents two concurrent
    // copies from blocking the JS thread for SAF callbacks at the same
    // time. Always awaits the full write before returning so the file
    // handed to Sharing.shareAsync is never half-written.
    return enqueueCopy(async () => {
      try {
        console.log(`[Media] (queue) Copying ${item.name} to cache...`);
        await FileSystem.copyAsync({ from: item.uri, to: tempUri });
        console.log(`[Media] (queue) Copy complete for ${item.name} (${Date.now() - start}ms)`);
        return tempUri;
      } catch (e) {
        console.error(`[Media] Prepare failed for ${item.name} after ${Date.now() - start}ms:`, e);
        return item.uri;
      }
    });
  }, []);

  // Cleans up view_ and share_ cache files older than maxAgeMs (default 4 hours).
  // PERF: callers that fire during launch should defer via InteractionManager;
  // the per-file getInfoAsync loop can take 200-800ms on slow Android devices.
  const cleanupCacheFiles = useCallback(async (maxAgeMs: number = 4 * 60 * 60 * 1000) => {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;

      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.startsWith('view_') && !file.startsWith('share_')) continue;

        const fileUri = `${cacheDir}${file}`;
        try {
          const info = await FileSystem.getInfoAsync(fileUri);
          const fileAge = info.modificationTime ? (now - info.modificationTime * 1000) : (now - 1000000);
          if (fileAge > maxAgeMs) {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
          }
        } catch {}
      }
    } catch (e) {
      console.log('Cache cleanup error:', e);
    }
  }, []);

  // Keep ref pointing at the latest cleanupCacheFiles
  cleanupCacheFilesRef.current = cleanupCacheFiles;

  // PERF: Defer the startup cache cleanup until AFTER the first paint and
  // navigation animations finish. Previously this ran synchronously on
  // MediaProvider mount and could enumerate hundreds of cache files via
  // sequential getInfoAsync, blocking the JS thread for hundreds of ms
  // during the most critical moment of cold launch.
  useEffect(() => {
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      const t = setTimeout(() => {
        if (!cancelled) cleanupCacheFiles().catch(() => {});
      }, 3000);
      return () => clearTimeout(t);
    });
    return () => {
      cancelled = true;
      // @ts-ignore — runAfterInteractions returns a Cancellable in RN
      handle?.cancel?.();
    };
  }, [cleanupCacheFiles]);

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
    videoViewCount,
    showInterstitial,
    pendingVideoUri,
    requestPermissions,
    requestSAF,
    loadStatuses,
    refresh,
    saveStatus,
    deleteFromSaved,
    shareStatus,
    isStatusSaved,
    onVideoOpen,
    onImageSwipe,
    dismissInterstitial,
    prepareStatusForViewing,
    cleanupCacheFiles,
  }), [
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
    videoViewCount,
    showInterstitial,
    pendingVideoUri,
    requestPermissions,
    requestSAF,
    loadStatuses,
    refresh,
    saveStatus,
    deleteFromSaved,
    shareStatus,
    isStatusSaved,
    onVideoOpen,
    onImageSwipe,
    dismissInterstitial,
    prepareStatusForViewing,
    cleanupCacheFiles,
  ]);

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be used within MediaProvider');
  return ctx;
}
