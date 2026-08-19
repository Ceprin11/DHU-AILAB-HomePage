import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronRight, CircleHelp, Images, LogOut, Menu, Settings, Trophy, UserRound, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { useSiteText } from '@/lib/siteText';
import BrandMarks from '@/components/BrandMarks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function AccountMenuLink({ to, icon: Icon, title, description, onClick }) {
  return (
    <DropdownMenuItem asChild className="h-auto cursor-pointer rounded-xl p-0 focus:bg-accent/70">
      <Link to={to} onClick={onClick} className="group flex w-full items-center gap-3 px-2.5 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><Icon size={16} strokeWidth={1.8} /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span></span>
        <ChevronRight size={15} className="text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </DropdownMenuItem>
  );
}

function MobileAccountLink({ to, icon: Icon, title, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary"><Icon size={15} /></span>
      <span className="flex-1 font-medium">{title}</span><ChevronRight size={14} />
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const text = useSiteText();
  const reduceMotion = useReducedMotion();
  const accountLink = user?.role === 'admin' ? '/admin' : user?.role === 'member' ? '/member-center' : '/admin-login';
  const accountLabel = user?.role === 'admin' ? '管理后台' : user?.role === 'member' ? '个人中心' : '登录';
  const userInitial = user?.full_name?.trim()?.slice(0, 1) || 'A';
  const userHeadline = user?.headline || (user?.role === 'admin' ? '管理员' : '实验室成员');
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
          <BrandMarks />
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
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex w-48 min-w-0 items-center gap-2.5 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-secondary" aria-label="打开账号菜单">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber text-sm font-bold text-amber-foreground">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : userInitial}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold text-foreground">{user.full_name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{userHeadline}</span>
                  </span>
                  <ChevronDown size={14} className="ml-0.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-popover/80 p-2 text-popover-foreground shadow-[0_24px_70px_hsl(var(--foreground)/0.22)] backdrop-blur-xl">
                <DropdownMenuLabel className="relative overflow-hidden rounded-xl border border-border bg-secondary/80 p-3.5">
                  <span className="absolute -right-7 -top-8 h-20 w-20 rounded-full bg-amber/20 blur-2xl" />
                  <span className="relative flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber text-base font-bold text-amber-foreground shadow-sm">{user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : userInitial}</span>
                    <span className="min-w-0"><span className="block truncate font-display text-base font-bold text-foreground">{user.full_name}</span><span className="mt-1 block truncate font-mono-date text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">{userHeadline}</span></span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuLabel className="px-2.5 pb-1 pt-3 font-mono-date text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">账号</DropdownMenuLabel>
                <AccountMenuLink to={accountLink} icon={user.role === 'admin' ? Settings : UserRound} title={accountLabel} description={user.role === 'admin' ? '管理网站内容与账号' : '维护个人资料与头像'} />
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuLabel className="px-2.5 pb-1 pt-1 font-mono-date text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">内容管理</DropdownMenuLabel>
                <AccountMenuLink to="/gallery" icon={Images} title="相册管理" description={user.role === 'admin' ? '管理相册并选择主页照片' : '上传和整理公共相册'} />
                <AccountMenuLink to="/contribute/material" icon={BookOpen} title="学习资料上传" description="分享教程、论文和学习资源" />
                <AccountMenuLink to="/contribute/qa" icon={CircleHelp} title="问答补充" description="补充常见问题与参考答案" />
                <AccountMenuLink to="/contribute/award" icon={Trophy} title="成果上传" description="记录竞赛与科研成果" />
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem onSelect={() => logout()} className="h-10 cursor-pointer rounded-xl px-3 text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut /> <span className="font-medium">退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <NavLink to="/admin-login" className={({ isActive }) => cn('interactive-link rounded-sm text-sm font-medium', isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>登录</NavLink>
              <Link to="/join" className="inline-flex h-9 items-center rounded-full bg-amber px-5 text-sm font-semibold text-amber-foreground shadow-[0_8px_22px_hsl(var(--amber)/0.16)] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-amber/80 hover:shadow-[0_11px_26px_hsl(var(--primary)/0.14)] active:translate-y-px">{text('nav_join')}</Link>
            </>
          )}
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
            {user ? (
              <div className="col-span-2 mt-2 overflow-hidden rounded-2xl border border-border/80 bg-background p-2 shadow-[0_16px_38px_hsl(var(--foreground)/0.08)] sm:col-span-3">
                <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-secondary/80 p-3 backdrop-blur-xl">
                  <span className="absolute -right-5 -top-7 h-20 w-20 rounded-full bg-amber/20 blur-2xl" />
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber text-base font-bold text-amber-foreground shadow-sm">{user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : userInitial}</span>
                  <span className="relative min-w-0"><span className="block truncate font-display text-base font-bold text-foreground">{user.full_name}</span><span className="mt-0.5 block truncate font-mono-date text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{userHeadline}</span></span>
                </div>
                <div className="px-1 pb-1 pt-2">
                  <p className="px-2 pb-1 font-mono-date text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">账号</p>
                  <MobileAccountLink to={accountLink} icon={user.role === 'admin' ? Settings : UserRound} title={accountLabel} onClick={() => setOpen(false)} />
                  <div className="my-2 h-px bg-border" />
                  <p className="px-2 pb-1 font-mono-date text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">内容管理</p>
                  <MobileAccountLink to="/gallery" icon={Images} title="相册管理" onClick={() => setOpen(false)} />
                  <MobileAccountLink to="/contribute/material" icon={BookOpen} title="学习资料上传" onClick={() => setOpen(false)} />
                  <MobileAccountLink to="/contribute/qa" icon={CircleHelp} title="问答补充" onClick={() => setOpen(false)} />
                  <MobileAccountLink to="/contribute/award" icon={Trophy} title="成果上传" onClick={() => setOpen(false)} />
                  <div className="my-2 h-px bg-border" />
                  <button type="button" onClick={() => { setOpen(false); logout(); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10"><LogOut size={15} /></span>
                    <span className="flex-1 text-left font-medium">退出登录</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <NavLink to="/admin-login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">登录</NavLink>
                <Link to="/join" onClick={() => setOpen(false)} className="col-span-2 mt-2 inline-flex h-10 items-center justify-center rounded-full bg-amber px-5 text-sm font-semibold text-amber-foreground transition-colors hover:bg-amber/80 sm:col-span-3">{text('nav_join')}</Link>
              </>
            )}
          </nav>
        </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
