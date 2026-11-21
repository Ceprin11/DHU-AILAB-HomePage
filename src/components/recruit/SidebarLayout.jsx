import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Shared by every recruitment section: a left navigation column, the content, and an optional right column.
export function SidebarLayout({ sidebar, mobile = null, aside = null, children }) {
  return (
    <div className={cn('mt-8 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10', aside && 'xl:grid-cols-[16rem_minmax(0,1fr)_12rem]')}>
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
        {mobile && <div className="lg:hidden">{mobile}</div>}
        <div className="hidden lg:block">{sidebar}</div>
      </aside>
      <div className="min-w-0">{children}</div>
      {aside}
    </div>
  );
}

export function SidebarLink({ to, active, children, className }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-ml-px block border-l-2 py-1.5 pl-4 pr-2 text-sm leading-6 transition-colors',
        active ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
        className
      )}
    >
      {children}
    </Link>
  );
}
