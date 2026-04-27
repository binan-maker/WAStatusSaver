// Tiny per-card subscriber for the thumbnail cache.
//
// Each MediaCard mounts ONE of these and only re-renders when its OWN
// thumbnail becomes ready. There is no array-wide state and no context —
// flipping a single thumb from "not ready" to "ready" never cascades to
// the rest of the grid, so scrolling stays smooth even while the
// background queue is still working its way through the list.

import { useEffect, useState } from 'react';
import { ThumbnailCache } from '@/lib/thumbnail-cache';

export function useThumbnail(id: string): string | null {
  const [path, setPath] = useState<string | null>(() => ThumbnailCache.get(id));
  useEffect(() => {
    // Re-read on mount in case the cache populated between render and effect
    const current = ThumbnailCache.get(id);
    if (current !== path) setPath(current);
    const unsub = ThumbnailCache.subscribe(id, setPath);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return path;
}
