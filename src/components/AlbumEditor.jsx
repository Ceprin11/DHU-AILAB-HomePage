import React, { useEffect, useState } from 'react';
import { Home, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { api } from '@/api/client';
import { getAlbumPhotos } from '@/lib/albumPhotos';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const emptyAlbum = { title: '', date: '', category: 'activity', location: '', description: '', images: [] };
const toDateTimeInputValue = (value) => String(value || '').slice(0, 16);

export default function AlbumEditor({ album, onSaved, onCancel, canSelectHome = false }) {
  const [values, setValues] = useState(emptyAlbum);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setValues(album ? {
      title: album.title || '',
      date: toDateTimeInputValue(album.date),
      category: album.category || 'activity',
      location: album.location || '',
      description: album.description || '',
      images: getAlbumPhotos(album),
    } : emptyAlbum);
    setError('');
  }, [album]);

  const setField = (field, value) => setValues((current) => ({ ...current, [field]: value }));

  const uploadPhotos = async (fileList) => {
    const files = Array.from(fileList || []).slice(0, 20 - values.images.length);
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await api.albums.uploadPhotos(files);
      setValues((current) => ({
        ...current,
        images: [...current.images, ...uploaded.map((item) => ({
          id: crypto.randomUUID(),
          url: item.file_url,
          is_home_featured: false,
        }))],
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '照片上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const toggleFeatured = (photoId) => setValues((current) => ({
    ...current,
    images: current.images.map((image) => image.id === photoId
      ? { ...image, is_home_featured: !image.is_home_featured }
      : image),
  }));

  const removePhoto = (photoId) => setValues((current) => ({
    ...current,
    images: current.images.filter((image) => image.id !== photoId),
  }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!values.title.trim() || !values.date || !values.description.trim() || values.images.length === 0) {
      setError('请完整填写标题、时间和描述，并至少上传一张照片');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...values, title: values.title.trim(), location: values.location.trim(), description: values.description.trim() };
      const saved = album?.id ? await api.albums.update(album.id, payload) : await api.albums.create(payload);
      onSaved(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '相册保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const featuredCount = values.images.filter((image) => image.is_home_featured).length;

  return (
    <form onSubmit={submit} className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-[0_16px_40px_hsl(var(--foreground)/0.05)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono-date text-xs uppercase tracking-[0.16em] text-primary">Album editor</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">{album ? '编辑相册' : '创建新相册'}</h2>
        </div>
        <button type="button" onClick={onCancel} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="关闭相册编辑器"><X size={18} /></button>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="album-title">相册标题 *</Label>
          <Input id="album-title" value={values.title} onChange={(event) => setField('title', event.target.value)} maxLength={200} className="mt-1.5" placeholder="如：2026 春季技术沙龙" />
        </div>
        <div>
          <Label htmlFor="album-date">活动 / 拍摄时间 *</Label>
          <DatePicker id="album-date" value={values.date} onChange={(value) => setField('date', value)} includeTime placeholder="选择活动日期与时间" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="album-category">相册分类 *</Label>
          <select id="album-category" value={values.category} onChange={(event) => setField('category', event.target.value)} className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="activity">活动</option><option value="club_life">社团生活</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="album-location">地点</Label>
          <Input id="album-location" value={values.location} onChange={(event) => setField('location', event.target.value)} maxLength={200} className="mt-1.5" placeholder="可选" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="album-description">相册描述 *</Label>
          <Textarea id="album-description" value={values.description} onChange={(event) => setField('description', event.target.value)} maxLength={10000} rows={5} className="mt-1.5" placeholder="记录这次活动或社团生活的内容与精彩瞬间" />
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">照片</h3>
            <p className="mt-1 text-xs text-muted-foreground">最多 20 张。{canSelectHome ? `点击“主页”可加入主页轮播，当前精选 ${featuredCount} 张。` : '主页展示照片由管理员统一选择。'}</p>
          </div>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}{uploading ? '正在上传…' : '添加照片'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple className="hidden" disabled={uploading || values.images.length >= 20} onChange={(event) => { uploadPhotos(event.target.files); event.target.value = ''; }} />
          </label>
        </div>

        {values.images.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {values.images.map((photo) => (
              <div key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-secondary/40">
                <Image src={photo.url} fittingType="cover" className="h-full w-full object-cover" />
                <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
                  {canSelectHome && <button type="button" onClick={() => toggleFeatured(photo.id)} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow ${photo.is_home_featured ? 'bg-amber text-amber-foreground' : 'bg-background/90 text-foreground'}`} aria-pressed={photo.is_home_featured}><Home size={13} /> 主页</button>}
                  <button type="button" onClick={() => removePhoto(photo.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-destructive shadow" aria-label="移除照片"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="submit" disabled={saving || uploading}>{saving && <Loader2 size={16} className="animate-spin" />}{album ? '保存修改' : '发布相册'}</Button>
      </div>
    </form>
  );
}
