import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, FileDown, ExternalLink } from 'lucide-react';
import { api } from '@/api/client';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';

export default function Activities() {
  const text = useSiteText();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.Activity.list('-date', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="page-shell page-section max-w-6xl">
      <SectionHeading eyebrow={text('activities_eyebrow')} title={text('activities_title')} description={text('activities_description')} />

      {loading ? (
        <ContentLoading />
      ) : items.length === 0 ? (
        <EmptyState title={text('activities_empty')} icon={Calendar} />
      ) : (
        <div className="mt-12 border-y border-border/75">
          {items.map((a) => (
            <article key={a.id} className="grid gap-5 border-b border-border/75 py-8 last:border-b-0 md:grid-cols-[7.5rem_minmax(0,1fr)] md:gap-7 sm:py-10">
              <aside className="hidden pt-1 md:block">
                <span className="font-mono-date text-xs font-semibold text-primary">{formatDate(a.date)}</span>
                {a.location && <span className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><MapPin size={12} strokeWidth={1.8} className="mt-0.5 shrink-0" /> {a.location}</span>}
              </aside>
              <div className={a.image_url ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] lg:items-start lg:gap-8' : ''}>
                {a.image_url && (
                  <img
                    src={a.image_url}
                    alt={a.title || text('activities_title')}
                    loading="lazy"
                    className="block h-auto w-full rounded-xl border border-border/75 bg-secondary/40 shadow-[0_12px_30px_hsl(var(--foreground)/0.035)]"
                  />
                )}
                <div className="min-w-0 lg:pt-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden">
                    <span className="flex items-center gap-1.5 font-mono-date text-xs text-primary"><Calendar size={13} strokeWidth={1.8} /> {formatDate(a.date)}</span>
                    {a.location && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={13} strokeWidth={1.8} /> {a.location}</span>}
                  </div>
                  <h3 className="font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-foreground md:text-2xl">{a.title}</h3>
                  {a.description && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground/90">{a.description}</p>}
                  {(a.document_url || a.external_link) && (
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {a.document_url && (
                        <a href={a.document_url} target="_blank" rel="noreferrer" download className="interactive-link inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-background px-4 text-sm font-medium hover:border-primary/30 hover:bg-accent">
                          <FileDown size={14} strokeWidth={1.8} /> {text('activities_document')}
                        </a>
                      )}
                      {a.external_link && (
                        <a href={a.external_link} target="_blank" rel="noreferrer" className="interactive-link inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-background px-4 text-sm font-medium hover:border-primary/30 hover:bg-accent">
                          <ExternalLink size={14} strokeWidth={1.8} /> {text('activities_detail')}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
