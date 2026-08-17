import React from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { getBilibiliThumbnailSource } from '@/lib/bilibili';
import { MotionItem } from '@/components/motion/MotionPrimitives';

export default function BilibiliVideoCard({ href, thumbnailUrl, title, description, meta, index = 0 }) {
  return (
    <MotionItem index={index}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="group block overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_10px_26px_hsl(var(--foreground)/0.03)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_32px_hsl(var(--primary)/0.08)] focus-visible:outline-offset-4"
        aria-label={`${title}，前往 B 站观看`}
      >
        <div className="relative aspect-video overflow-hidden border-b border-border/70 bg-accent/35">
          {thumbnailUrl ? (
            <Image
              src={getBilibiliThumbnailSource(thumbnailUrl)}
              alt={`${title}封面`}
              fittingType="fit"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-amber/10">
              <Play size={36} className="text-primary/50" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors duration-200 group-hover:bg-foreground/10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-background/80 bg-background/90 text-primary shadow-[0_8px_22px_hsl(var(--foreground)/0.12)] transition-transform duration-200 group-hover:scale-105">
              <Play size={19} strokeWidth={1.8} className="ml-0.5 fill-current" />
            </span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-1.5">
            {meta && <span className="font-mono-date text-xs text-muted-foreground">{meta}</span>}
            <ExternalLink size={11} className="text-muted-foreground" />
          </div>
          <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-[-0.015em] text-foreground">{title}</h3>
          {description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
      </a>
    </MotionItem>
  );
}
