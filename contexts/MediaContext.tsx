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
import { Platform, Alert, Share, Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VIDEO_AD_FREQUENCY } from '@/constants/admob';

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
  refresh: () => Promise<void>;
  saveStatus: (item: StatusItem) => Promise<boolean>;
  deleteFromSaved: (item: SavedItem) => Promise<void>;
  shareStatus: (item: StatusItem | SavedItem) => Promise<void>;
  isStatusSaved: (id: string) => boolean;
  onVideoOpen: (uri: string) => void;
  onImageSwipe: () => void;
  dismissInterstitial: () => void;
  prepareStatusForViewing: (item: StatusItem) => Promise<string>;
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
  const lower = name.toLowerCase();
  const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mkv', '.3gp', '.mov'];
  return validExts.some(ext => lower.endsWith(ext)) && !lower.startsWith('.');
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
  // In-memory cache: grantedUri → resolved .Statuses URI.
  // Prevents re-walking the folder tree on every loadStatuses call.
  const resolvedUriCache = useRef<Map<string, string>>(new Map());

  const androidVersion = Platform.OS === 'android' ? (Platform.Version as number) : 0;

  const storageMethod: AndroidStorageMethod = useMemo(() => {
    if (Platform.OS !== 'android') return 'unknown';
    if (androidVersion >= 30) return safGranted ? 'saf' : 'scoped';
    if (androidVersion >= 29) return 'scoped';
    return 'legacy';
  }, [androidVersion, safGranted]);

  // Single init effect — waits for all permission/storage checks before marking ready
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await Promise.all([
          checkExistingPermissions(),
          loadSAFUri(),
          loadSavedItems(),
          AsyncStorage.getItem('swipeCountForAds').then(saved => {
            if (saved) {
              const count = parseInt(saved, 10);
              swipeCountRef.current = count;
              setImageSwipeCount(count);
            }
          }).catch(() => {}),
        ]);
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };
    init();
    return () => { mounted = false; };
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

  async function loadSavedItems() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_ITEMS);
      if (stored) {
        const items: SavedItem[] = JSON.parse(stored);
        const valid: SavedItem[] = [];
        for (const item of items) {
          try {
            const info = await FileSystem.getInfoAsync(item.localUri);
            if (info.exists) valid.push(item);
          } catch {}
        }
        setSavedItems(valid);
        if (valid.length !== items.length) {
          await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(valid));
        }
      }
    } catch {}
  }

  async function checkExistingPermissions(): Promise<boolean> {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync(true);
      setPermissionStatus(status);
      const granted = status === 'granted';
      setHasPermission(granted);
      return granted;
    } catch {
      return false;
    }
  }

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      setPermissionStatus(status);
      const granted = status === 'granted';
      setHasPermission(granted);
      if (granted) {
        await loadStatuses();
      }
      return granted;
    } catch {
      return false;
    }
  }, [loadStatuses]);

  const [isRequestingSAF, setIsRequestingSAF] = useState(false);
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);

  const requestSAF = useCallback(async (source: StatusSource = 'whatsapp', manual: boolean = false) => {
    if (Platform.OS !== 'android') return;
    try {
      // Fix #2 — Work Profile Blindspot: when `manual` is true (or the standard
      // initial URI is unavailable), open the picker at the storage root so
      // users with Dual Apps / Work Profiles can navigate to their second
      // WhatsApp's media folder manually.
      const initialUri = manual ? undefined : SAF_INITIAL_URIS[source];

      setIsRequestingSAF(true);
      // Give a tiny delay for the overlay to mount before opening system picker
      setTimeout(async () => {
        try {
          const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri ?? null);
          setIsRequestingSAF(false);

          if (result.granted) {
            const nextSafUris = { ...safUris, [source]: result.directoryUri };
            await AsyncStorage.setItem(STORAGE_KEYS.SAF_URIS, JSON.stringify(nextSafUris));
            await AsyncStorage.setItem(STORAGE_KEYS.SAF_URI, result.directoryUri);
            setSafUris(nextSafUris);
            setSafUri(result.directoryUri);
            setSafGranted(true);

            // Mark as "granting" so the UI shows shimmer instead of empty state
            // while we wait for Android to fully mount the SAF folder.
            setIsGrantingAccess(true);
            setIsLoading(true);

            // Clear the BFS cache for this URI so the fresh grant always triggers
            // a clean walk — never reuses a stale "empty" result from before.
            resolvedUriCache.current.delete(result.directoryUri);

            try {
              // === Graceful Delay ===
              // Android needs ~500-800ms to fully "mount" the newly granted SAF
              // folder to this process. Reading immediately returns [] even when
              // files exist. We wait 700ms before the first attempt.
              await new Promise(res => setTimeout(res, 700));

              const readSAFEntries = async (uriMap: Partial<Record<StatusSource, string>>) => {
                const entries = Object.entries(uriMap) as [StatusSource, string][];
                const results = await Promise.all(entries.map(([s, u]) => readFromSAF(u, s)));
                return results.flat().sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
              };

              let items = await readSAFEntries(nextSafUris);

              // === Auto-Retry ===
              // If we still get 0 items after the settling delay, the Android
              // media indexer may not have exposed the hidden .Statuses folder yet.
              // Wait another 1.3 seconds and try once more before giving up.
              if (items.length === 0) {
                await new Promise(res => setTimeout(res, 1300));
                // Also clear cache again before retry so BFS re-walks
                resolvedUriCache.current.delete(result.directoryUri);
                items = await readSAFEntries(nextSafUris);
              }

              setStatuses(items);
            } finally {
              setIsLoading(false);
              setIsGrantingAccess(false);
            }
          }
        } catch (e) {
          setIsRequestingSAF(false);
          setIsGrantingAccess(false);
          Alert.alert('Permission Error', 'Could not access storage. Please try again.');
        }
      }, 500);
    } catch (e) {
      setIsRequestingSAF(false);
      setIsGrantingAccess(false);
      Alert.alert('Permission Error', 'Could not access storage. Please try again.');
    }
  }, [loadStatuses, safUris]);

  async function readFromLegacyPath(): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    for (const path of WHATSAPP_LEGACY_PATHS) {
      try {
        const uri = `file://${path}`;
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) continue;

        const files = await FileSystem.readDirectoryAsync(uri);
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
          } catch {}
        }
      } catch {}
    }
    return items;
  }

  // Known folder names that lie on the path from any SAF root to .Statuses.
  // The BFS only descends into these folders, so we never waste time on
  // Downloads, DCIM, or any other unrelated directory.
  const SAF_INTERESTING_NAMES = new Set([
    '.statuses',          // target — found it
    'media',              // both "WhatsApp/Media" and "Android/media"
    'android',            // Internal Storage/Android
    'com.whatsapp',       // Android/media/com.whatsapp
    'com.whatsapp.w4b',   // Android/media/com.whatsapp.w4b
    'whatsapp',           // com.whatsapp/WhatsApp
    'whatsapp business',  // com.whatsapp.w4b/WhatsApp Business
  ]);

  function isStatusesUri(uri: string): boolean {
    return decodeURIComponent(uri).toLowerCase().includes('/.statuses');
  }

  // Builds a tree+document URI for a child path within a granted SAF tree.
  // This is the Android-native way to access a known child (e.g. /.Statuses)
  // even when readDirectoryAsync doesn't list it (hidden folder problem).
  // Format: content://authority/tree/TREE_DOC_ID/document/CHILD_DOC_ID
  function buildChildDocUri(treeUri: string, childRelPath: string): string | null {
    try {
      const match = treeUri.match(/^(content:\/\/[^\/]+\/tree\/)(.+)$/);
      if (!match) return null;
      const prefix = match[1];          // "content://authority/tree/"
      const treeDocId = match[2];       // already percent-encoded tree doc ID
      const childDocId = treeDocId + encodeURIComponent(childRelPath);
      return `${prefix}${treeDocId}/document/${childDocId}`;
    } catch {
      return null;
    }
  }

  // Smart BFS: follows only known folder names toward .Statuses up to 6 levels
  // deep. Works regardless of which level the user granted:
  //   Root → Android → media → com.whatsapp → WhatsApp → Media → .Statuses
  // If BFS can't find .Statuses (hidden folder not listed on some devices), falls
  // back to direct child URI construction using the Android tree+document format.
  // Results are cached only on success so failed resolutions are always retried.
  async function resolveStatusesUri(grantedUri: string): Promise<string | null> {
    const cache = resolvedUriCache.current;

    if (cache.has(grantedUri)) return cache.get(grantedUri)!;

    // Fast path: the user granted exactly the .Statuses folder.
    // Try reading it immediately; if it works, use it.
    if (isStatusesUri(grantedUri)) {
      try {
        await FileSystem.StorageAccessFramework.readDirectoryAsync(grantedUri);
        cache.set(grantedUri, grantedUri);
        return grantedUri;
      } catch {
        // Tree URI for .Statuses is unreadable on this device — fall through
        // to try direct child construction from its parent (if possible).
      }
    }

    // BFS queue: [uri, depth]
    const queue: Array<[string, number]> = [[grantedUri, 0]];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const [current, depth] = queue.shift()!;
      if (depth > 6 || visited.has(current)) continue;
      visited.add(current);

      let children: string[] = [];
      try {
        children = await FileSystem.StorageAccessFramework.readDirectoryAsync(current);
      } catch {
        continue; // not a readable directory — skip
      }

      // Immediately check all children for the .Statuses folder
      const target = children.find(c => isStatusesUri(c));
      if (target) {
        cache.set(grantedUri, target);
        return target;
      }

      // Enqueue children whose names are on the known path to .Statuses
      for (const child of children) {
        const decoded = decodeURIComponent(child).toLowerCase();
        const name = decoded.split('/').pop() || decoded.split('%2f').pop() || '';
        if (SAF_INTERESTING_NAMES.has(name)) {
          queue.push([child, depth + 1]);
        }
      }
    }

    // BFS couldn't find .Statuses — possibly because some Android versions
    // don't list hidden folders (starting with '.') in readDirectoryAsync.
    // Try direct child URI construction: this uses the Android tree+document
    // URI format which bypasses the directory listing and accesses the child
    // path directly within the granted tree.
    const directCandidates = [
      '/.Statuses',
      '/Media/.Statuses',
      '/WhatsApp/Media/.Statuses',
      '/WhatsApp Business/Media/.Statuses',
    ];
    for (const relPath of directCandidates) {
      const candidateUri = buildChildDocUri(grantedUri, relPath);
      if (!candidateUri) continue;
      try {
        // If readDirectoryAsync doesn't throw, the URI is accessible.
        // An empty result is OK — statuses may just be empty right now.
        await FileSystem.StorageAccessFramework.readDirectoryAsync(candidateUri);
        cache.set(grantedUri, candidateUri);
        return candidateUri;
      } catch {
        // This path not accessible — try next candidate
      }
    }

    // Nothing found — return null so the caller knows resolution failed.
    // Do NOT cache this failure; next call must retry (indexer may expose
    // the folder later).
    return null;
  }

  async function readFromSAF(safDirUri: string, forcedSource?: StatusSource): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    try {
      // Resolve the .Statuses folder regardless of which level the user granted.
      // Returns null if no accessible .Statuses path can be found — in that case
      // we return [] and let the caller retry later (never clear stored permissions).
      const targetUri = await resolveStatusesUri(safDirUri);
      if (!targetUri) return items;

      // Read the resolved .Statuses folder
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetUri);
      const isBusiness = decodeURIComponent(targetUri).toLowerCase().includes('w4b') ||
                        decodeURIComponent(targetUri).toLowerCase().includes('business');
      const source = forcedSource || (isBusiness ? 'whatsapp_business' : 'whatsapp');

      for (const fileUri of files) {
        const name = decodeURIComponent(fileUri.split('%2F').pop() || fileUri.split('/').pop() || '');
        if (!isValidStatusFile(name)) continue;
        items.push({
          id: getFileId(fileUri) + '_' + source,
          uri: fileUri,
          type: getMediaType(name),
          name,
          source,
        });
      }
    } catch (e) {
      // Do NOT clear stored permissions on any error. A transient failure
      // (timing, Android mount lag, first open after reboot) used to permanently
      // delete the SAF URI, forcing the user to re-grant every time something
      // went wrong. Now we just return [] and let the retry logic handle it.
      console.warn('[SAF] readFromSAF error (permissions kept):', e);
    }
    return items;
  }

  const loadStatuses = useCallback(async () => {
    const isModernAndroid = Platform.OS === 'android' && androidVersion >= 30;

    // If we have SAF granted, we use it regardless of broad gallery permissions.
    // This is the privacy-friendly way Google prefers.
    const canUseSAF = safGranted || (isModernAndroid && safUri);

    setIsLoading(true);
    try {
      let items: StatusItem[] = [];

      if (canUseSAF) {
        const safEntries = Object.entries(safUris) as [StatusSource, string][];
        if (safEntries.length > 0) {
          const results = await Promise.all(safEntries.map(([source, uri]) => readFromSAF(uri, source)));
          items = results.flat();

          // Auto-retry: if we have granted URIs but got 0 items, Android's indexer
          // may not have finished exposing the hidden .Statuses folder yet.
          // Clear the BFS cache and try once more after a 1 second pause.
          if (items.length === 0) {
            await new Promise(res => setTimeout(res, 1000));
            resolvedUriCache.current.clear();
            const retryResults = await Promise.all(safEntries.map(([source, uri]) => readFromSAF(uri, source)));
            items = retryResults.flat();
          }
        } else if (safUri) {
          items = await readFromSAF(safUri);
        }
      } else {
        // Fallback to legacy path only if SAF isn't setup.
        // Note: This may fail on newer Android versions without broad permissions,
        // which is expected; the UI will guide the user to grant SAF access instead.
        items = await readFromLegacyPath();
      }

      items.sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
      setStatuses(items);
    } catch (e) {
      console.error('Error loading statuses:', e);
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission, androidVersion, safGranted, safUri, safUris]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    // Clear the BFS path cache so every manual refresh re-walks the folder tree.
    // This is what makes the refresh button actually pick up new statuses —
    // without this, a stale cached path (from a previous failed BFS) is reused
    // and the folder appears empty forever until the app restarts.
    resolvedUriCache.current.clear();
    await loadStatuses();
    await loadSavedItems();
    setIsRefreshing(false);
  }, [loadStatuses]);

  const saveStatus = useCallback(async (item: StatusItem): Promise<boolean> => {
    try {
      const savedDir = `${FileSystem.documentDirectory}saved/`;
      const dirInfo = await FileSystem.getInfoAsync(savedDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(savedDir, { intermediates: true });
      }

      // Fix #3 — Duplicate Save: check if an item with the same original filename
      // or the same item ID already exists in the saved folder. If so, skip the copy
      // and return true so the UI shows "Saved" without wasting disk space.
      const duplicate = savedItems.find(
        s => s.id === item.id || s.name === item.name
      );
      if (duplicate) {
        try {
          const dupInfo = await FileSystem.getInfoAsync(duplicate.localUri);
          if (dupInfo.exists) return true;
        } catch {}
        // If the file is gone, fall through and re-save it
      }

      const ext = item.name.split('.').pop() || 'jpg';
      const filename = `status_${Date.now()}.${ext}`;
      const destUri = `${savedDir}${filename}`;

      await FileSystem.copyAsync({ from: item.uri, to: destUri });

      // On Android 10+ (API 29+), we can save to public Media Store without 
      // broad READ/WRITE permissions. We try this regardless of 'hasPermission'.
      const isModernAndroid = Platform.OS === 'android' && androidVersion >= 29;

      if (hasPermission || isModernAndroid) {
        try {
          const asset = await MediaLibrary.createAssetAsync(destUri);
          await MediaLibrary.createAlbumAsync('StatusVault', asset, false);
        } catch (err) {
          console.log('MediaLibrary save error:', err);
          // Only alert user if we aren't on Modern Android (which should have worked)
          // or if the error specifically indicates a permission issue we didn't expect.
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

      const updated = [newSaved, ...savedItems.filter(s => s.id !== item.id)];
      setSavedItems(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));

      maybeShowRatingPrompt();

      return true;
    } catch (e) {
      console.error('Save error:', e);
      return false;
    }
  }, [savedItems, hasPermission]);

  const deleteFromSaved = useCallback(async (item: SavedItem) => {
    try {
      await FileSystem.deleteAsync(item.localUri, { idempotent: true });
    } catch {}

    const updated = savedItems.filter(s => s.id !== item.id);
    setSavedItems(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));
  }, [savedItems]);

  const shareStatus = useCallback(async (item: StatusItem | SavedItem) => {
    try {
      let shareUri: string;

      if ('localUri' in item) {
        // Already a saved local file — use it directly, no copy needed
        shareUri = (item as SavedItem).localUri;
      } else if (!item.uri.startsWith('content://')) {
        shareUri = item.uri;
      } else {
        // Reuse the view_ cache file if it was already prepared for viewing —
        // avoids a redundant disk copy and makes sharing instant.
        const ext = item.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
        const safeId = item.id.replace(/[:\/\\?%*|"<>]/g, '_');
        const viewCacheUri = `${FileSystem.cacheDirectory}view_${safeId}.${ext}`;
        const info = await FileSystem.getInfoAsync(viewCacheUri);
        if (info.exists && (info as any).size > 0) {
          shareUri = viewCacheUri;
        } else {
          // Fall back: write a deduplicated share_ file (keyed by item id, not timestamp)
          const shareFile = `${FileSystem.cacheDirectory}share_${safeId}.${ext}`;
          const shareInfo = await FileSystem.getInfoAsync(shareFile);
          if (!shareInfo.exists) {
            await FileSystem.copyAsync({ from: item.uri, to: shareFile });
          }
          shareUri = shareFile;
        }
      }

      await Sharing.shareAsync(shareUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.error('Share error:', e);
    }
  }, []);

  const isStatusSaved = useCallback((id: string): boolean => {
    return savedItems.some(s => s.id === id);
  }, [savedItems]);

  const onVideoOpen = useCallback((uri: string) => {
    const newCount = videoViewCount + 1;
    setVideoViewCount(newCount);
    if (newCount % VIDEO_AD_FREQUENCY === 0) {
      setPendingVideoUri(uri);
      setShowInterstitial(true);
    }
  }, [videoViewCount]);

  const onImageSwipe = useCallback(() => {
    const newCount = imageSwipeCount + 1;
    setImageSwipeCount(newCount);
    swipeCountRef.current = newCount;

    // Fix #1 — Session Cache Bloat: every 10 swipes, purge view_/share_ files
    // older than 30 minutes in the background so a long session never fills storage.
    if (newCount % 10 === 0) {
      cleanupCacheFiles(30 * 60 * 1000).catch(() => {});
    }

    // Show interstitial every 8 swipes (fixed)
    const adFrequency = 8;
    if (newCount >= adFrequency) {
      setShowInterstitial(true);
      setImageSwipeCount(0);
      swipeCountRef.current = 0;
      // Persist to AsyncStorage
      AsyncStorage.setItem('swipeCountForAds', '0').catch(() => {});
    } else {
      // Persist current count
      AsyncStorage.setItem('swipeCountForAds', String(newCount)).catch(() => {});
    }
  }, [imageSwipeCount, cleanupCacheFiles]);

  const dismissInterstitial = useCallback(() => {
    setShowInterstitial(false);
    setPendingVideoUri(null);
  }, []);

  const prepareStatusForViewing = useCallback(async (item: StatusItem): Promise<string> => {
    // For local files (saved items), return the uri as is
    if (!item.uri.startsWith('content://')) return item.uri;

    try {
      const ext = item.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
      const safeId = item.id.replace(/[:\/\\?%*|"<>]/g, '_');
      const tempUri = `${FileSystem.cacheDirectory}view_${safeId}.${ext}`;

      // Return cached file immediately if it already exists and is non-empty
      const info = await FileSystem.getInfoAsync(tempUri);
      if (info.exists && (info as any).size > 0) {
        return tempUri;
      }

      // Always await the full copy before returning. The player must never
      // receive a URI while the file is still being written — that causes
      // the decoder to fail the video track and produce a black screen.
      // A partial file is worse than a small delay.
      await FileSystem.copyAsync({ from: item.uri, to: tempUri });
      return tempUri;
    } catch (e) {
      console.error('Prepare for viewing error:', e);
      return item.uri;
    }
  }, []);

  // Cleans up view_ and share_ cache files older than maxAgeMs (default 4 hours)
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

  // Run full cache cleanup (4h lifetime) on every app startup
  useEffect(() => {
    cleanupCacheFiles().catch(() => {});
  }, [cleanupCacheFiles]);

  const value: MediaContextValue = {
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
  };

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be used within MediaProvider');
  return ctx;
}
