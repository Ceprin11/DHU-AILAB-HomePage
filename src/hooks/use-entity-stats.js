import { useEffect, useState } from 'react';
import { api } from '@/api/client';

const EMPTY_STATS = { members: 0, awards: 0, activities: 0 };
const ENTITY_CHANGE_EVENT = 'ailab:entity-change';
// The counts barely change; refreshing every few minutes is plenty and keeps idle tabs from sending requests.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// One request shared by every component that shows the counts (the footer and the home page).
let latest = EMPTY_STATS;
let loadedAt = 0;
let pending = null;
const listeners = new Set();

const load = (force = false) => {
  if (pending) return pending;
  if (!force && Date.now() - loadedAt < REFRESH_INTERVAL_MS) return Promise.resolve(latest);
  pending = api.public.stats()
    .then((stats) => {
      latest = { ...latest, ...stats };
      loadedAt = Date.now();
      listeners.forEach((listener) => listener(latest));
      return latest;
    })
    .catch(() => latest)
    .finally(() => { pending = null; });
  return pending;
};

export function useEntityStats() {
  const [stats, setStats] = useState(latest);

  useEffect(() => {
    listeners.add(setStats);
    load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_INTERVAL_MS);
    const handleEntityChange = (event) => {
      if (['Member', 'Award', 'Activity'].includes(event.detail?.entityName)) load(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') load();
    };
    window.addEventListener(ENTITY_CHANGE_EVENT, handleEntityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      listeners.delete(setStats);
      window.clearInterval(interval);
      window.removeEventListener(ENTITY_CHANGE_EVENT, handleEntityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return stats;
}
