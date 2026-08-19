import { useState, useEffect } from 'react';
import { api } from '@/api/client';

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function formatDateTime(dateStr) {
  const date = formatDate(dateStr);
  if (!date || !/T\d{2}:\d{2}/.test(String(dateStr))) return date;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return dateStr;
  return `${date} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    let mounted = true;
    api.entities.SiteSettings.list()
      .then((rows) => { if (mounted) setSettings(rows[0] || null); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);
  return settings;
}

export function useEntityData(entityName, sort = '-created_date', limit = 100) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.entities[entityName].list(sort, limit)
      .then((rows) => { if (mounted) { setData(rows || []); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [entityName, sort, limit]);
  return { data, loading, setData };
}
