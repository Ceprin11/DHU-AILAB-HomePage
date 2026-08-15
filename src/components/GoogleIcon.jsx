import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Play } from 'lucide-react';
import { useSiteSettings } from '@/lib/site';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';

const LOGO_URL = 'https://media.base44.com/images/public/6a802abc08cc560d7cecf5bf/2481cf7c2_image.png';

export default function Footer() {
  const settings = useSiteSettings();
  const { user } = useAuth();
  const [stats, setStats] = useState({ members: 0, awards: 0, activities: 0 });

  useEffect(() => {
    Promise.all([
      base44.entities.Member.list().then((r) => r.length).catch(() => 0),
      base44.entities.Award.list().then((r) => r.length).catch(() => 0),
      base44.entities.Activity.list().then((r) => r.length).catch(() => 0),
    ]).then(([m, a, act]) => setStats({ members: m, awards: a, activities: act }));
  }, []);

  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-[84px] items-center overflow-hidden rounded-md bg-black">
                <Image src={LOGO_URL} fittingType="fit" className="h-full w-full" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-sm font-bold tracking-tight">东华大学人工智能创新实验室</span>
                <span className="font-mono-date text-[10px] text-muted-foreground">AI Innovation Laboratory</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              人工智能创新实验室 — 探索智能前沿，编织学术未来。
            </p>
            <div className="mt-5 flex flex-wrap gap-2 font-mono-date text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-background px-2.5 py-1">成员 / {String(stats.members).padStart(2, '0')}</span>
              <span className="rounded-md border border-border bg-background px-2.5 py-1">成果 / {String(stats.awards).padStart(2, '0')}</span>
              <span className="rounded-md border border-border bg-background px-2.5 py-1">活动 / {String(stats.activities).padStart(2, '0')}</span>
            </div>
          </div>

          <div className="md:col-span-3">
            <h4 className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">导航</h4>
            <ul className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <li><Link to="/members" className="text-foreground/80 hover:text-primary">团队</Link></li>
              <li><Link to="/notifications" className="text-foreground/80 hover:text-primary">通知公告</Link></li>
              <li><Link to="/awards" className="text-foreground/80 hover:text-primary">成果展示</Link></li>
              <li><Link to="/activities" className="text-foreground/80 hover:text-primary">社团活动</Link></li>
              <li><Link to="/club-life" className="text-foreground/80 hover:text-primary">社团生活</Link></li>
              <li><Link to="/videos" className="text-foreground/80 hover:text-primary">B站视频</Link></li>
              <li><Link to="/resources" className="text-foreground/80 hover:text-primary">学习资料</Link></li>
              <li><Link to="/qa" className="text-foreground/80 hover:text-primary">Q&A</Link></li>
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="font-mono-date text-xs uppercase tracking-widest text-muted-foreground">联系方式</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {settings?.contact_email && (
                <li>
                  <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2.5 text-foreground/80 hover:text-primary">
                    <Mail size={15} className="text-muted-foreground" /> {settings.contact_email}
                  </a>
                </li>
              )}
              {settings?.bilibili_url && (
                <li>
                  <a href={settings.bilibili_url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-foreground/80 hover:text-primary">
                    <Play size={15} className="text-muted-foreground" /> {settings.bilibili_name || 'B站主页'}
                  </a>
                </li>
              )}
              {settings?.qq_group && (
                <li className="flex items-center gap-2.5 text-foreground/80">
                  <MessageCircle size={15} className="text-muted-foreground" /> QQ群：{settings.qq_group}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p className="font-mono-date">© {new Date().getFullYear()} 东华大学人工智能创新实验室 AILAB</p>
          {user?.role === 'admin' && <Link to="/admin" className="hover:text-primary">管理后台</Link>}
        </div>
      </div>
    </footer>
  );
}