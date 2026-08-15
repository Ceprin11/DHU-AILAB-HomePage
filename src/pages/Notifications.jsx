import React, { useState, useEffect } from 'react';
import { Bell, Loader2, Pin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { cn } from '@/lib/utils';

const CATEGORY = { notice: '通知', news: '新闻', event: '活动' };

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    base44.entities.Notification.list('-date', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);
  const list = [...pinned, ...rest];

  return (
    <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Notice" title="通知公告" description="实验室最新动态、新闻与活动通知。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : list.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无通知</p>
      ) : (
        <div className="mt-10">
          {active ? (
            <div>
              <button onClick={() => setActive(null)} className="mb-6 text-sm text-primary hover:underline">← 返回列表</button>
              <article className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <div className="flex items-center gap-2">
                  {active.pinned && <span className="flex items-center gap-1 rounded bg-amber/15 px-2 py-0.5 text-xs font-semibold text-amber-foreground"><Pin size={11} /> 置顶</span>}
                  <span className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-primary">{CATEGORY[active.category] || '通知'}</span>
                </div>
                <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{active.title}</h1>
                <p className="mt-2 font-mono-date text-sm text-muted-foreground">{formatDate(active.date)}</p>
                <div className="mt-6 whitespace-pre-line text-base leading-relaxed text-foreground/90">{active.content}</div>
              </article>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setActive(n)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-xl border bg-card px-5 py-4 text-left transition-colors hover:border-primary/40',
                    n.pinned ? 'border-amber/40' : 'border-border'
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Bell size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {n.pinned && <Pin size={12} className="shrink-0 text-amber" />}
                      <p className="truncate font-medium text-foreground">{n.title}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{n.content}</p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="font-mono-date text-xs text-muted-foreground">{formatDate(n.date)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{CATEGORY[n.category] || '通知'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}