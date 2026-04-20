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
import { Platform, Alert, Share, Linking, InteractionManager } from 'react-native';
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
  // In-memory cache: grantedUri → resolved .Statuses URI.
  // Prevents re-walking the folder tree on every loadStatuses call.
  const resolvedUriCache = useRef<Map<string, string>>(new Map());
  // Guard: prevents a second requestSAF call while one is already in flight
  // (e.g. double-tap or concurrent effect trigger) which causes the
  // "unfinished permission request" native error.
  const safRequestInFlight = useRef(false);

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

    // Prevent concurrent calls — Android throws "unfinished permission request"
    // if requestDirectoryPermissionsAsync is called while one is already open.
    if (safRequestInFlight.current) return;
    safRequestInFlight.current = true;

    // Work Profile support: when `manual` is true, open at storage root so the
    // user can navigate to their second WhatsApp's media folder.
    const initialUri = manual ? undefined : SAF_INITIAL_URIS[source];

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
        result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri ?? null);
      } catch (e) {
        console.error('[SAF] requestDirectoryPermissionsAsync failed:', e);
        setIsRequestingSAF(false);
        safRequestInFlight.current = false;
        return;
      }

      setIsRequestingSAF(false);

      if (!result.granted) {
        safRequestInFlight.current = false;
        return;
      }

      const nextSafUris = { ...safUris, [source]: result.directoryUri };
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
        // Android needs ~700ms to fully expose a newly granted hidden folder.
        await new Promise(res => setTimeout(res, 700));

        const readSAFEntries = async (uriMap: Partial<Record<StatusSource, string>>) => {
          const entries = Object.entries(uriMap) as [StatusSource, string][];
          const results = await Promise.all(entries.map(([s, u]) => readFromSAF(u, s)));
          return results.flat().sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
        };

        let items = await readSAFEntries(nextSafUris);

        // Auto-retry: if still empty, wait another 1.3 s and try once more.
        if (items.length === 0) {
          await new Promise(res => setTimeout(res, 1300));
          resolvedUriCache.current.delete(result.directoryUri);
          items = await readSAFEntries(nextSafUris);
        }

        setStatuses(items);
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
  async function bfsFindStatuses(uri: string, depth: number): Promise<string | null> {
    if (depth > SAF_BFS_MAX_DEPTH) return null;
    let entries: string[];
    try {
      entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(uri);
    } catch {
      return null;
    }
    for (const entry of entries) {
      const name = safUriToFileName(entry);
      if (name === '.Statuses') return entry;
      // Only recurse into known intermediate folders (case-insensitive)
      if (SAF_KNOWN_INTERMEDIATE.has(name.toLowerCase())) {
        const found = await bfsFindStatuses(entry, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  // Reads status files from a granted SAF directory URI.
  // Strategy 1 (fast path): directly construct child URIs for all known relative
  //   paths from the grant root to .Statuses — no listing required, works even
  //   when .Statuses is hidden and not returned by readDirectoryAsync.
  // Strategy 2 (BFS): walk the visible folder tree using SAF_KNOWN_INTERMEDIATE
  //   folder names, up to SAF_BFS_MAX_DEPTH levels.
  // Results are cached in resolvedUriCache so repeated loadStatuses() calls skip
  // the expensive BFS. Cache is cleared on manual refresh and on new grants.
  async function readFromSAF(safDirUri: string, forcedSource?: StatusSource): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    try {
      let targetUri: string | null = resolvedUriCache.current.get(safDirUri) ?? null;

      if (!targetUri) {
        // --- Strategy 1: direct child URI construction ---
        // These cover every level the user might have granted access at.
        const candidatePaths = [
          '/.Statuses',
          '/Media/.Statuses',
          '/WhatsApp/Media/.Statuses',
          '/WhatsApp Business/Media/.Statuses',
          '/Android/media/com.whatsapp/WhatsApp/Media/.Statuses',
          '/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses',
        ];

        for (const relPath of candidatePaths) {
          const candidateUri = buildChildDocUri(safDirUri, relPath);
          if (!candidateUri) continue;
          try {
            // Just check if the URI is accessible — accept even an empty folder.
            // (Rejecting empty folders was the bug: fresh installs or users who
            // haven't viewed any status yet would fail here every time.)
            await FileSystem.StorageAccessFramework.readDirectoryAsync(candidateUri);
            targetUri = candidateUri;
            console.log(`[SAF] Direct hit at: ${relPath}`);
            break;
          } catch {
            // Path not accessible at this grant level — try the next candidate
          }
        }

        // --- Strategy 2: BFS through visible folder tree ---
        if (!targetUri) {
          console.log('[SAF] Direct paths failed, starting BFS...');
          targetUri = await bfsFindStatuses(safDirUri, 0);
          if (targetUri) console.log('[SAF] BFS found .Statuses');
        }

        if (!targetUri) {
          console.warn('[SAF] .Statuses not found for URI:', safDirUri);
          return [];
        }

        // Cache on success so future loadStatuses() calls skip the BFS
        resolvedUriCache.current.set(safDirUri, targetUri);
      }

      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetUri);
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

      console.log(`[SAF] Loaded ${items.length} items from ${source}`);
      return items;
    } catch (e) {
      console.error('[SAF] readFromSAF error:', e);
      return [];
    }
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
    // Clear the BFS path cache so every manual refresh re-walks the folder tree.
    // Without this, a cached empty path would be reused forever.
    resolvedUriCache.current.clear();
    setIsRefreshing(true);
    setStatuses([]); // clear UI immediately so user sees fresh load
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
