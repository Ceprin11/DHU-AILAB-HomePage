import React, { useState, useEffect, useCallback } from 'react';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

export default function PhotoCarousel({ photos = [], interval = 4500, className }) {
  const [idx, setIdx] = useState(0);

  const next = useCallback(() => setIdx((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(next, interval);
    return () => clearInterval(t);
  }, [photos.length, interval, next]);

  if (!photos.length) return null;

  return (
    <div className={cn('relative aspect-[4/5] w-full select-none bg-background', className)}>
      {photos.map((src, i) => (
        <div
          key={i}
          className={cn(
            'photo-soft-edge absolute inset-0 overflow-hidden rounded-2xl transition-opacity duration-1000 ease-in-out motion-reduce:transition-none',
            i === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <Image src={src} fittingType="fit" className="h-full w-full object-contain" />
        </div>
      ))}
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
