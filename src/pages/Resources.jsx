import React, { useState, useEffect } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { FileText, FileCode, Database, FileBox, Video, Download, ExternalLink } from 'lucide-react';
import { api } from '@/api/client';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { cn } from '@/lib/utils';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';
import { hasBilibiliVideoId } from '@/lib/bilibili';

const TYPE_ICON = {
  pdf: { icon: FileText, cls: 'bg-accent text-primary' },
  code: { icon: FileCode, cls: 'bg-accent text-primary' },
  data: { icon: Database, cls: 'bg-accent text-primary' },
  doc: { icon: FileBox, cls: 'bg-accent text-primary' },
  video: { icon: Video, cls: 'bg-accent text-primary' },
  other: { icon: FileBox, cls: 'bg-accent text-primary' },
};

export default function Resources() {
  const text = useSiteText();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    api.entities.StudyMaterial.list('-date', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = [text('resources_all'), ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))];
  const filtered = !cat || cat === text('resources_all') ? items : items.filter((i) => i.category === cat);

  return (
    <div className="page-shell page-section max-w-5xl">
      <SectionHeading eyebrow={text('resources_eyebrow')} title={text('resources_title')} description={text('resources_description')} />

      {loading ? (
        <ContentLoading />
      ) : (
        <>
          {categories.length > 1 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
                    (!cat && c === text('resources_all')) || cat === c ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState title={text('resources_empty')} icon={FileBox} />
          ) : (
            <m.div layout={!reduceMotion} className="mt-8 divide-y divide-border/75 border-y border-border/75">
              <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((item) => {
                const t = TYPE_ICON[item.file_type] || TYPE_ICON.other;
                const isBilibiliVideo = item.file_type === 'video' && hasBilibiliVideoId(item.file_url);
                const isDirectVideo = item.file_type === 'video' && item.file_url && !isBilibiliVideo;
                const rowContent = (
                  <>
                    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/10', t.cls)}>
                      <t.icon size={19} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold leading-6 text-foreground">{item.title}</h3>
                      {item.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono-date text-[11px] text-muted-foreground">
                        <span>{item.file_type?.toUpperCase()}</span>
                        <span>·</span>
                        <span>{formatDate(item.date)}</span>
                        {item.category && <><span>·</span><span>{item.category}</span></>}
                      </div>
                    </div>
                    {isBilibiliVideo && (
                      <span className="interactive-link flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-input bg-background px-3.5 text-sm font-medium group-hover:border-primary/30 group-hover:bg-accent">
                        <ExternalLink size={14} strokeWidth={1.8} /> {text('resources_view') || '观看'}
                      </span>
                    )}
                    {item.file_url && !isDirectVideo && !isBilibiliVideo && (
                      <a href={item.file_url} target="_blank" rel="noreferrer" download className="interactive-link flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-input bg-background px-3.5 text-sm font-medium hover:border-primary/30 hover:bg-accent">
                        <Download size={14} strokeWidth={1.8} /> {text('resources_download')}
                      </a>
                    )}
                  </>
                );
                return (
                  <m.article
                    layout={!reduceMotion}
                    key={item.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden transition-colors duration-200 hover:bg-secondary/25"
                  >
                    {isBilibiliVideo ? (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-4 px-3 py-5 focus-visible:outline-offset-[-2px] sm:px-5 sm:py-6"
                        aria-label={`${item.title}，前往 B 站观看`}
                      >
                        {rowContent}
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 px-3 py-5 sm:px-5 sm:py-6">
                        {rowContent}
                      </div>
                    )}
                    {isDirectVideo && (
                      <div className="border-t border-border/75 bg-foreground">
                        <video src={item.file_url} controls className="max-h-80 w-full" />
                      </div>
                    )}
                  </m.article>
                );
              })}
              </AnimatePresence>
            </m.div>
          )}
        </>
      )}
    </div>
  );
}
