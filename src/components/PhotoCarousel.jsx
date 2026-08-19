import React from 'react';
import { useReducedMotion } from 'framer-motion';
import { A11y, Autoplay, EffectCoverflow, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

export default function PhotoCarousel({ photos = [], interval = 4800, className }) {
  const reduceMotion = useReducedMotion();

  if (!photos.length) return null;

  return (
    <div className={cn('relative flex aspect-[4/5] w-full select-none items-center justify-center overflow-hidden bg-transparent', className)}>
      <Swiper
        modules={[A11y, Autoplay, EffectCoverflow, Pagination]}
        className="!-translate-y-2 !h-full !w-full !overflow-visible sm:!-translate-y-4 [&_.swiper-wrapper]:items-center [&_.swiper-pagination]:bottom-2 [&_.swiper-pagination-bullet]:h-1.5 [&_.swiper-pagination-bullet]:w-1.5 [&_.swiper-pagination-bullet]:bg-muted-foreground [&_.swiper-pagination-bullet]:opacity-35 [&_.swiper-pagination-bullet-active]:w-6 [&_.swiper-pagination-bullet-active]:rounded-full [&_.swiper-pagination-bullet-active]:bg-amber-foreground [&_.swiper-pagination-bullet-active]:opacity-100 [&_.swiper-pagination-bullet-active]:transition-[width]"
        style={{ '--swiper-wrapper-transition-timing-function': 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        effect="coverflow"
        centeredSlides
        slidesPerView="auto"
        loop={photos.length > 2}
        rewind={photos.length === 2}
        speed={reduceMotion ? 0 : 820}
        grabCursor={!reduceMotion}
        slideToClickedSlide
        pagination={photos.length > 1 ? { clickable: true } : false}
        autoplay={photos.length > 1 && !reduceMotion ? { delay: interval, disableOnInteraction: false, pauseOnMouseEnter: false, stopOnLastSlide: false } : false}
        coverflowEffect={{
          rotate: reduceMotion ? 0 : 30,
          stretch: 10,
          depth: reduceMotion ? 0 : 135,
          modifier: 1.05,
          scale: 0.965,
          slideShadows: false,
        }}
      >
        {photos.map((photo, index) => {
          const source = typeof photo === 'string' ? photo : photo.url;
          const alt = typeof photo === 'string' ? '实验室风采照片' : photo.alt;
          const key = typeof photo === 'string' ? photo : photo.id || photo.url;
          return (
          <SwiperSlide key={`${key}-${index}`} className="!h-auto !w-[86%] sm:!w-[77%]">
            <div className="photo-soft-edge aspect-[16/10] overflow-hidden rounded-2xl border border-border/80 bg-background shadow-[0_30px_75px_hsl(var(--foreground)/0.15)]">
              <Image
                src={source}
                alt={alt || '实验室风采照片'}
                fittingType="fit"
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                className="h-full w-full object-contain"
              />
            </div>
          </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
