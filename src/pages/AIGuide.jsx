import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Code2,
  ExternalLink,
  Eye,
  Gamepad2,
  Lightbulb,
  Settings2,
  Wrench,
} from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { findBilibiliVideoUrl } from '@/lib/bilibili';
import { getAutomaticResourceThumbnail, getResourceThumbnailSource } from '@/lib/resourceLinks';
import { splitTextLines, useSiteText } from '@/lib/siteText';
import { MotionItem, Reveal } from '@/components/motion/MotionPrimitives';

const CATEGORY_ICONS = {
  code: Code2,
  vision: Eye,
  brain: BrainCircuit,
  gamepad: Gamepad2,
  settings: Settings2,
};

const splitLines = (value) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);

function CourseCard({ course, icon: Icon, text, index = 0 }) {
  const links = [
    [course.primary_link_label || text('guide_primary_link_default'), course.primary_url],
    [course.secondary_link_label || text('guide_secondary_link_default'), course.secondary_url],
  ].filter(([, url]) => url);
  const mainLink = links[0];
  const secondaryLinks = links.slice(1);
  const coverUrl = course.image_url || getAutomaticResourceThumbnail(course.primary_url) || getAutomaticResourceThumbnail(course.secondary_url);

  return (
    <MotionItem as="article" index={index} className={`group relative overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_10px_26px_hsl(var(--foreground)/0.03)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_32px_hsl(var(--primary)/0.08)] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 ${mainLink ? 'cursor-pointer' : ''}`}>
      {mainLink && (
        <a
          href={mainLink[1]}
          target="_blank"
          rel="noreferrer"
          aria-label={`${mainLink[0]}：${course.title}`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none"
        />
      )}
      <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-secondary/50">
        {coverUrl ? (
          <Image src={getResourceThumbnailSource(coverUrl)} alt={`${course.title}封面`} fittingType="fit" className="h-full w-full object-contain" />
        ) : (
          <Icon size={38} strokeWidth={1.4} className="text-primary/35" />
        )}
      </div>
      <div className="p-5">
        <h4 className="line-clamp-2 font-display text-lg font-semibold leading-snug text-foreground">{course.title}</h4>
        {course.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{course.description}</p>}
        {mainLink && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              {mainLink[0]} <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
            {secondaryLinks.map(([label, url]) => (
              <a key={`${label}-${url}`} href={url} target="_blank" rel="noreferrer" className="interactive-link relative z-20 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:border-primary/35 hover:bg-accent hover:text-primary">
                {label} <ExternalLink size={12} />
              </a>
            ))}
          </div>
        )}
      </div>
    </MotionItem>
  );
}

