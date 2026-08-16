import React from 'react';
import { cn } from '@/lib/utils';

export default function BrandMarks({ className }) {
  return (
    <span className={cn('flex h-9 shrink-0 items-center gap-1.5 sm:gap-2', className)} aria-hidden="true">
      <img
        src="/dhu-emblem.png"
        alt=""
        className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8"
      />
      <span className="h-6 w-px shrink-0 bg-border" />
      <img
        src="/ailab-logo.svg"
        alt=""
        className="h-5 w-auto max-w-none shrink-0 object-contain sm:h-6"
      />
    </span>
  );
}
