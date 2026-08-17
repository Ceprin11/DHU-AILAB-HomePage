import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell, Trophy, Users, Camera, BookOpen } from 'lucide-react';
import { api } from '@/api/client';
import { useSiteSettings, formatDate } from '@/lib/site';
import { Image } from '@/components/ui/image';
import PhotoCarousel from '@/components/PhotoCarousel';
import { splitTextLines, useSiteText } from '@/lib/siteText';
import { AnimatedNumber, MotionItem, Reveal } from '@/components/motion/MotionPrimitives';
import { useEntityStats } from '@/hooks/use-entity-stats';

export default function Home() {
  const settings = useSiteSettings();
  const text = useSiteText();
  const [notifs, setNotifs] = useState([]);
  const [awards, setAwards] = useState([]);
  const [heroPhotos, setHeroPhotos] = useState([]);
  const stats = useEntityStats();

  useEffect(() => {
    api.entities.Notification.list('-date', 3).then(setNotifs).catch(() => {});
    api.entities.Award.list('-date', 3).then(setAwards).catch(() => {});
    api.entities.HomeImage.list('order_index', 50)
      .then((rows) => {
        const photos = (rows || []).map((item) => item.image_url).filter(Boolean);
        setHeroPhotos(photos);
      })
      .catch(() => {});
  }, []);

  const quickLinks = [
    { to: '/members', label: text('home_team_card_title'), desc: text('home_team_card_desc'), icon: Users },
    { to: '/awards', label: text('home_awards_card_title'), desc: text('home_awards_card_desc'), icon: Trophy },
    { to: '/club-life', label: text('home_life_card_title'), desc: text('home_life_card_desc'), icon: Camera },
    { to: '/resources', label: text('home_resources_card_title'), desc: text('home_resources_card_desc'), icon: BookOpen },
  ];

  const statItems = [
    { label: text('home_members_stat'), value: stats.members, unit: text('home_members_unit') },
    { label: text('home_awards_stat'), value: stats.awards, unit: text('home_awards_unit') },
    { label: text('home_activities_stat'), value: stats.activities, unit: text('home_activities_unit') },
  ];

  return (
    <div className="overflow-hidden bg-transparent">
      {/* Hero */}
      <section className="home-hero-atmosphere relative border-b border-border/80">
        <div className="absolute inset-0 neural-grid opacity-20" />
        <div className="absolute -left-40 top-16 h-80 w-80 rounded-full bg-amber/20 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
          <div className={`grid items-center gap-10 lg:gap-14 ${heroPhotos.length > 0 ? 'lg:grid-cols-12' : ''}`}>
            <Reveal className={heroPhotos.length > 0 ? 'lg:col-span-6' : 'max-w-3xl'} amount={0.05}>
              <div className="flex items-center gap-3 text-amber-foreground">
                <span className="h-px w-8 bg-amber-foreground/60" />
                <span className="font-mono-date text-xs uppercase tracking-[0.22em]">{text('home_eyebrow')}</span>
              </div>
              <h1 className="mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-5xl xl:text-6xl text-balance">
                {splitTextLines(text('home_title')).map((line, index) => <React.Fragment key={line}>{index > 0 && <br />}{line}</React.Fragment>)}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                {settings?.lab_intro || text('home_intro_default')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/join" className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-amber px-6 text-sm font-semibold text-amber-foreground shadow-[0_10px_30px_hsl(var(--amber)/0.22)] transition-transform hover:-translate-y-0.5 active:translate-y-0">
                  {text('home_join_button')} <ArrowRight size={17} />
                </Link>
                <Link to="/members" className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background/80 px-6 text-sm font-semibold text-foreground transition-colors hover:border-amber-foreground/30 hover:bg-amber/10 active:bg-amber/20">
                  {text('home_team_button')}
                </Link>
              </div>

              <div className="mt-10 grid grid-cols-3 border-y border-border/80">
                {statItems.map((stat, index) => (
                  <div key={stat.label} className={index === 0 ? 'py-5 pr-3' : 'border-l border-border/80 px-3 py-5 sm:px-5'}>
                    <p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                    <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      <AnimatedNumber value={stat.value} />
                      <span className="ml-1 text-xs font-medium text-muted-foreground sm:text-sm">{stat.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>

            {heroPhotos.length > 0 && (
              <Reveal className="relative lg:col-span-6" delay={0.08} amount={0.05}>
                <div className="absolute inset-[8%] rounded-[2rem] bg-amber/15 blur-3xl" />
                <PhotoCarousel photos={heroPhotos} className="aspect-[5/4]" />
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="section-clear mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5 text-amber-foreground">
            <span className="h-px w-6 bg-amber-foreground/60" />
            <span className="font-mono-date text-xs uppercase tracking-[0.2em]">{text('home_explore_eyebrow')}</span>
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{text('home_explore_title')}</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{text('home_explore_description')}</p>
        </div>

        <div className="mt-10 grid border-y border-border sm:grid-cols-2">
          {quickLinks.map((item, index) => (
            <MotionItem key={item.to} index={index}>
              <Link
                to={item.to}
                className={`group flex min-h-40 items-start gap-5 py-7 transition-colors hover:bg-amber/10 active:bg-amber/20 sm:px-7 ${index < 2 ? 'border-b border-border' : ''} ${index % 2 === 0 ? 'sm:border-r sm:pl-0' : 'sm:pr-0'}`}
              >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber/25 text-amber-foreground transition-transform group-hover:-translate-y-0.5">
                <item.icon size={20} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-4">
                  <span className="font-display text-lg font-semibold text-foreground">{item.label}</span>
                  <ArrowUpRight size={18} className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-foreground" />
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">{item.desc}</span>
              </span>
              </Link>
            </MotionItem>
          ))}
        </div>
      </section>

      {/* Latest notifications */}
      <section className="section-tint border-y border-border">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{text('home_latest_title')}</h2>
              <p className="mt-2 font-mono-date text-xs text-muted-foreground">{text('home_latest_eyebrow')}</p>
            </div>
            <Link to="/notifications" className="hidden items-center gap-2 whitespace-nowrap text-sm font-semibold text-amber-foreground transition-colors hover:text-foreground sm:flex">{text('home_view_all')} <ArrowRight size={15} /></Link>
          </div>

          <div className="mt-8 border-y border-border">
            {notifs.length === 0 ? (
              <div className="flex items-center gap-4 py-10 text-sm text-muted-foreground">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber/20 text-amber-foreground"><Bell size={18} strokeWidth={1.8} /></span>
                <p>{text('home_empty_notice')}</p>
              </div>
            ) : notifs.map((notification, index) => (
              <Link key={notification.id} to="/notifications" className={`group flex items-center gap-4 py-5 transition-colors hover:text-amber-foreground ${index > 0 ? 'border-t border-border' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/20 text-amber-foreground"><Bell size={17} strokeWidth={1.8} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {notification.pinned && <span className="rounded-md bg-amber/25 px-2 py-0.5 text-[10px] font-semibold text-amber-foreground">{text('home_pinned')}</span>}
                    <p className="truncate font-medium text-foreground group-hover:text-amber-foreground">{notification.title}</p>
                  </div>
                </div>
                <span className="shrink-0 font-mono-date text-xs text-muted-foreground">{formatDate(notification.date)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured achievements */}
      <section className="section-clear mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{text('home_awards_title')}</h2>
            <p className="mt-2 font-mono-date text-xs text-muted-foreground">{text('home_awards_eyebrow')}</p>
          </div>
          <Link to="/awards" className="hidden items-center gap-2 whitespace-nowrap text-sm font-semibold text-amber-foreground transition-colors hover:text-foreground sm:flex">{text('home_view_all')} <ArrowRight size={15} /></Link>
        </div>

        <div className="mt-8 border-y border-border">
          {awards.length === 0 ? (
            <div className="flex items-center gap-4 py-10 text-sm text-muted-foreground">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber/20 text-amber-foreground"><Trophy size={19} strokeWidth={1.8} /></span>
              <p>{text('home_empty_awards')}</p>
            </div>
          ) : awards.map((award, index) => (
            <article key={award.id} className={`grid gap-5 py-6 sm:grid-cols-[12rem_1fr] sm:items-center ${index > 0 ? 'border-t border-border' : ''}`}>
              {award.image_url ? (
                <div className="aspect-[16/10] overflow-hidden rounded-xl bg-accent">
                  <Image src={award.image_url} fittingType="fit" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-amber/15">
                  <Trophy size={28} strokeWidth={1.6} className="text-amber-foreground/60" />
                </div>
              )}
              <div>
                <p className="font-mono-date text-xs text-muted-foreground">{formatDate(award.date)}</p>
                <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground">{award.title}</h3>
                {award.recipient && <p className="mt-2 text-sm text-muted-foreground">{award.recipient}</p>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section-accent border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 px-5 py-14 sm:px-8 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{text('home_cta_title')}</h2>
            <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">{text('home_cta_description')}</p>
          </div>
          <Link to="/join" className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-amber px-6 text-sm font-semibold text-amber-foreground shadow-[0_10px_30px_hsl(var(--amber)/0.2)] transition-transform hover:-translate-y-0.5 active:translate-y-0">
            {text('home_cta_button')} <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
