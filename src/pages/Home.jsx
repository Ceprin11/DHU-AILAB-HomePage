import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell, Trophy, Users, Camera, BookOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useSiteSettings, formatDate } from '@/lib/site';
import { Image } from '@/components/ui/image';
import SectionHeading from '@/components/SectionHeading';
import PhotoCarousel from '@/components/PhotoCarousel';

const HERO_PHOTOS = [
  'https://media.base44.com/images/public/6a802abc08cc560d7cecf5bf/3c5b174a2_38f6a6d4a5ea8e8852a121167d3cdb00.jpg',
  'https://media.base44.com/images/public/6a802abc08cc560d7cecf5bf/c008f876f_8fac8d49748dffdb2d0ed9cea52a8d41.jpg',
  'https://media.base44.com/images/public/6a802abc08cc560d7cecf5bf/6140b4efe_bccb7f9f1b01aee4df1ecae370e6c4c5.jpg',
  'https://media.base44.com/images/public/6a802abc08cc560d7cecf5bf/3a4d2adac_3f81da846781dbff54ba91da09a3faf7.jpg',
];

export default function Home() {
  const settings = useSiteSettings();
  const [notifs, setNotifs] = useState([]);
  const [awards, setAwards] = useState([]);
  const [heroPhotos, setHeroPhotos] = useState(HERO_PHOTOS);
  const [stats, setStats] = useState({ members: 0, awards: 0, activities: 0 });

  useEffect(() => {
    base44.entities.Notification.list('-date', 3).then(setNotifs).catch(() => {});
    base44.entities.Award.list('-date', 3).then(setAwards).catch(() => {});
    base44.entities.HomeImage.list('order_index', 50)
      .then((rows) => {
        const photos = (rows || []).map((item) => item.image_url).filter(Boolean);
        if (photos.length > 0) setHeroPhotos(photos);
      })
      .catch(() => {});
    Promise.all([
      base44.entities.Member.list().then((r) => r.length).catch(() => 0),
      base44.entities.Award.list().then((r) => r.length).catch(() => 0),
      base44.entities.Activity.list().then((r) => r.length).catch(() => 0),
    ]).then(([m, a, act]) => setStats({ members: m, awards: a, activities: act }));
  }, []);

  const quickLinks = [
    { to: '/members', label: '团队风采', desc: '认识实验室的核心团队', icon: Users },
    { to: '/awards', label: '成果展示', desc: '竞赛获奖与科研成果', icon: Trophy },
    { to: '/club-life', label: '社团生活', desc: '踏青、团建与日常点滴', icon: Camera },
    { to: '/resources', label: '学习资料', desc: '精选 AI 学习资源库', icon: BookOpen },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 neural-grid opacity-60" />
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2">
                <span className="h-px w-8 bg-primary" />
                <span className="font-mono-date text-xs uppercase tracking-[0.25em] text-primary">Donghua University · AILAB</span>
              </div>
              <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl xl:text-7xl text-balance">
                人工智能<br />创新实验室
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-balance">
                {settings?.lab_intro || '探索智能前沿，编织学术未来。我们汇聚东华大学对人工智能充满热情的青年学者，以代码为梭，以算法为线，织就属于这个时代的智能图景。'}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/join" className="inline-flex h-12 items-center gap-2 rounded-full bg-amber px-7 text-base font-semibold text-amber-foreground shadow-sm transition-transform hover:scale-[1.02]">
                  加入我们 <ArrowRight size={18} />
                </Link>
                <Link to="/members" className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-background px-7 text-base font-semibold text-foreground transition-colors hover:bg-accent">
                  了解团队
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5">
              <PhotoCarousel photos={heroPhotos} />
            </div>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {[
              { label: '实验室成员', value: stats.members, unit: '人' },
              { label: '成果数量', value: stats.awards, unit: '项' },
              { label: '社团活动', value: stats.activities, unit: '场' },
            ].map((s) => (
              <div key={s.label} className="bg-background px-4 py-6 sm:px-6">
                <p className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
                  {String(s.value).padStart(2, '0')}<span className="ml-1 text-base font-normal text-muted-foreground">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <SectionHeading eyebrow="Explore" title="走进实验室" description="从团队、成果到活动，全面了解 AILAB 的方方面面。" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((q) => (
            <Link key={q.to} to={q.to} className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">
                  <q.icon size={20} />
                </div>
                <ArrowUpRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-foreground">{q.label}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{q.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest notifications */}
      <section className="border-y border-border bg-secondary/30">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="flex items-end justify-between">
            <SectionHeading eyebrow="Latest" title="最新通知" />
            <Link to="/notifications" className="hidden items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:flex">查看全部 <ArrowRight size={15} /></Link>
          </div>
          <div className="mt-10 space-y-3">
            {notifs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">暂无通知</p>
            ) : notifs.map((n) => (
              <Link key={n.id} to="/notifications" className="group flex items-center gap-4 rounded-xl border border-border bg-background px-5 py-4 transition-colors hover:border-primary/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Bell size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {n.pinned && <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-foreground">置顶</span>}
                    <p className="truncate font-medium text-foreground">{n.title}</p>
                  </div>
                </div>
                <span className="shrink-0 font-mono-date text-xs text-muted-foreground">{formatDate(n.date)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured achievements */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="flex items-end justify-between">
          <SectionHeading eyebrow="Honors" title="成果展示" />
          <Link to="/awards" className="hidden items-center gap-1.5 text-sm font-medium text-primary hover:underline sm:flex">查看全部 <ArrowRight size={15} /></Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {awards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground sm:col-span-3">暂无成果</p>
          ) : awards.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {a.image_url ? (
                <div className="aspect-[16/10] overflow-hidden border-b border-border">
                  <Image src={a.image_url} fittingType="fill" className="h-full w-full" />
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center border-b border-border bg-accent/40">
                  <Trophy size={32} className="text-primary/50" />
                </div>
              )}
              <div className="p-5">
                <p className="font-mono-date text-xs text-muted-foreground">{formatDate(a.date)}</p>
                <h3 className="mt-1.5 font-display text-base font-semibold leading-snug text-foreground">{a.title}</h3>
                {a.recipient && <p className="mt-1 text-sm text-muted-foreground">{a.recipient}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-16 sm:px-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">准备好加入我们了吗？</h2>
            <p className="mt-3 max-w-lg text-primary-foreground/80">无论你是初学者还是资深研究者，AILAB 都欢迎你的到来。</p>
          </div>
          <Link to="/join" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-amber px-7 text-base font-semibold text-amber-foreground transition-transform hover:scale-[1.02]">
            查看加入方式 <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
