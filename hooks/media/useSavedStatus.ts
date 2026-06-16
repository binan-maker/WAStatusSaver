/**
 * Per-card hook that subscribes to the SavedStore for a single item ID.
 *
 * Only THIS card re-renders when its own saved state flips — saving one
 * status never cascades to the rest of the grid.
 */
import { useEffect, useState } from 'react';
import { SavedStore } from '@/lib/saved-store';

export function useSavedStatus(id: string): boolean {
  const [saved, setSaved] = useState<boolean>(() => SavedStore.has(id));
  useEffect(() => {
    const current = SavedStore.has(id);
    if (current !== saved) setSaved(current);
    return SavedStore.subscribe(id, setSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return saved;
}
