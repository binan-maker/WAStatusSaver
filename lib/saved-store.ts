/**
 * SavedStore — module-level saved-IDs store with per-ID pub/sub.
 *
 * Pattern mirrors ThumbnailCache. Each MediaCard subscribes to ONLY its own
 * ID — saving one status notifies only that one card's subscriber instead of
 * rebuilding the context value and re-rendering the entire grid.
 *
 * The store is kept in sync by MediaContextSAF via a useEffect that calls
 * SavedStore.setIds() whenever savedItems changes.
 */

const subs = new Map<string, Set<(saved: boolean) => void>>();
let savedSet = new Set<string>();

function notify(id: string, saved: boolean) {
  const set = subs.get(id);
  if (!set || set.size === 0) return;
  set.forEach(cb => {
    try { cb(saved); } catch {}
  });
}

function setIds(ids: string[]) {
  const next = new Set(ids);
  // Notify IDs that became saved
  for (const id of next) {
    if (!savedSet.has(id)) notify(id, true);
  }
  // Notify IDs that became unsaved
  for (const id of savedSet) {
    if (!next.has(id)) notify(id, false);
  }
  savedSet = next;
}

function has(id: string): boolean {
  return savedSet.has(id);
}

function subscribe(id: string, cb: (saved: boolean) => void): () => void {
  let set = subs.get(id);
  if (!set) { set = new Set(); subs.set(id, set); }
  set.add(cb);
  return () => {
    const s = subs.get(id);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subs.delete(id);
  };
}

export const SavedStore = { setIds, has, subscribe };
