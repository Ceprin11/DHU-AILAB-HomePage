import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';

const EMPTY_STATS = { members: 0, awards: 0, activities: 0 };
const ENTITY_CHANGE_EVENT = 'ailab:entity-change';
const REFRESH_INTERVAL_MS = 30 * 1000;

export function useEntityStats() {
  const [stats, setStats] = useState(EMPTY_STATS);

  const refresh = useCallback(async () => {
    const [members, awards, activities] = await Promise.all([
      api.entities.Member.list('', 500).then((rows) => rows.length).catch(() => null),
      api.entities.Award.list('', 500).then((rows) => rows.length).catch(() => null),
      api.entities.Activity.list('', 500).then((rows) => rows.length).catch(() => null),
    ]);
    setStats((current) => ({
      members: members ?? current.members,
      awards: awards ?? current.awards,
      activities: activities ?? current.activities,
    }));
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    const handleEntityChange = (event) => {
      if (['Member', 'Award', 'Activity'].includes(event.detail?.entityName)) refresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(ENTITY_CHANGE_EVENT, handleEntityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(ENTITY_CHANGE_EVENT, handleEntityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh]);

  return stats;
}
