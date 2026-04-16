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

const SAF_INITIAL_URIS: Record<StatusSource, string> = {
  whatsapp: 'content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp%2FWhatsApp%2FMedia%2F.Statuses',
  whatsapp_business: 'content://com.android.externalstorage.documents/tree/primary%3AAndroid%2Fmedia%2Fcom.whatsapp.w4b%2FWhatsApp%20Business%2FMedia%2F.Statuses',
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
      const { status } = await MediaLibrary.getPermissionsAsync();
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
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
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
            setIsLoading(true);
            try {
              const safEntries = Object.entries(nextSafUris) as [StatusSource, string][];
              const results = await Promise.all(safEntries.map(([entrySource, uri]) => readFromSAF(uri, entrySource)));
              const items = results.flat().sort((a, b) => (b.modTime || 0) - (a.modTime || 0));
              setStatuses(items);
            } finally {
              setIsLoading(false);
            }
          }
        } catch (e) {
          setIsRequestingSAF(false);
          Alert.alert('Permission Error', 'Could not access storage. Please try again.');
        }
      }, 500);
    } catch (e) {
      setIsRequestingSAF(false);
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

  // Smart BFS: follows only known folder names toward .Statuses up to 6 levels
  // deep. Works regardless of which level the user granted:
  //   Root → Android → media → com.whatsapp → WhatsApp → Media → .Statuses
  // Results are cached in resolvedUriCache (per app session) so the walk
  // is never repeated for the same granted URI.
  async function resolveStatusesUri(grantedUri: string): Promise<string> {
    const cache = resolvedUriCache.current;

    if (cache.has(grantedUri)) return cache.get(grantedUri)!;
    if (isStatusesUri(grantedUri)) {
      cache.set(grantedUri, grantedUri);
      return grantedUri;
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

    // No .Statuses found — fall back to the granted URI as-is
    cache.set(grantedUri, grantedUri);
    return grantedUri;
  }

  async function readFromSAF(safDirUri: string, forcedSource?: StatusSource): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    try {
      // Resolve the .Statuses folder regardless of which level the user granted:
      // ✓ Granted exactly at .Statuses (new default, fast path)
      // ✓ Granted at Media (legacy), WhatsApp, or any ancestor up to 2 levels
      // ✓ Device OEM ignored our initialUri hint and opened at storage root
      // ✓ WA Business variant with different path structure
      const targetUri = await resolveStatusesUri(safDirUri);

      // Read the resolved .Statuses folder directly
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetUri);
      const isBusiness = decodeURIComponent(targetUri).toLowerCase().includes('w4b') || 
                        decodeURIComponent(targetUri).toLowerCase().includes('business');
      const source = forcedSource || (isBusiness ? 'whatsapp_business' : 'whatsapp');

      // Process files in parallel to speed up SAF enumeration
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
      if (forcedSource) {
        const nextSafUris = { ...safUris };
        delete nextSafUris[forcedSource];
        setSafUris(nextSafUris);
        setSafUri(nextSafUris.whatsapp || nextSafUris.whatsapp_business || null);
        setSafGranted(Boolean(nextSafUris.whatsapp || nextSafUris.whatsapp_business));
        await AsyncStorage.setItem(STORAGE_KEYS.SAF_URIS, JSON.stringify(nextSafUris));
      } else {
        setSafGranted(false);
        setSafUri(null);
        setSafUris({});
        await AsyncStorage.removeItem(STORAGE_KEYS.SAF_URI);
        await AsyncStorage.removeItem(STORAGE_KEYS.SAF_URIS);
      }
    }
    return items;
  }

  const loadStatuses = useCallback(async () => {
    const needsMediaPermission = Platform.OS === 'android' && androidVersion < 30;
    if (!hasPermission && needsMediaPermission) {
      const granted = await checkExistingPermissions();
      if (!granted) return;
    }

    setIsLoading(true);
    try {
      let items: StatusItem[] = [];

      if (androidVersion >= 30 && safGranted) {
        const safEntries = Object.entries(safUris) as [StatusSource, string][];
        if (safEntries.length > 0) {
          const results = await Promise.all(safEntries.map(([source, uri]) => readFromSAF(uri, source)));
          items = results.flat();
        } else if (safUri) {
          items = await readFromSAF(safUri);
        }
      } else {
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

      if (hasPermission) {
        try {
          const asset = await MediaLibrary.createAssetAsync(destUri);
          await MediaLibrary.createAlbumAsync('StatusVault', asset, false);
        } catch (err) {
          console.log('MediaLibrary save error:', err);
          // File is saved inside the app (Saved tab will work), but gallery was denied.
          Alert.alert(
            'Gallery Access Denied',
            'Status saved in the app, but could not be added to your Gallery. To see it in Photos, allow media access in your phone Settings.',
          );
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
