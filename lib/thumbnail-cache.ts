// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail cache — Android 11+ scroll-lag killer.
//
// THE PROBLEM
// Every cell in the home grid that points at a content:// URI from Storage
// Access Framework forces Glide (inside expo-image) to round-trip the URI
// through ContentResolver, then for videos to spin up MediaMetadataRetriever
// to extract a frame. That produces 200-800 ms of CPU per cell on Android
// 11+, which destroys scroll smoothness.
//
// THE FIX
// Generate the thumbnails ONCE in a low-priority background queue and write
// them to internal cache as plain file:// JPGs. The grid then renders pure
// local files at near-zero CPU — the hot scroll path never touches SAF or
// the video decoder again.
//
// SHAPE
// - In-memory map (id -> file:// path) hydrated from AsyncStorage on boot
//   so cold launch already has thumbs ready before the grid mounts.
// - Tiny per-id pub/sub so a newly generated thumb only re-renders the ONE
//   card that needs it — no cascade through the whole grid.
// - Concurrent queue (CONCURRENCY workers) with a short idle gap so
//   background work finishes faster without hogging the JS thread.
// - For images we don't write a separate file; we just warm expo-image's
//   own disk cache via Image.prefetch — the next render is instant.
// - Atomic destination: we write to a .tmp file then rename, so a crash
//   mid-write never leaves a half-decoded JPG on disk.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SafReaderModule from '@/modules/saf-reader';

export type ThumbItemType = 'image' | 'video';

export interface ThumbItem {
  id: string;
  uri: string;
  type: ThumbItemType;
}

const STORAGE_KEY = '@statusvault_thumb_cache_v1';
// FileSystem.cacheDirectory is wiped by the OS under storage pressure — the
// queue will simply regenerate on the next scan, so this is the right place.
const CACHE_DIR_NAME = 'status-thumbs/';

// Number of thumbnails to generate in parallel. 2 workers doubles throughput
// on multi-core devices without overloading the hardware decoder pool.
// Keep it at 2 — 3+ risks MediaCodec "too many decoders" errors on low-end
// devices, and ExoPlayer needs at least one slot free for video playback.
const CONCURRENCY = 2;

// Idle gap between items PER WORKER (ms). Shorter than before (30 vs 150)
// because we now have 2 workers — each worker yields 30 ms while the other
// keeps making progress, so the JS thread stays responsive.
const IDLE_GAP_MS = 30;

// Module state — single instance per JS context (no React rerenders).
let cacheDir: string | null = null;
let memMap: Record<string, string> = {};
const imagesPrefetched = new Set<string>();
const subs = new Map<string, Set<(p: string | null) => void>>();
let queue: ThumbItem[] = [];
let activeWorkers = 0;
let cancelToken = 0;
let initPromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
// isPaused is set by pause() so that any in-flight generateOne() bails
// immediately at its next await boundary instead of completing and
// potentially holding a hardware decoder slot during video playback.
let isPaused = false;

function safeFilename(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function notify(id: string, path: string | null) {
  const set = subs.get(id);
  if (!set || set.size === 0) return;
  set.forEach((cb) => {
    try {
      cb(path);
    } catch {
      // subscriber bug shouldn't take down the queue
    }
  });
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memMap)).catch(() => {});
  }, 1000);
}

async function ensureCacheDir(): Promise<string | null> {
  if (cacheDir) return cacheDir;
  const root = FileSystem.cacheDirectory;
  if (!root) return null;
  cacheDir = root + CACHE_DIR_NAME;
  try {
    const info = await FileSystem.getInfoAsync(cacheDir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }
  } catch {
    // best-effort
  }
  return cacheDir;
}

async function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await ensureCacheDir();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          memMap = parsed as Record<string, string>;
        }
      }
    } catch {
      // corrupt JSON — start fresh
      memMap = {};
    }
  })();
  return initPromise;
}

function get(id: string): string | null {
  return memMap[id] || null;
}

