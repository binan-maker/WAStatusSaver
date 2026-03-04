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
import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { VIDEO_AD_FREQUENCY } from '@/constants/admob';

export type MediaType = 'image' | 'video';

export interface StatusItem {
  id: string;
  uri: string;
  type: MediaType;
  name: string;
  modTime?: number;
  size?: number;
  source: 'whatsapp' | 'whatsapp_business';
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
  hasPermission: boolean;
  safGranted: boolean;
  safUri: string | null;
  androidVersion: number;
  storageMethod: AndroidStorageMethod;
  permissionStatus: MediaLibrary.PermissionStatus | null;
  videoViewCount: number;
  showInterstitial: boolean;
  pendingVideoUri: string | null;
  requestPermissions: () => Promise<boolean>;
  requestSAF: () => Promise<void>;
  loadStatuses: () => Promise<void>;
  refresh: () => Promise<void>;
  saveStatus: (item: StatusItem) => Promise<boolean>;
  deleteFromSaved: (item: SavedItem) => Promise<void>;
  shareStatus: (item: StatusItem | SavedItem) => Promise<void>;
  isStatusSaved: (id: string) => boolean;
  onVideoOpen: (uri: string) => void;
  dismissInterstitial: () => void;
  prepareStatusForViewing: (item: StatusItem) => Promise<string>;
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
  const [hasPermission, setHasPermission] = useState(false);
  const [safGranted, setSafGranted] = useState(false);
  const [safUri, setSafUri] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<MediaLibrary.PermissionStatus | null>(null);
  const [videoViewCount, setVideoViewCount] = useState(0);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);

  const androidVersion = Platform.OS === 'android' ? (Platform.Version as number) : 0;

  const storageMethod: AndroidStorageMethod = useMemo(() => {
    if (Platform.OS !== 'android') return 'unknown';
    if (androidVersion >= 30) return safGranted ? 'saf' : 'scoped';
    if (androidVersion >= 29) return 'scoped';
    return 'legacy';
  }, [androidVersion, safGranted]);

  useEffect(() => {
    loadSavedItems();
    checkExistingPermissions();
    loadSAFUri();
  }, []);

  async function loadSAFUri() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SAF_URI);
      if (stored) {
        setSafUri(stored);
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
      return granted;
    } catch {
      return false;
    }
  }, []);

  const requestSAF = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (result.granted) {
        await AsyncStorage.setItem(STORAGE_KEYS.SAF_URI, result.directoryUri);
        setSafUri(result.directoryUri);
        setSafGranted(true);
        await loadStatuses();
      }
    } catch (e) {
      Alert.alert('Permission Error', 'Could not access storage. Please try again.');
    }
  }, []);

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

  async function readFromSAF(safDirUri: string): Promise<StatusItem[]> {
    const items: StatusItem[] = [];
    try {
      // Check if we are in a parent "Media" folder or directly in ".Statuses"
      // If we are in Media, we need to find the .Statuses subfolder
      const isMediaFolder = decodeURIComponent(safDirUri).toLowerCase().endsWith('/media');
      let targetUri = safDirUri;

      if (isMediaFolder) {
        try {
          const content = await FileSystem.StorageAccessFramework.readDirectoryAsync(safDirUri);
          const statusFolder = content.find(uri => decodeURIComponent(uri).toLowerCase().endsWith('/.statuses'));
          if (statusFolder) {
            targetUri = statusFolder;
          }
        } catch (e) {
          console.log('Error searching for .Statuses in Media folder:', e);
        }
      }

      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetUri);
      const isBusiness = decodeURIComponent(targetUri).toLowerCase().includes('w4b') || 
                        decodeURIComponent(targetUri).toLowerCase().includes('business');
      const source = isBusiness ? 'whatsapp_business' : 'whatsapp';

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
      setSafGranted(false);
      setSafUri(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.SAF_URI);
    }
    return items;
  }

  const loadStatuses = useCallback(async () => {
    if (!hasPermission && Platform.OS === 'android') {
      const granted = await checkExistingPermissions();
      if (!granted) return;
    }

    setIsLoading(true);
    try {
      let items: StatusItem[] = [];

      if (androidVersion >= 30 && safGranted && safUri) {
        items = await readFromSAF(safUri);
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
  }, [hasPermission, androidVersion, safGranted, safUri]);

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

      const ext = item.name.split('.').pop() || 'jpg';
      const filename = `status_${Date.now()}.${ext}`;
      const destUri = `${savedDir}${filename}`;

      await FileSystem.copyAsync({ from: item.uri, to: destUri });

      if (hasPermission) {
        try {
          // To avoid the "Allow StatusVault to modify this photo?" dialog on Android 11+,
          // we use the localUri directly for internal app tracking and don't explicitly
          // call createAssetAsync/createAlbumAsync if we want to avoid the system prompt.
          // The file is already saved in the app's documentDirectory.
          // If the user specifically wants it in the gallery without a prompt, 
          // they would need "MANAGE_EXTERNAL_STORAGE" which is a restricted permission.
          // For now, we'll keep it in the app's storage to ensure it's "Saved" within the app.
          
          // Commenting out MediaLibrary calls to prevent the system prompt on Android 11+
          // const asset = await MediaLibrary.createAssetAsync(destUri);
          // await MediaLibrary.createAlbumAsync('StatusVault', asset, false);
        } catch (err) {
          console.log('MediaLibrary save error:', err);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (e) {
      console.error('Save error:', e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [savedItems]);

  const shareStatus = useCallback(async (item: StatusItem | SavedItem) => {
    try {
      let shareUri = item.uri;

      if ('localUri' in item) {
        shareUri = item.localUri;
      } else if (item.uri.startsWith('content://')) {
        const ext = item.name.split('.').pop() || 'jpg';
        const tempUri = `${FileSystem.cacheDirectory}share_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: item.uri, to: tempUri });
        shareUri = tempUri;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(shareUri, {
          mimeType: item.type === 'video' ? 'video/*' : 'image/*',
          dialogTitle: 'Share via...',
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
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

  const dismissInterstitial = useCallback(() => {
    setShowInterstitial(false);
    setPendingVideoUri(null);
  }, []);

  const prepareStatusForViewing = useCallback(async (item: StatusItem): Promise<string> => {
    // For local files (saved items), return the uri as is
    if (!item.uri.startsWith('content://')) return item.uri;

    try {
      const ext = item.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
      // Clean the ID of any problematic characters (like colons from SAF URIs)
      const safeId = item.id.replace(/[:\/\\?%*|"<>]/g, '_');
      const tempUri = `${FileSystem.cacheDirectory}view_${safeId}.${ext}`;
      
      // Check if already cached to avoid redundant copies
      try {
        const info = await FileSystem.getInfoAsync(tempUri);
        if (info.exists && info.size > 0) return tempUri;
      } catch (e) {
        // Continue if check fails
      }

      // Ensure cache directory exists (extra safety)
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        }
      }

      await FileSystem.copyAsync({
        from: item.uri,
        to: tempUri
      });
      
      return tempUri;
    } catch (e) {
      return item.uri; // Fallback to original URI if copy fails
    }
  }, []);

  const value: MediaContextValue = {
    statuses,
    savedItems,
    isLoading,
    isRefreshing,
    hasPermission,
    safGranted,
    safUri,
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
    dismissInterstitial,
    prepareStatusForViewing,
  };

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia must be used within MediaProvider');
  return ctx;
}
