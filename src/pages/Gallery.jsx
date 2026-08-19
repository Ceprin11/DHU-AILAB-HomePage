import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Home, Loader2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '@/api/client';
import AlbumEditor from '@/components/AlbumEditor';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import SectionHeading from '@/components/SectionHeading';
import { useAuth } from '@/lib/AuthContext';
import { getAlbumPhotos } from '@/lib/albumPhotos';
import { formatDateTime } from '@/lib/site';

const categories = { all: '全部', activity: '活动', club_life: '社团生活' };
const sortAlbums = (albums) => [...albums].sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));

export default function Gallery() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [togglingPhoto, setTogglingPhoto] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.entities.Album.list('-date', 200)
      .then((rows) => setAlbums(rows || []))
      .catch(() => setError('相册加载失败，请稍后重试'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (user) load(); }, [load, user]);

  const visibleAlbums = useMemo(() => category === 'all' ? albums : albums.filter((album) => album.category === category), [albums, category]);
  const canCreate = Boolean(user && !(user.role === 'member' && user.must_change_password));
  const canSelectHome = user?.role === 'admin';
  const canEdit = Boolean(user && !(user.role === 'member' && user.must_change_password));
  const canDelete = (album) => user?.role === 'admin' || (user?.role === 'member' && album.created_by_user_id === user.id);

  const openNew = () => { setEditing(null); setEditorOpen(true); setError(''); };
  const openEdit = (album) => {
    setEditing(album); setEditorOpen(true); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const onSaved = (album) => {
    setAlbums((current) => sortAlbums(current.some((item) => item.id === album.id) ? current.map((item) => item.id === album.id ? album : item) : [album, ...current]));
    setEditorOpen(false); setEditing(null);
  };
  const removeAlbum = async (album) => {
    if (!window.confirm(`确定删除相册“${album.title}”吗？`)) return;
    try {
      await api.albums.delete(album.id);
      setAlbums((current) => current.filter((item) => item.id !== album.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败，请重试');
    }
  };
  const toggleHomeFeatured = async (album, photo) => {
    const key = `${album.id}:${photo.id}`;
    const nextValue = !photo.is_home_featured;
    setTogglingPhoto(key); setError('');
    const updatePhoto = (value) => setAlbums((current) => current.map((item) => item.id === album.id ? {
      ...item,
      images: item.images.map((image) => image.id === photo.id ? { ...image, is_home_featured: value } : image),
    } : item));
    updatePhoto(nextValue);
    try {
      await api.albums.setHomeFeatured(album.id, photo.id, nextValue);
    } catch (toggleError) {
      updatePhoto(!nextValue);
      setError(toggleError instanceof Error ? toggleError.message : '主页精选更新失败');
    } finally {
      setTogglingPhoto('');
    }
  };

  if (!user) return <Navigate to="/admin-login" state={{ from: '/gallery' }} replace />;

  return (
    <div className="page-shell page-section max-w-7xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading eyebrow="AILAB Gallery" title="实验室相册" description="集中记录实验室活动、团队相聚与社团生活中的精彩瞬间。" />
        {canCreate && <Button onClick={openNew} className="self-start lg:mb-1"><Plus size={16} /> 创建相册</Button>}
      </div>

      {user?.role === 'member' && user.must_change_password && <div className="mt-8 flex flex-col gap-3 rounded-xl border border-amber/40 bg-amber/10 px-5 py-4 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"><p>请先修改初始密码，之后即可上传相册和选择主页照片。</p><Button asChild size="sm"><Link to="/member-password">修改密码</Link></Button></div>}
      {editorOpen && <AlbumEditor album={editing} canSelectHome={canSelectHome} onSaved={onSaved} onCancel={() => { setEditorOpen(false); setEditing(null); }} />}

      <div className="mt-10 flex flex-wrap gap-2 border-b border-border pb-4" aria-label="相册分类">
        {Object.entries(categories).map(([value, label]) => <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${category === value ? 'bg-amber text-amber-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`} aria-pressed={category === value}>{label}</button>)}
      </div>
      {error && <p role="alert" className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {loading ? <div className="mt-10"><ContentLoading variant="grid" /></div> : visibleAlbums.length === 0 ? <div className="mt-10"><EmptyState title="暂无相册" icon={Camera} /></div> : (
        <div className="mt-8 space-y-10">
          {visibleAlbums.map((album) => {
            const photos = getAlbumPhotos(album);
            return (
              <article key={album.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_hsl(var(--foreground)/0.045)]">
                <header className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-amber/15 px-2.5 py-1 font-semibold text-amber-foreground">{categories[album.category] || '相册'}</span><span className="font-mono-date">{formatDateTime(album.date)}</span>{album.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {album.location}</span>}</div>
                    <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground">{album.title}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{album.description}</p>
                    {album.created_by_name && <p className="mt-3 text-xs text-muted-foreground">由 {album.created_by_name} 上传 · {photos.length} 张</p>}
                  </div>
                  {canEdit && <div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => openEdit(album)}><Pencil size={14} /> 编辑</Button>{canDelete(album) && <Button type="button" variant="ghost" size="sm" onClick={() => removeAlbum(album)} className="text-destructive hover:text-destructive"><Trash2 size={14} /> 删除</Button>}</div>}
                </header>
                <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((photo) => {
                    const photoKey = `${album.id}:${photo.id}`;
                    return <div key={photo.id} className="group relative aspect-[4/3] overflow-hidden bg-secondary/40"><Image src={photo.url} alt={`${album.title}照片`} fittingType="cover" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />{canSelectHome && <button type="button" onClick={() => toggleHomeFeatured(album, photo)} disabled={Boolean(togglingPhoto)} className={`absolute bottom-3 right-3 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-lg backdrop-blur transition-colors ${photo.is_home_featured ? 'bg-amber text-amber-foreground' : 'bg-background/90 text-foreground hover:bg-background'}`} aria-pressed={photo.is_home_featured} aria-label={photo.is_home_featured ? '从主页轮播移除' : '设为主页轮播照片'}>{togglingPhoto === photoKey ? <Loader2 size={14} className="animate-spin" /> : <Home size={14} />}{photo.is_home_featured ? '主页展示中' : '选到主页'}</button>}</div>;
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
