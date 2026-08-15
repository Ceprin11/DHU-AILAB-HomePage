import React from 'react';
import { Mail, Play, MessageCircle, Check } from 'lucide-react';
import { useSiteSettings } from '@/lib/site';
import SectionHeading from '@/components/SectionHeading';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function Branch({ title, requirements, process, accent }) {
  const reqs = (requirements || '').split('\n').filter(Boolean);
  const steps = (process || '').split('\n').filter(Boolean);

  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">加入要求</h3>
        {reqs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">暂未设置</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {reqs.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check size={14} /></span>
                <span className="text-base leading-relaxed text-foreground/90">{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">加入流程</h3>
        {steps.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">暂未设置</p>
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
    </div>
  );
}

export default function Join() {
  const settings = useSiteSettings();

  const contacts = [
    settings?.contact_email && { icon: Mail, label: '邮箱', value: settings.contact_email, href: `mailto:${settings.contact_email}` },
    settings?.bilibili_url && { icon: Play, label: 'B站', value: settings.bilibili_name || 'B站主页', href: settings.bilibili_url },
    settings?.qq_group && { icon: MessageCircle, label: 'QQ群', value: settings.qq_group },
  ].filter(Boolean);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 neural-grid opacity-50" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-amber" />
              <span className="font-mono-date text-xs uppercase tracking-[0.25em] text-amber-foreground">How to join us</span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">加入我们，开启 AI 之旅</h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-balance">
              AILAB 每年设有秋季招新与暑期招新两个批次，要求与流程各有不同，请选择对应批次查看。
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <Tabs defaultValue="autumn">
          <TabsList className="flex w-auto gap-1 bg-secondary/50 p-1">
            <TabsTrigger value="autumn">秋季招新</TabsTrigger>
            <TabsTrigger value="summer">暑期招新</TabsTrigger>
          </TabsList>
          <TabsContent value="autumn" className="mt-10">
            <Branch title="秋季招新" requirements={settings?.autumn_requirements} process={settings?.autumn_process} />
          </TabsContent>
          <TabsContent value="summer" className="mt-10">
            <Branch title="暑期招新" requirements={settings?.summer_requirements} process={settings?.summer_process} />
          </TabsContent>
        </Tabs>

        <div className="mt-16 rounded-2xl border border-border bg-secondary/30 p-8 sm:p-10">
          <SectionHeading eyebrow="Contact" title="联系我们" description="有任何疑问，欢迎通过以下方式与我们取得联系。" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂未配置联系方式</p>
            ) : contacts.map((c, i) => {
              const Inner = (
                <div className="flex h-full flex-col items-start gap-3 rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/40">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><c.icon size={18} /></span>
                  <div>
                    <p className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">{c.label}</p>
                    <p className="mt-1 break-all font-medium text-foreground">{c.value}</p>
                  </div>
                </div>
              );
              return c.href ? (
                <a key={i} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="block">{Inner}</a>
              ) : (
                <div key={i}>{Inner}</div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}