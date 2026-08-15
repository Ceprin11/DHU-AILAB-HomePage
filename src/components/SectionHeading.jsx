import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionHeading({ eyebrow, title, description, align = 'left', className }) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && (
        <div className={cn('flex items-center gap-2', align === 'center' && 'justify-center')}>
          <span className="h-px w-6 bg-primary" />
          <span className="font-mono-date text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</span>
        </div>
      )}
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-balance">{description}</p>
      )}
    </div>
  );
}