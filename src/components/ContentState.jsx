import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export function ContentLoading({ variant = 'list', count = 3, className = undefined }) {
  const isGrid = variant === 'grid';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('mt-10', isGrid ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'divide-y divide-border/75 border-y border-border/75', className)}
    >
      <span className="sr-only">内容加载中</span>
      {Array.from({ length: count }).map((_, index) => (
        isGrid ? (
          <div key={index} className="overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_12px_32px_hsl(var(--foreground)/0.035)]">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ) : (
          <div key={index} className="flex items-center gap-4 py-5">
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full max-w-xl" />
            </div>
          </div>
        )
      ))}
    </div>
  );
}

export function EmptyState({ title, description = null, icon: Icon = Inbox, className = undefined, compact = false }) {
  return (
    <div className={cn('mt-10 border-y border-border/75 bg-secondary/25 px-5 text-center', compact ? 'py-9' : 'py-14', className)}>
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-primary/10 bg-amber/20 text-primary">
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
  );
}
