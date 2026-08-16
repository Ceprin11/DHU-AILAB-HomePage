import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { api } from '@/api/client';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { useSiteText } from '@/lib/siteText';

export default function ClubLife() {
  const text = useSiteText();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null); // {album, idx}

  const load = () => {
    setLoading(true);
    api.entities.ClubLife.list('-date', 300)
      .then((r) => { setItems(r || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Group by album
  const albums = items.reduce((acc, it) => {
    const key = it.album || text('life_default_album');
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {});
  const albumKeys = Object.keys(albums);

  const openLightbox = (album, idx) => setLightbox({ album, idx });
  const closeLightbox = () => setLightbox(null);
  const step = useCallback((dir) => {
    setLightbox((cur) => {
      if (!cur) return cur;
      const list = albums[cur.album] || [];
      const n = (cur.idx + dir + list.length) % list.length;
      return { ...cur, idx: n };
    });
  }, [albums]);

  useEffect(() => {
    if (!lightbox) return;
    const previousOverflow = document.body.style.overflow;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [lightbox, step]);

  const current = lightbox ? (albums[lightbox.album] || [])[lightbox.idx] : null;

  return (
    <div className="page-shell page-section">
      <SectionHeading eyebrow={text('life_eyebrow')} title={text('life_title')} description={text('life_description')} />

      {loading ? (
        <ContentLoading variant="grid" />
      ) : items.length === 0 ? (
        <EmptyState title={text('life_empty')} icon={Camera} />
      ) : (
        <div className="mt-12 space-y-14">
          {albumKeys.map((album) => (
            <div key={album}>
              <div className="flex items-end justify-between gap-4 border-b border-border/75 pb-4">
                <div className="flex items-center gap-2.5">
                  <Camera size={18} strokeWidth={1.8} className="text-primary" />
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{album}</h3>
                </div>
                <span className="font-mono-date text-xs text-muted-foreground">{String(albums[album].length).padStart(2, '0')} {text('life_photo_unit')}</span>
              </div>
              <div className="mt-6 columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
                {albums[album].map((it, idx) => (
                  <button
                    key={it.id}
                    onClick={() => openLightbox(album, idx)}
                    className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border border-border/75 bg-card text-left shadow-[0_10px_26px_hsl(var(--foreground)/0.03)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_32px_hsl(var(--primary)/0.08)] focus-visible:outline-offset-4 sm:mb-4"
                  >
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.title || `${album}照片`}
                        loading="lazy"
                        className="block h-auto w-full bg-secondary/35"
                      />
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-muted-foreground"><Camera size={24} /></div>
                    )}
                    {(it.title || it.date) && (
                      <div className="border-t border-border/70 px-3 py-3 sm:px-4">
                        {it.title && <p className="font-display text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-primary">{it.title}</p>}
                        {it.date && <p className="mt-1 font-mono-date text-[10px] text-muted-foreground">{formatDate(it.date)}</p>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/85 p-4 backdrop-blur-sm animate-fade-in" onClick={closeLightbox} role="dialog" aria-modal="true" aria-label={current.title || text('life_title')}>
          <button aria-label="关闭图片预览" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-background/20 bg-background/15 text-background transition-colors hover:bg-background/30" onClick={closeLightbox}>
            <X size={20} />
          </button>
          <button aria-label="上一张" className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full border border-background/20 bg-background/15 text-background transition-colors hover:bg-background/30 sm:left-5 sm:h-12 sm:w-12" onClick={(e) => { e.stopPropagation(); step(-1); }}>
            <ChevronLeft size={24} />
          </button>
          <button aria-label="下一张" className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full border border-background/20 bg-background/15 text-background transition-colors hover:bg-background/30 sm:right-5 sm:h-12 sm:w-12" onClick={(e) => { e.stopPropagation(); step(1); }}>
            <ChevronRight size={24} />
          </button>
          <div className="max-h-[85vh] max-w-4xl px-10 sm:px-12" onClick={(e) => e.stopPropagation()}>
            {current.image_url && <img src={current.image_url} alt={current.title} className="mx-auto max-h-[76vh] max-w-full rounded-xl object-contain" />}
            <div className="mt-4 text-center text-background">
              {current.title && <p className="font-display text-lg font-semibold">{current.title}</p>}
              <p className="mt-1 font-mono-date text-xs text-background/70">{formatDate(current.date)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
