import React, { useState, useEffect } from 'react';
import { ChevronDown, HelpCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SectionHeading from '@/components/SectionHeading';
import { cn } from '@/lib/utils';

export default function QAPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    base44.entities.QA.list('order_index', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...items].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Q & A" title="常见问题" description="关于实验室、加入方式与日常活动的常见疑问解答。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无问答</p>
      ) : (
        <div className="mt-10 space-y-3">
          {sorted.map((q, i) => {
            const isOpen = open === q.id;
            return (
              <div key={q.id} className={cn('overflow-hidden rounded-xl border bg-card transition-colors', isOpen ? 'border-primary/40' : 'border-border')}>
                <button
                  onClick={() => setOpen(isOpen ? null : q.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span className="font-mono-date text-sm font-semibold text-primary">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 font-medium text-foreground">{q.question}</span>
                  <ChevronDown size={18} className={cn('shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180 text-primary')} />
                </button>
                <div className={cn('grid transition-all', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden">
                    <div className="border-t border-border px-5 py-4 pl-14">
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{q.answer}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}