export default function AIGuide() {
  const text = useSiteText();
  const [stages, setStages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.entities.GuideStage.list('order_index', 100),
      api.entities.GuideCategory.list('order_index', 100),
      api.entities.GuideCourse.list('order_index', 300),
    ])
      .then(async ([stageRows, categoryRows, courseRows]) => {
        setStages(stageRows || []);
        setCategories(categoryRows || []);
        const rows = courseRows || [];
        setCourses(rows);
        const enrichedCourses = await Promise.all(rows.map(async (course) => {
          if (course.image_url) return course;
          const bilibiliUrl = findBilibiliVideoUrl(course.primary_url, course.secondary_url);
          if (!bilibiliUrl) return course;
          try {
            const metadata = await api.bilibili.preview(bilibiliUrl);
            return {
              ...course,
              title: course.title || metadata.title,
              description: course.description || metadata.description,
              image_url: metadata.thumbnail_url,
            };
          } catch {
            return course;
          }
        }));
        setCourses(enrichedCourses);
      })
      .catch(() => {
        setStages([]);
        setCategories([]);
        setCourses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const coursesByCategory = useMemo(() => courses.reduce((grouped, course) => {
    if (!grouped[course.category_id]) grouped[course.category_id] = [];
    grouped[course.category_id].push(course);
    return grouped;
  }, {}), [courses]);
  const purposeImage = text('guide_purpose_image');
  const aboutImage = text('guide_about_image');

  return (
    <div>
      <section className="border-b border-border bg-primary/[0.08]">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-20 text-center sm:px-8 sm:py-24">
          <p className="font-mono-date text-xs uppercase tracking-[0.22em] text-primary">{text('guide_eyebrow')}</p>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{text('guide_title')}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{text('guide_subtitle')}</p>
          <a href="#guide-purpose" className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0">
            {text('guide_start_button')} <ArrowRight size={16} />
          </a>
        </div>
      </section>

      <section id="guide-purpose" className="scroll-mt-24 bg-secondary/30">
        <div className={`mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 md:items-center ${purposeImage ? 'md:grid-cols-2' : ''}`}>
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">{text('guide_purpose_title')}</h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">{text('guide_purpose_p1')}</p>
            <p className="mt-3 text-base leading-8 text-muted-foreground">{text('guide_purpose_p2')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {splitTextLines(text('guide_purpose_tags')).map((label, index) => {
                const Icon = [Lightbulb, Wrench, BrainCircuit][index % 3];
                return (
                <span key={label} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground">
                  <Icon size={15} className="text-primary" /> {label}
                </span>
                );
              })}
            </div>
          </div>
          {purposeImage && (
            <div className="relative">
              <div className="absolute inset-[10%] rounded-[2rem] bg-primary/10 blur-3xl" />
              <div className="photo-soft-edge relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-background">
                <Image src={purposeImage} alt="AILAB 实验室学习与交流" fittingType="fit" className="h-full w-full object-contain" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="learning-path" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">{text('guide_path_title')}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{text('guide_path_subtitle')}</p>
          </div>
          {loading ? (
            <ContentLoading variant="grid" count={2} className="mt-10 md:grid-cols-2" />
          ) : stages.length === 0 ? (
            <EmptyState title={text('guide_empty_stage')} icon={BrainCircuit} className="mt-10" />
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {stages.map((stage, index) => (
                <MotionItem as="article" index={index} key={stage.id} className="overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_10px_26px_hsl(var(--foreground)/0.03)]">
                  <div className="relative border-b border-border/75 bg-secondary/50 px-6 py-6">
                    <span className="font-mono-date text-xs font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span>
                    <h3 className="mt-3 font-display text-2xl font-bold text-foreground">{stage.title}</h3>
                    {stage.subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{stage.subtitle}</p>}
                  </div>
                  <ul className="space-y-3 p-6">
                    {splitLines(stage.requirements).map((requirement) => (
                      <li key={requirement} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                        <Check size={15} className="mt-1 shrink-0 text-primary" /> {requirement}
                      </li>
                    ))}
                  </ul>
                </MotionItem>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="guide-resources" className="scroll-mt-24 bg-secondary/30">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">{text('guide_resources_title')}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{text('guide_resources_subtitle')}</p>
          </div>
          {loading ? (
            <ContentLoading variant="grid" count={6} className="mt-10 lg:grid-cols-3" />
          ) : categories.length === 0 ? (
            <EmptyState title={text('guide_empty_category')} icon={Code2} className="mt-10" />
          ) : (
            <div className="mt-12 space-y-16">
              {categories.map((category, categoryIndex) => {
                const Icon = CATEGORY_ICONS[category.icon] || Code2;
                const categoryCourses = coursesByCategory[category.id] || [];
                return (
                  <Reveal as="section" key={category.id} delay={Math.min(categoryIndex, 3) * 0.04}>
                    <div className="flex items-center gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-accent text-primary"><Icon size={21} strokeWidth={1.8} /></span>
                      <div>
                        <h3 className="font-display text-2xl font-bold text-foreground">{category.title}</h3>
                        {category.description && <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>}
                      </div>
                    </div>
                    {categoryCourses.length === 0 ? (
                      <p className="mt-6 rounded-xl border border-dashed border-border bg-background/60 px-5 py-8 text-center text-sm text-muted-foreground">{text('guide_empty_course')}</p>
                    ) : (
                      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {categoryCourses.map((course, index) => <CourseCard key={course.id} course={course} icon={Icon} text={text} index={index} />)}
                      </div>
                    )}
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section id="about-ailab" className="scroll-mt-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-2 md:items-start">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">{text('guide_about_title')}</h2>
            <p className="mt-5 text-base leading-8 text-muted-foreground">{text('guide_about_description')}</p>
            <div className="mt-7 grid grid-cols-2 gap-3 text-sm">
              {splitTextLines(text('guide_about_areas')).map((area) => (
                <div key={area} className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-foreground">{area}</div>
              ))}
            </div>
          </div>
          <div>
            {aboutImage && (
              <div className="relative">
                <div className="absolute inset-[10%] rounded-[2rem] bg-primary/10 blur-3xl" />
                <div className="photo-soft-edge relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-background">
                  <Image src={aboutImage} alt="AILAB 实验室活动" fittingType="fit" className="h-full w-full object-contain" />
                </div>
              </div>
            )}
            <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">{text('guide_next_title')}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text('guide_next_description')}</p>
              <Link to="/join" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">{text('guide_next_button')} <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
