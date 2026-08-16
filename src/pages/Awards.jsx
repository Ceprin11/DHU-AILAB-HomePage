import React, { useState, useEffect } from 'react';
import { Trophy, FlaskConical, FileText } from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { cn } from '@/lib/utils';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';

const LEVEL = {
  national: { textKey: 'awards_level_national', cls: 'bg-amber/30 text-primary' },
  provincial: { textKey: 'awards_level_provincial', cls: 'bg-accent text-primary' },
  university: { textKey: 'awards_level_university', cls: 'bg-secondary text-secondary-foreground' },
  other: { textKey: 'awards_level_other', cls: 'bg-muted text-muted-foreground' },
};

function AwardEntry({ a, text }) {
  const isResearch = a.type === 'research';
  const level = LEVEL[a.level] || LEVEL.other;
  return (
    <article className="group grid gap-5 border-t border-border/75 py-7 first:border-t-0 first:pt-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-7 sm:py-8">
      <div>
        {a.image_url ? (
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border/75 bg-secondary/45 shadow-[0_10px_26px_hsl(var(--foreground)/0.03)]">
            <Image src={a.image_url} fittingType="fit" className="h-full w-full object-contain saturate-[0.92] transition-[filter] duration-300 group-hover:saturate-100" />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-border/75 bg-secondary/35 text-primary">
            {isResearch ? <FlaskConical size={25} strokeWidth={1.5} /> : <Trophy size={25} strokeWidth={1.5} />}
          </div>
        )}
      </div>
      <div className="min-w-0 sm:pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {!isResearch && a.level && <span className={cn('rounded-md px-2.5 py-1 text-xs font-semibold', level.cls)}>{text(level.textKey)}</span>}
          {isResearch && a.ccf_level && <span className="rounded-md bg-amber/30 px-2.5 py-1 text-xs font-semibold text-primary">{a.ccf_level}</span>}
          <span className="font-mono-date text-xs text-muted-foreground">{formatDate(a.date)}</span>
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-2xl">{a.title}</h3>
        {a.recipient && <p className="mt-1.5 text-sm font-medium text-primary">{a.recipient}</p>}
        {a.description && <p className="mt-3 max-w-[65ch] text-sm leading-7 text-muted-foreground">{a.description}</p>}
        {a.notes && (
          <p className="mt-4 flex items-start gap-2 border-l-2 border-primary/30 pl-3 text-xs leading-5 text-muted-foreground">
            <FileText size={13} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" /> {a.notes}
          </p>
        )}
      </div>
    </article>
  );
}

function AwardGrid({ items, emptyTitle, emptyIcon, text }) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} icon={emptyIcon} className="mt-0" />;
  }

  return (
    <div>
      {items.map((award) => <AwardEntry key={award.id} a={award} text={text} />)}
    </div>
  );
}

export default function Awards() {
  const text = useSiteText();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.Award.list('-date', 300)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const competitions = items.filter((i) => i.type !== 'research');
  const researches = items.filter((i) => i.type === 'research');

  return (
    <div className="page-shell page-section max-w-6xl">
      <SectionHeading eyebrow={text('awards_eyebrow')} title={text('awards_title')} description={text('awards_description')} />

      {loading ? (
        <ContentLoading variant="grid" count={4} className="lg:grid-cols-2" />
      ) : (
        <Tabs defaultValue="competition" className="mt-12">
          <TabsList className="flex h-auto w-full justify-start gap-7 rounded-none border-b border-border/75 bg-transparent p-0">
            <TabsTrigger value="competition" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-0 pb-3 text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"><Trophy size={15} strokeWidth={1.8} /> {text('awards_competition')} <span className="font-mono-date text-[11px] text-muted-foreground">{String(competitions.length).padStart(2, '0')}</span></TabsTrigger>
            <TabsTrigger value="research" className="h-11 gap-2 rounded-none border-b-2 border-transparent px-0 pb-3 text-muted-foreground shadow-none transition-colors data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"><FlaskConical size={15} strokeWidth={1.8} /> {text('awards_research')} <span className="font-mono-date text-[11px] text-muted-foreground">{String(researches.length).padStart(2, '0')}</span></TabsTrigger>
          </TabsList>
          <TabsContent value="competition" className="mt-9">
            <AwardGrid items={competitions} emptyTitle={text('awards_empty_competition')} emptyIcon={Trophy} text={text} />
          </TabsContent>
          <TabsContent value="research" className="mt-9">
            <AwardGrid items={researches} emptyTitle={text('awards_empty_research')} emptyIcon={FlaskConical} text={text} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
