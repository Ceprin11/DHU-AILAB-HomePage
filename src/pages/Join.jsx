import React from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { Mail, Play, MessageCircle, Check } from 'lucide-react';
import { useSiteSettings } from '@/lib/site';
import SectionHeading from '@/components/SectionHeading';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSiteText } from '@/lib/siteText';
import { MotionItem, Reveal } from '@/components/motion/MotionPrimitives';

function Branch({ title, requirements, process, text }) {
  const reduceMotion = useReducedMotion();
  const reqs = (requirements || '').split('\n').filter(Boolean);
  const steps = (process || '').split('\n').filter(Boolean);

  return (
    <m.div initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }} className="grid gap-12 lg:grid-cols-2 lg:gap-0">
      <div className="lg:pr-12">
        <h3 className="font-display text-lg font-semibold text-foreground">{title}{text('join_requirements')}</h3>
        {reqs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{title}{text('join_requirements')}暂未设置</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {reqs.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-accent text-primary"><Check size={14} strokeWidth={1.8} /></span>
                <span className="text-base leading-relaxed text-foreground/90">{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="lg:border-l lg:border-border/75 lg:pl-12">
        <h3 className="font-display text-lg font-semibold text-foreground">{title}{text('join_process')}</h3>
        {steps.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{title}{text('join_process')}暂未设置</p>
        ) : (
          <ol className="mt-6 space-y-0">
            {steps.map((p, i) => (
              <li key={i} className="relative flex gap-4 pb-8 last:pb-0">
                {i < steps.length - 1 && <span className="thread-line absolute left-[15px] top-9 h-[calc(100%-2rem)] w-px" />}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-mono-date text-sm font-semibold text-primary">{i + 1}</span>
                <div className="pt-1"><p className="text-base font-medium text-foreground">{p}</p></div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </m.div>
  );
}

export default function Join() {
  const settings = useSiteSettings();
  const text = useSiteText();

  const contacts = [
    settings?.contact_email && { icon: Mail, label: text('join_email_label'), value: settings.contact_email, href: `mailto:${settings.contact_email}` },
    settings?.bilibili_url && { icon: Play, label: text('join_bilibili_label'), value: settings.bilibili_name || text('join_bilibili_label'), href: settings.bilibili_url },
    settings?.qq_group && { icon: MessageCircle, label: text('join_qq_label'), value: settings.qq_group },
  ].filter(Boolean);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 neural-grid opacity-50" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
        <div className="page-shell relative py-20 sm:py-28">
          <Reveal className="max-w-2xl" amount={0.05}>
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-amber" />
              <span className="font-mono-date text-xs uppercase tracking-[0.25em] text-amber-foreground">{text('join_eyebrow')}</span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">{text('join_title')}</h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-balance">
              {text('join_description')}
            </p>
          </Reveal>
        </div>
      </section>

      <div className="page-shell py-16 sm:py-20">
        <Tabs defaultValue="autumn">
          <TabsList className="inline-flex h-auto w-fit justify-start gap-1 rounded-full border border-border/75 bg-secondary/50 p-1">
            <TabsTrigger value="autumn">{text('join_autumn')}</TabsTrigger>
            <TabsTrigger value="summer">{text('join_summer')}</TabsTrigger>
          </TabsList>
          <TabsContent value="autumn" className="mt-10">
            <Branch title={text('join_autumn')} requirements={settings?.autumn_requirements} process={settings?.autumn_process} text={text} />
          </TabsContent>
          <TabsContent value="summer" className="mt-10">
            <Branch title={text('join_summer')} requirements={settings?.summer_requirements} process={settings?.summer_process} text={text} />
          </TabsContent>
        </Tabs>

        <div className="mt-16 border-y border-border/75 bg-secondary/30 px-5 py-10 sm:px-8 sm:py-12">
          <SectionHeading eyebrow={text('join_contact_eyebrow')} title={text('join_contact_title')} description={text('join_contact_description')} />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{text('join_no_contact')}</p>
            ) : contacts.map((c, i) => {
              const Inner = (
                <div className="flex h-full flex-col items-start gap-3 rounded-xl border border-border/75 bg-background p-5 shadow-[0_10px_26px_hsl(var(--foreground)/0.03)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_32px_hsl(var(--primary)/0.08)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/10 bg-accent text-primary"><c.icon size={18} strokeWidth={1.8} /></span>
                  <div>
                    <p className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">{c.label}</p>
                    <p className="mt-1 break-all font-medium text-foreground">{c.value}</p>
                  </div>
                </div>
              );
              return c.href ? (
                <MotionItem key={c.label} index={i}><a href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="block">{Inner}</a></MotionItem>
              ) : (
                <MotionItem key={c.label} index={i}>{Inner}</MotionItem>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
