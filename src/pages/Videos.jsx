import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { api } from '@/api/client';
import BilibiliVideoCard from '@/components/BilibiliVideoCard';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';
import { hasBilibiliVideoId } from '@/lib/bilibili';

export default function Videos() {
  const text = useSiteText();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.VideoLink.list('-date', 200)
      .then(async (r) => {
        const rows = r || [];
        setItems(rows);
        setLoading(false);
        const enriched = await Promise.all(rows.map(async (video) => {
          if (video.thumbnail_url || !hasBilibiliVideoId(video.bilibili_url)) return video;
          try {
            const metadata = await api.bilibili.preview(video.bilibili_url);
            return { ...video, thumbnail_url: metadata.thumbnail_url };
          } catch {
            return video;
          }
        }));
        setItems(enriched);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="page-shell page-section">
      <SectionHeading eyebrow={text('videos_eyebrow')} title={text('videos_title')} description={text('videos_description')} />

      {loading ? (
        <ContentLoading variant="grid" />
      ) : items.length === 0 ? (
        <EmptyState title={text('videos_empty')} icon={Play} />
      ) : (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v, index) => (
            <BilibiliVideoCard
              key={v.id}
              href={v.bilibili_url}
              thumbnailUrl={v.thumbnail_url}
              title={v.title}
              description={v.description}
              meta={formatDate(v.date)}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
