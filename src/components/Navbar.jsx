import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useSiteText } from '@/lib/siteText';

const LOGO_URL = '/ailab-logo.png';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const text = useSiteText();
  const reduceMotion = useReducedMotion();
  const nav = [
    { to: '/', label: text('nav_home'), end: true }, { to: '/members', label: text('nav_team') },
    { to: '/ai-guide', label: text('nav_guide') }, { to: '/notifications', label: text('nav_notice') },
    { to: '/awards', label: text('nav_awards') }, { to: '/activities', label: text('nav_activities') },
    { to: '/club-life', label: text('nav_club_life') }, { to: '/videos', label: text('nav_videos') },
    { to: '/resources', label: text('nav_resources') }, { to: '/qa', label: text('nav_qa') },
  ];

  const linkClass = ({ isActive }) =>
    cn(
      'relative px-1 py-5 text-sm font-medium transition-colors duration-200',
      isActive
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="sticky top-0 z-50 border-b border-border/75 glass">
      <div className="page-shell flex h-16 items-center justify-between">
        <Link to="/" className="group flex min-w-0 items-center gap-2.5 rounded-sm" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-md">
            <img src={LOGO_URL} alt="AILab" className="h-full w-auto max-w-none scale-[2.35] object-contain" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xs font-bold tracking-tight text-foreground sm:text-sm">{text('lab_name_cn')}</span>
            <span className="font-mono-date text-[9px] text-muted-foreground sm:text-[10px]">{text('lab_name_en')}</span>
          </span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-5 xl:flex">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && <m.span layoutId="desktop-nav-indicator" className="absolute inset-x-1 bottom-3 h-0.5 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <NavLink to={user?.role === 'admin' ? '/admin' : '/admin-login'} className={({ isActive }) =>
            cn('interactive-link rounded-sm text-sm font-medium', isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {text('nav_admin')}
          </NavLink>
          <Link
            to="/join"
            className="inline-flex h-9 items-center rounded-full bg-amber px-5 text-sm font-semibold text-amber-foreground shadow-[0_8px_22px_hsl(var(--amber)/0.16)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-amber/80 hover:shadow-[0_11px_26px_hsl(var(--primary)/0.14)] active:translate-y-px"
          >
            {text('nav_join')}
          </Link>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors duration-200 hover:bg-accent active:bg-accent/80 xl:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="菜单"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
        <m.div
          id="mobile-navigation"
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="border-t border-border/75 bg-background/98 shadow-[0_16px_28px_hsl(var(--foreground)/0.06)] xl:hidden"
        >
          <nav aria-label="移动端导航" className="page-shell grid grid-cols-2 gap-1 py-4 sm:grid-cols-3">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn('rounded-lg px-3 py-2.5 text-sm transition-colors', isActive ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')
                }
              >
                {n.label}
              </NavLink>
            ))}
            <NavLink to={user?.role === 'admin' ? '/admin' : '/admin-login'} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              {text('footer_admin')}
            </NavLink>
            <Link
              to="/join"
              onClick={() => setOpen(false)}
              className="col-span-2 mt-2 inline-flex h-10 items-center justify-center rounded-full bg-amber px-5 text-sm font-semibold text-amber-foreground transition-colors hover:bg-amber/80 sm:col-span-3"
            >
              {text('nav_join')}
            </Link>
          </nav>
        </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