function subscribe(id: string, cb: (p: string | null) => void): () => void {
  let set = subs.get(id);
  if (!set) {
    set = new Set();
    subs.set(id, set);
  }
  set.add(cb);
  return () => {
    const s = subs.get(id);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subs.delete(id);
  };
}

async function generateOne(item: ThumbItem): Promise<void> {
  // Bail immediately if the viewer is open. pause() sets this flag so that
  // in-flight work stops at the next await boundary rather than running to
  // completion and holding a hardware decoder slot during video playback.
  if (isPaused) return;

  // For an existing entry, double-check the file is still there. The OS can
  // wipe the cache directory under storage pressure between sessions.
  const existing = memMap[item.id];
  if (existing) {
    try {
      const info = await FileSystem.getInfoAsync(existing);
      if (info.exists && (info as any).size > 0) {
        return; // still good — nothing to do
      }
    } catch {
      // fall through and regenerate
    }
    delete memMap[item.id];
  }

  if (isPaused) return; // second check after the async getInfoAsync above

  if (item.type === 'image') {
    // For images we don't keep a separate file — expo-image's own disk
    // cache is already a fast file-system lookup keyed by URI hash. We
    // just warm it with a single prefetch call and from then on every
    // grid render is a memory/disk hit, not a content:// round-trip.
    if (imagesPrefetched.has(item.uri)) return;
    imagesPrefetched.add(item.uri);
    try {
      await ExpoImage.prefetch(item.uri, 'memory-disk');
    } catch {
      // prefetch failure is harmless — Glide will still try on first paint
    }
    return;
  }

  // Videos: extract first key-frame as a JPG once and reuse forever.
  //
  // NATIVE PATH (EAS / custom build):
  //   SafReaderModule.generateThumbnail runs Android's hardware-accelerated
  //   MediaMetadataRetriever entirely in Java — no JS bridge overhead, no
  //   second process hop. It writes atomically via .tmp+rename itself.
  //   A 3 s timeout guards against the MediaMetadataRetriever hang seen on
  //   MIUI / HyperOS and Samsung OneUI: setDataSource(context, uri) never
  //   throws and never resolves for certain SAF content:// URIs, which
  //   stalls the entire queue. On timeout we fall through to the JS path.
  //
  // JS FALLBACK (Expo Go / no native module / native timeout):
  //   expo-video-thumbnails — also hardware-accelerated but crosses the
  //   JS bridge twice (request + result) and writes to a temp dir that
  //   we then move into our managed cache dir.
  //
  // QUALITY: 0.25 is plenty for small grid thumbnails (card is ~120px wide).
  // Lower quality = smaller JPEG = faster decode on scroll, faster disk write.
  const dir = await ensureCacheDir();
  if (!dir) return;
  const dest = `${dir}vid_${safeFilename(item.id)}.jpg`;

  // Helper: run expo-video-thumbnails and move result directly to dest.
  // Uses a single move (atomic rename on same FS partition) instead of the
  // previous copy+delete+move dance — cuts 3 file-system round-trips per video.
  async function jsThumb(): Promise<void> {
    const result = await VideoThumbnails.getThumbnailAsync(item.uri, {
      time: 0,
      quality: 0.25,
    });
    // Move directly to dest; if dest already exists moveAsync overwrites it.
    try {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch {}
    await FileSystem.moveAsync({ from: result.uri, to: dest });
  }

  // Final check immediately before the heavy decoder operation.
  // Both SafReaderModule and expo-video-thumbnails spin up a MediaCodec slot;
  // skipping here frees the slot for ExoPlayer during video playback.
  if (isPaused) return;

  try {
    if (SafReaderModule.isAvailable()) {
      // Native Java path with a hard 3 s timeout.
      // If it resolves in time: done.  If it times out or throws: fall back
      // to expo-video-thumbnails below so the queue never stalls.
      let nativeOk = false;
      try {
        await Promise.race([
          SafReaderModule.generateThumbnail(item.uri, dest, 0).then(() => { nativeOk = true; }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('thumb_timeout')), 3000),
          ),
        ]);
      } catch {
        // Native timed out or threw — fall back to JS path.
      }
      if (!nativeOk) {
        if (isPaused) return; // don't start JS fallback if viewer opened during native attempt
        await jsThumb();
      }
    } else {
      await jsThumb();
    }
    if (isPaused) return; // don't notify/persist if viewer opened mid-generation
    memMap[item.id] = dest;
    schedulePersist();
    notify(item.id, dest);
  } catch {
    // Codec error / unsupported container / both paths failed.
    // Silently skip — the grid shows the blurhash placeholder for this
    // item; the next loadStatuses() scan will retry.
  }
}

