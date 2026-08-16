import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Play } from 'lucide-react';
import { useSiteSettings } from '@/lib/site';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/api/client';
import { useSiteText } from '@/lib/siteText';
import BrandMarks from '@/components/BrandMarks';

export default function Footer() {
  const settings = useSiteSettings();
  const text = useSiteText();
  const { user } = useAuth();
  const [stats, setStats] = useState({ members: 0, awards: 0, activities: 0 });

  useEffect(() => {
    Promise.all([
      api.entities.Member.list().then((r) => r.length).catch(() => 0),
      api.entities.Award.list().then((r) => r.length).catch(() => 0),
      api.entities.Activity.list().then((r) => r.length).catch(() => 0),
    ]).then(([m, a, act]) => setStats({ members: m, awards: a, activities: act }));
  }, []);

  return (
    <footer className="border-t border-border/75 bg-secondary/35">
      <div className="page-shell py-14 sm:py-16">
        <div className="grid gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <BrandMarks />
              <span className="flex flex-col leading-tight">
                <span className="font-display text-sm font-bold tracking-tight">{text('lab_name_cn')}</span>
                <span className="font-mono-date text-[10px] text-muted-foreground">{text('lab_name_en')}</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
              {text('footer_slogan')}
            </p>
            <div className="mt-6 grid max-w-sm grid-cols-3 border-y border-border/80 font-mono-date text-xs text-muted-foreground">
              <span className="py-3 pr-2">{text('footer_members_label')} / <strong className="font-semibold text-foreground">{String(stats.members).padStart(2, '0')}</strong></span>
              <span className="border-l border-border/80 px-3 py-3">{text('footer_awards_label')} / <strong className="font-semibold text-foreground">{String(stats.awards).padStart(2, '0')}</strong></span>
              <span className="border-l border-border/80 py-3 pl-3">{text('footer_activities_label')} / <strong className="font-semibold text-foreground">{String(stats.activities).padStart(2, '0')}</strong></span>
            </div>
          </div>

          <div className="md:col-span-3">
            <h4 className="font-display text-sm font-semibold text-foreground">{text('footer_nav_title')}</h4>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <li><Link to="/members" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('nav_team')}</Link></li>
              <li><Link to="/ai-guide" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('nav_guide')}</Link></li>
              <li><Link to="/notifications" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('notice_title')}</Link></li>
              <li><Link to="/awards" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('awards_title')}</Link></li>
              <li><Link to="/activities" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('activities_title')}</Link></li>
              <li><Link to="/club-life" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('life_title')}</Link></li>
              <li><Link to="/videos" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('videos_title')}</Link></li>
              <li><Link to="/resources" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('resources_title')}</Link></li>
              <li><Link to="/qa" className="interactive-link rounded-sm text-muted-foreground hover:text-primary">{text('qa_title')}</Link></li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="font-display text-sm font-semibold text-foreground">{text('footer_contact_title')}</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {settings?.contact_email && (
                <li>
                  <a href={`mailto:${settings.contact_email}`} className="interactive-link flex items-center gap-2.5 rounded-sm text-muted-foreground hover:text-primary">
                    <Mail size={15} /> {settings.contact_email}
                  </a>
                </li>
              )}
              {settings?.bilibili_url && (
                <li>
                  <a href={settings.bilibili_url} target="_blank" rel="noreferrer" className="interactive-link flex items-center gap-2.5 rounded-sm text-muted-foreground hover:text-primary">
                    <Play size={15} /> {settings.bilibili_name || text('footer_bilibili_default')}
                  </a>
                </li>
              )}
              {settings?.qq_group && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <MessageCircle size={15} /> {text('footer_qq_prefix')}{settings.qq_group}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/80 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p className="font-mono-date">© {new Date().getFullYear()} {text('footer_copyright_name')}</p>
          <Link to={user?.role === 'admin' ? '/admin' : '/admin-login'} className="interactive-link rounded-sm hover:text-primary">{text('footer_admin')}</Link>
        </div>
      </div>
    </footer>
  );
}
