import React from 'react';
import { Download, ExternalLink, FileArchive, FileCode, FileText, Github, Play } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { MotionItem } from '@/components/motion/MotionPrimitives';
import { getFileLabel, getResourceThumbnailSource } from '@/lib/resourceLinks';

const FALLBACK_ICON = { github: Github, video: Play, external: ExternalLink, file: FileText };

export default function MediaResourceCard({ href, thumbnailUrl, title, description, meta, index = 0, kind = 'external', action = 'visit', fileType = '' }) {
  const extension = getFileLabel(href, fileType);
  const FallbackIcon = /ZIP|GZ|RAR|7Z/.test(extension) ? FileArchive : /CODE|PY|JS|JSX|TS|TSX|IPYNB/.test(extension) ? FileCode : FALLBACK_ICON[kind] || FileText;
  const OverlayIcon = action === 'download' ? Download : kind === 'video' ? Play : ExternalLink;
  const actionText = action === 'download' ? '下载' : '访问';
  return (
    <MotionItem index={index}>
      <a href={href} target="_blank" rel="noreferrer" download={action === 'download' ? '' : undefined} className="group block overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_10px_26px_hsl(var(--foreground)/0.03)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_32px_hsl(var(--primary)/0.08)] focus-visible:outline-offset-4" aria-label={`${title}，${actionText}`}>
        <div className="relative aspect-video overflow-hidden border-b border-border/70 bg-accent/35">
          {thumbnailUrl ? <Image src={getResourceThumbnailSource(thumbnailUrl)} alt={`${title}封面`} fittingType="fit" className="h-full w-full object-contain" /> : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/10 via-background to-amber/10 text-primary/55"><FallbackIcon size={38} strokeWidth={1.45} /><span className="font-mono-date text-xs font-semibold tracking-[0.14em]">{kind === 'github' ? 'GITHUB' : extension}</span></div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors duration-200 group-hover:bg-foreground/10"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-background/80 bg-background/90 text-primary opacity-0 shadow-[0_8px_22px_hsl(var(--foreground)/0.12)] transition-[opacity,transform] duration-200 group-hover:scale-105 group-hover:opacity-100"><OverlayIcon size={19} strokeWidth={1.8} className={kind === 'video' ? 'ml-0.5 fill-current' : ''} /></span></div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-1.5 font-mono-date text-xs text-muted-foreground">{meta && <span>{meta}</span>}{meta && <span>·</span>}<span>{actionText}</span>{action === 'visit' ? <ExternalLink size={11} /> : <Download size={11} />}</div>
          <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-[-0.015em] text-foreground">{title}</h3>
          {description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
      </a>
    </MotionItem>
  );
}
