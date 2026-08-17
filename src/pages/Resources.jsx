import React, { useEffect, useState } from 'react';
import { FileBox } from 'lucide-react';
import { api } from '@/api/client';
import MediaResourceCard from '@/components/MediaResourceCard';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { cn } from '@/lib/utils';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';
import { getAutomaticResourceThumbnail, getResourceAction, getResourceKind } from '@/lib/resourceLinks';

export default function Resources() {
  const text = useSiteText();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState(null);

  useEffect(() => {
    api.entities.StudyMaterial.list('-date', 200)
      .then((rows) => { setItems(rows || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = [text('resources_all'), ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
  const filtered = !cat || cat === text('resources_all') ? items : items.filter((item) => item.category === cat);

  return (
    <div className="page-shell page-section">
      <SectionHeading eyebrow={text('resources_eyebrow')} title={text('resources_title')} description={text('resources_description')} />
      {loading ? <ContentLoading /> : (
        <>
          {categories.length > 1 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button key={category} onClick={() => setCat(category)} className={cn('rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200', (!cat && category === text('resources_all')) || cat === category ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground')}>
                  {category}
                </button>
              ))}
            </div>
          )}
          {filtered.length === 0 ? <EmptyState title={text('resources_empty')} icon={FileBox} /> : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item, index) => {
                const kind = getResourceKind(item.file_url, item.file_type);
                return (
                  <MediaResourceCard
                    key={item.id}
                    href={item.file_url}
                    thumbnailUrl={item.thumbnail_url || getAutomaticResourceThumbnail(item.file_url)}
                    title={item.title}
                    description={item.description}
                    meta={item.category || formatDate(item.date)}
                    index={index}
                    kind={kind}
                    action={getResourceAction(item.file_url, item.file_type)}
                    fileType={item.file_type}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