function enqueue(items: ThumbItem[]): void {
  if (Platform.OS !== 'android') return; // only Android suffers this lag
  if (!Array.isArray(items) || items.length === 0) return;
  // Replace the queue — newest scan wins. Anything from the previous scan
  // that's still relevant will be picked up again from memMap (skipped if
  // already present, generated otherwise).
  queue = items.slice();
  // Spin up workers up to the CONCURRENCY limit.
  spawnWorkers();
}

function spawnWorkers(): void {
  while (activeWorkers < CONCURRENCY && queue.length > 0) {
    activeWorkers++;
    runWorker();
  }
}

async function runWorker(): Promise<void> {
  const myToken = cancelToken;
  try {
    await init();
    while (queue.length > 0 && cancelToken === myToken && !isPaused) {
      const next = queue.shift();
      if (!next) break;
      await generateOne(next);
      if (cancelToken !== myToken) break;
      // Short idle gap keeps the JS thread available for touch/scroll handlers.
      // 30 ms is enough for React to flush any pending state updates without
      // noticeably slowing down the overall throughput.
      if (queue.length > 0) {
        await new Promise((r) => setTimeout(r, IDLE_GAP_MS));
      }
    }
  } finally {
    activeWorkers--;
    // If items arrived while we were running (e.g. a new scan came in),
    // and there are free worker slots, re-enter immediately.
    if (queue.length > 0 && activeWorkers < CONCURRENCY && !isPaused) {
      spawnWorkers();
    }
  }
}

function cancel(): void {
  cancelToken++;
  queue = [];
  // Do NOT reset activeWorkers here. Each running worker will detect
  // cancelToken !== myToken on its next iteration, exit cleanly, and
  // decrement activeWorkers itself in its finally block.
}

async function prune(currentIds: Set<string>): Promise<void> {
  await init();
  let dirty = false;
  for (const id of Object.keys(memMap)) {
    if (!currentIds.has(id)) {
      const path = memMap[id];
      try {
        await FileSystem.deleteAsync(path, { idempotent: true });
      } catch {}
      delete memMap[id];
      dirty = true;
    }
  }
  if (dirty) schedulePersist();
}

/**
 * pause() — hard-stop all thumbnail work immediately.
 *
 * Sets isPaused so any in-flight generateOne() bails at its next await
 * boundary (before or after the heavy decoder call) instead of running to
 * completion. This is critical: without isPaused, cancel() only clears the
 * queue but the currently-executing item keeps going — holding a hardware
 * MediaCodec slot and competing with ExoPlayer during video playback.
 *
 * Call when the video viewer opens. The queue is re-enqueued automatically
 * when loadStatuses() runs after the viewer closes (or call resume() to
 * allow the existing queue to drain immediately).
 */
function pause(): void {
  isPaused = true;
  cancel();
}

/**
 * resume() — re-enable thumbnail generation after the viewer closes.
 * Clears the isPaused flag so the next enqueue() call can start processing.
 */
function resume(): void {
  isPaused = false;
}

export const ThumbnailCache = {
  init,
  get,
  subscribe,
  enqueue,
  cancel,
  pause,
  resume,
  prune,
};
