import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

export default function PhotoCarousel({ photos = [], interval = 4500, className }) {
  const [idx, setIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  const next = useCallback(() => setIdx((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(next, interval);
    return () => clearInterval(t);
  }, [photos.length, interval, next]);

  if (!photos.length) return null;

  return (
    <div className={cn('relative aspect-[4/5] w-full select-none bg-background', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          key={`${idx}-${photos[idx]}`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.7 }}
          className="photo-soft-edge absolute inset-0 overflow-hidden rounded-2xl"
        >
          <Image
            src={photos[idx]}
            fittingType="fit"
            loading={idx === 0 ? 'eager' : 'lazy'}
            fetchPriority={idx === 0 ? 'high' : 'auto'}
            className="h-full w-full object-contain"
          />
        </m.div>
      </AnimatePresence>
      {photos.length > 1 && (
        <div className="absolute bottom-5 left-5 flex gap-1.5 rounded-full border border-background/30 bg-foreground/25 px-2.5 py-2 backdrop-blur-sm">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`第 ${i + 1} 张`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === idx ? 'w-6 bg-white/90' : 'w-1.5 bg-white/45 hover:bg-white/70'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
