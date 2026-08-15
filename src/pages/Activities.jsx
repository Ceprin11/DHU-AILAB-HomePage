import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Loader2, FileDown, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';

export default function Activities() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Activity.list('-date', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Activities" title="社团活动" description="技术沙龙、项目实践与学术交流——记录实验室的每一次相聚。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无活动</p>
      ) : (
        <div className="mt-12 space-y-8">
          {items.map((a, i) => (
            <div key={a.id} className="relative grid gap-6 sm:grid-cols-5">
              <div className="hidden sm:flex sm:col-span-1">
                <div className="flex w-full flex-col items-end pr-6 pt-1">
                  <span className="font-mono-date text-sm font-semibold text-primary">{formatDate(a.date)}</span>
                  {a.location && <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={11} /> {a.location}</span>}
                  {i < items.length - 1 && <span className="thread-line mt-3 h-full w-px flex-1" />}
                </div>
              </div>
              <div className="sm:col-span-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-md">
                  {a.image_url && (
                    <div className="aspect-[16/9] overflow-hidden border-b border-border">
                      <Image src={a.image_url} fittingType="fill" className="h-full w-full" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 sm:hidden">
                      <Calendar size={13} className="text-primary" />
                      <span className="font-mono-date text-xs text-muted-foreground">{formatDate(a.date)}</span>
                    </div>
                    <h3 className="font-display text-xl font-semibold text-foreground">{a.title}</h3>
                    {a.location && <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground sm:hidden"><MapPin size={13} /> {a.location}</p>}
                    {a.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{a.description}</p>}
                    {(a.document_url || a.external_link) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {a.document_url && (
                          <a href={a.document_url} target="_blank" rel="noreferrer" download className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                            <FileDown size={14} /> 相关文档
                          </a>
                        )}
                        {a.external_link && (
                          <a href={a.external_link} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                            <ExternalLink size={14} /> 详情链接
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}