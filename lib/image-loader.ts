import * as FileSystem from 'expo-file-system/legacy';

interface LoadedImage {
  uri: string;
  timestamp: number;
}

const imageCache = new Map<string, LoadedImage>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function preloadImage(uri: string): Promise<void> {
  try {
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        imageCache.set(uri, { uri, timestamp: Date.now() });
      }
    }
  } catch (error) {
    console.warn('Failed to preload image:', uri);
  }
}

export function isImageCached(uri: string): boolean {
  const cached = imageCache.get(uri);
  if (!cached) return false;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_DURATION) {
    imageCache.delete(uri);
    return false;
  }
  return true;
}

export function clearImageCache(): void {
  imageCache.clear();
}

export function getMemoryUsage(): number {
  return imageCache.size;
}
