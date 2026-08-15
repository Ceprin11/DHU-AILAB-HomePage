import React, { useState, useEffect } from 'react';
import { Play, Loader2, ExternalLink } from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';

export default function Videos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.VideoLink.list('-date', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Bilibili" title="B站视频" description="实验室的技术分享、项目展示与精彩瞬间，都在 B 站。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无视频</p>
      ) : (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => (
            <a key={v.id} href={v.bilibili_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md">
              <div className="relative aspect-video overflow-hidden bg-accent/40">
                {v.thumbnail_url ? (
                  <Image src={v.thumbnail_url} fittingType="fill" className="h-full w-full" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-amber/10">
                    <Play size={36} className="text-primary/50" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/20">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/80 text-background opacity-0 transition-opacity group-hover:opacity-100">
                    <Play size={22} className="ml-0.5 fill-current" />
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono-date text-xs text-muted-foreground">{formatDate(v.date)}</span>
                  <ExternalLink size={11} className="text-muted-foreground" />
                </div>
                <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-foreground line-clamp-2">{v.title}</h3>
                {v.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{v.description}</p>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
