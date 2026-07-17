/**
 * MediaContextLegacy — Android 10 and below provider.
 *
 * Uses direct file-system access to read WhatsApp statuses from the
 * well-known .Statuses paths. No SAF, no folder picker required.
 * The user grants standard READ_EXTERNAL_STORAGE / MediaLibrary permission.
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
  enqueueCopy,
} from './media/types';

const WHATSAPP_LEGACY_PATHS = [
  '/storage/emulated/0/WhatsApp/Media/.Statuses',
  '/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/.Statuses',
  '/storage/emulated/0/WhatsApp Business/Media/.Statuses',
  '/storage/emulated/0/Android/media/com.whatsapp.w4b/WhatsApp Business/Media/.Statuses',
];

const RATING_TRIGGER_COUNT = 10;

// ─────────────────────────────────────────────────────────────────────────
export function MediaProviderLegacy({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<MediaLibrary.PermissionStatus | null>(null);

  const savedItemsRef = useRef<SavedItem[]>([]);
  const hasPermissionRef = useRef(false);
  const isLoadingRef = useRef(false);
  const loadStatusesRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  const cleanupCacheFilesRef = useRef<(maxAgeMs?: number) => Promise<void>>(async () => {});
  const statusesRef = useRef<StatusItem[]>([]);

  const androidVersion = Platform.OS === 'android' ? (Platform.Version as number) : 0;

  savedItemsRef.current = savedItems;
  hasPermissionRef.current = hasPermission;
  statusesRef.current = statuses;

  const storageMethod: AndroidStorageMethod = useMemo(() => {
    if (Platform.OS !== 'android') return 'unknown';
    if (androidVersion >= 29) return 'scoped';
    return 'legacy';
  }, [androidVersion]);

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await Promise.all([
          withTimeout(checkExistingPermissions(), 2500, undefined, 'checkPerms'),
          withTimeout(loadSavedItems({ skipRescan: true }), 2500, undefined, 'loadSaved'),
          withTimeout(loadStatusesCache(mounted), 2500, undefined, 'loadCache'),
        ]);
      } finally {
        if (mounted) setIsInitializing(false);
      }
      InteractionManager.runAfterInteractions(() => {
        if (!mounted) return;
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

  // ── Statuses cache ───────────────────────────────────────────────────────
  async function loadStatusesCache(mounted: boolean) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.STATUSES_CACHE);
      if (!raw || !mounted) return;
      const cached = JSON.parse(raw) as StatusItem[];
      if (!Array.isArray(cached) || cached.length === 0) return;
      setStatuses(cached);
    } catch {}
  }

  function persistStatusesCache(items: StatusItem[]) {
    try {
      AsyncStorage.setItem(
        STORAGE_KEYS.STATUSES_CACHE,
        JSON.stringify(items.slice(0, 200)),
      ).catch(() => {});
    } catch {}
  }

  // ── Saved items ───────────────────────────────────────────────────────────
  async function rescanGalleryAlbum(currentValid: SavedItem[]): Promise<SavedItem[] | null> {
    try {
      const perm: any = await MediaLibrary.getPermissionsAsync();
      if (perm?.status !== 'granted') return null;
      if (perm?.accessPrivileges === 'none') return null;
      const album = await MediaLibrary.getAlbumAsync('Status Saver');
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
    } catch { return null; }
  }

  async function loadSavedItems(opts: { skipRescan?: boolean } = {}) {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_ITEMS);
      const items: SavedItem[] = stored ? JSON.parse(stored) : [];
      const checks = await Promise.allSettled(
        items.map(item => FileSystem.getInfoAsync(item.localUri)),
      );
      const valid: SavedItem[] = [];
      for (let i = 0; i < items.length; i++) {
        const c = checks[i];
        if (c.status === 'fulfilled' && (c.value as any).exists) valid.push(items[i]);
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
      setPermissionStatus(prev => (prev !== status ? status : prev));
      setHasPermission(prev => (prev !== granted ? granted : prev));
      return granted;
    } catch { return false; }
  }

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      setPermissionStatus(status);
      const granted = status === 'granted';
      setHasPermission(granted);
      if (granted) await loadStatusesRef.current();
      return granted;
    } catch { return false; }
  }, []);

  // No SAF on legacy devices — stub
  const requestSAF = useCallback(async (_source?: StatusSource, _manual?: boolean) => {
  }, []);

  // ── Legacy file reader ────────────────────────────────────────────────────
  async function readFromLegacyPath(): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    for (const path of WHATSAPP_LEGACY_PATHS) {
      try {
        const uri = `file://${path}`;
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) continue;
        const files = await FileSystem.readDirectoryAsync(uri);
        const source: StatusSource = path.toLowerCase().includes('business')
          ? 'whatsapp_business'
          : 'whatsapp';
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
      } catch (e) {
        console.error(`[Legacy] Error reading path ${path}:`, e);
      }
    }
    return items;
  }

  // ── Load statuses (legacy path) ───────────────────────────────────────────
  const loadStatuses = useCallback(async (silent = false) => {
    if (isLoadingRef.current) return;
    if (!hasPermissionRef.current) return;
    isLoadingRef.current = true;
    if (!silent) setIsLoading(true);
    try {
      const items = await readFromLegacyPath();
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
          '⭐ Enjoying Status Saver?',
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

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveStatus = useCallback(async (item: StatusItem): Promise<boolean> => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const savedDir = `${FileSystem.documentDirectory}saved/`;
      const dirInfo = await FileSystem.getInfoAsync(savedDir);
      if (!dirInfo.exists)
        await FileSystem.makeDirectoryAsync(savedDir, { intermediates: true });

      const duplicate = savedItemsRef.current.find(
        s => s.id === item.id || s.name === item.name,
      );
      if (duplicate) {
        try {
          const dupInfo = await FileSystem.getInfoAsync(duplicate.localUri);
          if (dupInfo.exists) return true;
        } catch {}
      }

      const ext = item.name.split('.').pop() || 'jpg';
      const destUri = `${savedDir}status_${Date.now()}.${ext}`;
      await enqueueCopy(() => FileSystem.copyAsync({ from: item.uri, to: destUri }));

      const newSaved: SavedItem = { ...item, localUri: destUri, savedAt: Date.now() };
      const updated = [newSaved, ...savedItemsRef.current.filter(s => s.id !== item.id)];
      setSavedItems(updated);
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));

      maybeShowRatingPrompt();
      return true;
    } catch (e) {
      console.error('[Media] saveStatus failed:', e);
      return false;
    }
  }, [setHasPermission, setPermissionStatus]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const deleteFromSaved = useCallback(async (item: SavedItem) => {
    try { await FileSystem.deleteAsync(item.localUri, { idempotent: true }); } catch {}
    const updated = savedItemsRef.current.filter(s => s.id !== item.id);
    setSavedItems(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(updated));
  }, []);

  // ── Share ─────────────────────────────────────────────────────────────────
  const shareStatus = useCallback(async (item: StatusItem | SavedItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      let shareUri: string;
      if ('localUri' in item) {
        shareUri = (item as SavedItem).localUri;
      } else {
        shareUri = item.uri;
      }
      await Sharing.shareAsync(shareUri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.error('Share error:', e);
    }
  }, []);

  const isStatusSaved = useCallback((id: string): boolean => {
    return savedItemsRef.current.some(s => s.id === id);
  }, []);

  // ── Prepare for viewing ───────────────────────────────────────────────────
  const prepareStatusForViewing = useCallback(
    async (item: StatusItem, _opts?: { forShare?: boolean; forPlayback?: boolean }) => {
      return item.uri;
    },
    [],
  );

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanupCacheFiles = useCallback(async (maxAgeMs = 4 * 60 * 60 * 1000) => {
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

  // ── Context value ─────────────────────────────────────────────────────────
  const value: MediaContextValue = useMemo(() => ({
    statuses,
    savedItems,
    isLoading,
    isRefreshing,
    isInitializing,
    isRequestingSAF: false,
    isGrantingAccess: false,
    hasPermission,
    safGranted: false,
    safUri: null,
    safUris: {},
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
    hasPermission, androidVersion, storageMethod, permissionStatus,
    requestPermissions, requestSAF, loadStatuses, refresh,
    saveStatus, deleteFromSaved, shareStatus, isStatusSaved,
    prepareStatusForViewing, cleanupCacheFiles,
  ]);

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}
