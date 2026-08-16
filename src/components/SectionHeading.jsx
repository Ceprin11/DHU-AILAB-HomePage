import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionHeading({ eyebrow, title, description, align = 'left', className = undefined }) {
  return (
    <div className={cn('max-w-[44rem]', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && (
        <div className={cn('flex items-center gap-3 text-primary', align === 'center' && 'justify-center')}>
          <span className="h-px w-5 bg-primary/55" aria-hidden="true" />
          <span className="font-mono-date text-[10px] font-medium uppercase tracking-[0.18em] sm:text-[11px]">{eyebrow}</span>
        </div>
      )}
      <h2 className={cn('font-display text-[2rem] font-bold leading-[1.16] tracking-[-0.03em] text-foreground sm:text-[2.5rem] text-balance', eyebrow && 'mt-3.5')}>
        {title}
      </h2>
      {description && (
        <p className={cn('mt-4 max-w-[65ch] text-base leading-7 text-muted-foreground sm:leading-8', align === 'center' && 'mx-auto')}>{description}</p>
      )}
    </div>
  );
}
