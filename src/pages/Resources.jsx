import React, { useState, useEffect } from 'react';
import { FileText, FileCode, Database, FileBox, Video, Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { cn } from '@/lib/utils';

const TYPE_ICON = {
  pdf: { icon: FileText, cls: 'bg-red-500/10 text-red-500' },
  code: { icon: FileCode, cls: 'bg-primary/10 text-primary' },
  data: { icon: Database, cls: 'bg-emerald-500/10 text-emerald-600' },
  doc: { icon: FileBox, cls: 'bg-amber/15 text-amber-foreground' },
  video: { icon: Video, cls: 'bg-primary/10 text-primary' },
  other: { icon: FileBox, cls: 'bg-secondary text-secondary-foreground' },
};

export default function Resources() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('全部');

  useEffect(() => {
    base44.entities.StudyMaterial.list('-date', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = ['全部', ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))];
  const filtered = cat === '全部' ? items : items.filter((i) => i.category === cat);

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Knowledge Vault" title="学习资料" description="实验室精选的 AI 学习资源，涵盖论文、代码、数据集与视频。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {categories.length > 1 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    cat === c ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="mt-10 rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无资料</p>
          ) : (
            <div className="mt-8 space-y-4">
              {filtered.map((m) => {
                const t = TYPE_ICON[m.file_type] || TYPE_ICON.other;
                const isVideo = m.file_type === 'video' && m.file_url;
                return (
                  <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', t.cls)}>
                        <t.icon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-foreground">{m.title}</h3>
                        {m.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{m.description}</p>}
                        <div className="mt-1 flex items-center gap-2 font-mono-date text-xs text-muted-foreground">
                          <span>{m.file_type?.toUpperCase()}</span>
                          <span>·</span>
                          <span>{formatDate(m.date)}</span>
                          {m.category && <><span>·</span><span>{m.category}</span></>}
                        </div>
                      </div>
                      {m.file_url && !isVideo && (
                        <a href={m.file_url} target="_blank" rel="noreferrer" download className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
                          <Download size={14} /> 下载
                        </a>
                      )}
                    </div>
                    {isVideo && (
                      <div className="border-t border-border bg-black">
                        <video src={m.file_url} controls className="max-h-80 w-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}