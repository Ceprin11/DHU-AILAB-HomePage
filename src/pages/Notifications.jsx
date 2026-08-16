import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, ChevronRight, Pin } from 'lucide-react';
import { api } from '@/api/client';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { cn } from '@/lib/utils';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';

export default function Notifications() {
  const text = useSiteText();
  const categories = { notice: text('notice_category_notice'), news: text('notice_category_news'), event: text('notice_category_event') };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.entities.Notification.list('-date', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);
  const list = [...pinned, ...rest];

  return (
    <div className="page-shell page-section max-w-5xl">
      <SectionHeading eyebrow={text('notice_eyebrow')} title={text('notice_title')} description={text('notice_description')} />

      {loading ? (
        <ContentLoading />
      ) : list.length === 0 ? (
        <EmptyState title={text('notice_empty')} icon={Bell} />
      ) : (
        <div className="mt-10">
          {active ? (
            <div>
              <button onClick={() => setActive(null)} className="interactive-link mb-7 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-primary hover:text-foreground"><ArrowLeft size={15} strokeWidth={1.8} /> {text('notice_back')}</button>
              <article className="border-y border-border/75 py-7 sm:py-9">
                <div className="flex items-center gap-2">
                  {active.pinned && <span className="flex items-center gap-1.5 rounded-md bg-amber/20 px-2.5 py-1 text-xs font-semibold text-amber-foreground"><Pin size={11} strokeWidth={1.8} /> {text('notice_pinned')}</span>}
                  <span className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-primary">{categories[active.category] || text('notice_category_notice')}</span>
                </div>
                <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl">{active.title}</h1>
                <p className="mt-3 font-mono-date text-xs text-muted-foreground">{formatDate(active.date)}</p>
                <div className="mt-8 max-w-[70ch] whitespace-pre-line text-base leading-8 text-foreground/90">{active.content}</div>
              </article>
            </div>
          ) : (
            <div className="divide-y divide-border/75 border-y border-border/75">
              {list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setActive(n)}
                  className={cn(
                    'group grid w-full gap-3 px-4 py-5 text-left transition-[background-color,transform] duration-200 sm:grid-cols-[6.5rem_minmax(0,1fr)_6rem_1.25rem] sm:items-center sm:gap-5 sm:px-5 sm:py-6',
                    n.pinned ? 'bg-secondary/45 hover:bg-secondary/65' : 'hover:bg-secondary/30'
                  )}
                >
                  <div className="flex items-center gap-2 sm:block">
                    <p className="font-mono-date text-xs text-muted-foreground">{formatDate(n.date)}</p>
                    <p className="text-xs text-primary sm:mt-1.5">{categories[n.category] || text('notice_category_notice')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {n.pinned && <Pin size={13} strokeWidth={1.8} className="shrink-0 text-primary" />}
                      <p className="font-display text-base font-semibold leading-6 text-foreground transition-colors group-hover:text-primary sm:text-lg">{n.title}</p>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">{n.content}</p>
                  </div>
                  <span className="hidden justify-self-end text-xs font-medium text-muted-foreground sm:block">{n.pinned ? text('notice_pinned') : ''}</span>
                  <ChevronRight size={17} strokeWidth={1.8} className="hidden text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary sm:block" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
