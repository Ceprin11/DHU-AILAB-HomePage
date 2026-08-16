import React, { useState, useEffect } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { api } from '@/api/client';
import SectionHeading from '@/components/SectionHeading';
import { cn } from '@/lib/utils';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';

export default function QAPage() {
  const text = useSiteText();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    api.entities.QA.list('order_index', 200)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...items].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return (
    <div className="page-shell page-section max-w-3xl">
      <SectionHeading eyebrow={text('qa_eyebrow')} title={text('qa_title')} description={text('qa_description')} />

      {loading ? (
        <ContentLoading />
      ) : sorted.length === 0 ? (
        <EmptyState title={text('qa_empty')} icon={CircleHelp} />
      ) : (
        <div className="mt-10 divide-y divide-border/75 border-y border-border/75">
          {sorted.map((q, i) => {
            const isOpen = open === q.id;
            return (
              <div key={q.id} className={cn('overflow-hidden transition-colors duration-200', isOpen ? 'bg-secondary/35' : 'hover:bg-secondary/20')}>
                <button
                  onClick={() => setOpen(isOpen ? null : q.id)}
                  className="flex w-full items-center gap-4 px-3 py-5 text-left sm:px-5 sm:py-6"
                  aria-expanded={isOpen}
                  aria-controls={`qa-answer-${q.id}`}
                >
                  <span className="font-mono-date text-xs font-semibold text-primary">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 font-display text-base font-semibold leading-6 text-foreground sm:text-lg">{q.question}</span>
                  <ChevronDown size={18} strokeWidth={1.8} className={cn('shrink-0 text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180 text-primary')} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && <m.div
                    id={`qa-answer-${q.id}`}
                    initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border/70 px-3 py-5 pl-12 sm:px-5 sm:py-6 sm:pl-[4.25rem]">
                      <p className="max-w-[65ch] whitespace-pre-line text-sm leading-7 text-muted-foreground">{q.answer}</p>
                    </div>
                  </m.div>}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
