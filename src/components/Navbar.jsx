import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const LOGO_URL = '/ailab-logo.png';

const NAV = [
  { to: '/', label: '首页', end: true },
  { to: '/members', label: '团队' },
  { to: '/notifications', label: '通知' },
  { to: '/awards', label: '成果' },
  { to: '/activities', label: '活动' },
  { to: '/club-life', label: '社团生活' },
  { to: '/videos', label: '视频' },
  { to: '/resources', label: '资料' },
  { to: '/qa', label: '问答' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  const linkClass = ({ isActive }) =>
    cn(
      'relative px-1 py-1 text-sm font-medium transition-colors',
      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-md">
            <img src={LOGO_URL} alt="AILab" className="h-full w-auto max-w-none scale-[2.35] object-contain" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xs font-bold tracking-tight text-foreground sm:text-sm">东华大学人工智能创新实验室</span>
            <span className="font-mono-date text-[9px] text-muted-foreground sm:text-[10px]">AI Innovation Laboratory · AILAB</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 xl:gap-6 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <NavLink to={user?.role === 'admin' ? '/admin' : '/admin-login'} className={({ isActive }) =>
            cn('text-sm font-medium', isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            管理
          </NavLink>
          <Link
            to="/join"
            className="inline-flex h-9 items-center rounded-full bg-amber px-5 text-sm font-semibold text-amber-foreground shadow-sm transition-transform hover:scale-[1.02]"
          >
            加入我们
          </Link>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-md text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="菜单"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background lg:hidden">
          <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 px-5 py-3 sm:px-8 sm:grid-cols-3">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn('border-l-2 py-2.5 pl-3 text-sm', isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground')
                }
              >
                {n.label}
              </NavLink>
            ))}
            <NavLink to={user?.role === 'admin' ? '/admin' : '/admin-login'} onClick={() => setOpen(false)} className="border-l-2 border-transparent py-2.5 pl-3 text-sm text-muted-foreground">
              管理后台
            </NavLink>
            <Link
              to="/join"
              onClick={() => setOpen(false)}
              className="col-span-2 mt-2 inline-flex h-10 items-center justify-center rounded-full bg-amber px-5 text-sm font-semibold text-amber-foreground sm:col-span-3"
            >
              加入我们
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
