import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import SectionHeading from '@/components/SectionHeading';
import { formatDate } from '@/lib/site';

export default function ClubLife() {
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
    const key = it.album || '日常活动';
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
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, step]);

  const current = lightbox ? (albums[lightbox.album] || [])[lightbox.idx] : null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <SectionHeading eyebrow="Club Life" title="社团生活" description="踏青、团建、日常点滴——记录实验室成员在一起的每个瞬间。" />

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">暂无照片，管理员可在后台上传</p>
      ) : (
        <div className="mt-12 space-y-12">
          {albumKeys.map((album) => (
            <div key={album}>
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-primary" />
                <h3 className="font-display text-xl font-semibold text-foreground">{album}</h3>
                <span className="font-mono-date text-xs text-muted-foreground">{albums[album].length} 张</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {albums[album].map((it, idx) => (
                  <button
                    key={it.id}
                    onClick={() => openLightbox(album, idx)}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-accent/30 transition-all hover:border-primary/40 hover:shadow-md"
                  >
                    {it.image_url ? (
                      <Image src={it.image_url} fittingType="fill" className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground"><Camera size={24} /></div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4" onClick={closeLightbox}>
          <button className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/20 text-background hover:bg-background/40" onClick={closeLightbox}>
            <X size={20} />
          </button>
          <button className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-background/20 text-background hover:bg-background/40" onClick={(e) => { e.stopPropagation(); step(-1); }}>
            <ChevronLeft size={24} />
          </button>
          <button className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-background/20 text-background hover:bg-background/40" onClick={(e) => { e.stopPropagation(); step(1); }}>
            <ChevronRight size={24} />
          </button>
          <div className="max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {current.image_url && <img src={current.image_url} alt={current.title} className="max-h-[78vh] w-auto rounded-lg object-contain" />}
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
