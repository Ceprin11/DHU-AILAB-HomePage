import React, { useState, useEffect } from 'react';
import { Trophy, FlaskConical, Loader2, FileText } from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { cn } from '@/lib/utils';

const LEVEL = {
  national: { label: '国家级', cls: 'bg-primary/15 text-primary' },
  provincial: { label: '省级', cls: 'bg-amber/15 text-amber-foreground' },
  university: { label: '校级', cls: 'bg-secondary text-secondary-foreground' },
  other: { label: '其他', cls: 'bg-muted text-muted-foreground' },
};

function Card({ a }) {
  const isResearch = a.type === 'research';
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md">
      {a.image_url ? (
        <div className="aspect-[16/10] overflow-hidden border-b border-border">
          <Image src={a.image_url} fittingType="fill" className="h-full w-full" />
        </div>
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center border-b border-border bg-accent/40">
          {isResearch ? <FlaskConical size={36} className="text-primary/40" /> : <Trophy size={36} className="text-primary/40" />}
        </div>
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {!isResearch && a.level && <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', (LEVEL[a.level] || LEVEL.other).cls)}>{(LEVEL[a.level] || LEVEL.other).label}</span>}
          {isResearch && a.ccf_level && <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">{a.ccf_level}</span>}
          <span className="font-mono-date text-xs text-muted-foreground">{formatDate(a.date)}</span>
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{a.title}</h3>
        {a.recipient && <p className="mt-1 text-sm text-primary">{a.recipient}</p>}
        {a.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{a.description}</p>}
        {a.notes && (
          <p className="mt-3 flex items-start gap-1.5 rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <FileText size={12} className="mt-0.5 shrink-0" /> {a.notes}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Awards() {
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
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Achievements" title="成果展示" description="实验室成员在各类竞赛与科研中取得的成果，涵盖竞赛获奖与科研成果。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : (
        <Tabs defaultValue="competition" className="mt-10">
          <TabsList className="flex w-auto gap-1 bg-secondary/50 p-1">
            <TabsTrigger value="competition" className="gap-1.5"><Trophy size={15} /> 竞赛获奖 ({competitions.length})</TabsTrigger>
            <TabsTrigger value="research" className="gap-1.5"><FlaskConical size={15} /> 科研成果 ({researches.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="competition" className="mt-8">
            {competitions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无竞赛获奖</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{competitions.map((a) => <Card key={a.id} a={a} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="research" className="mt-8">
            {researches.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无科研成果</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{researches.map((a) => <Card key={a.id} a={a} />)}</div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
