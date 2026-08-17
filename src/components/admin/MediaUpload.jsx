import React, { useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { Image } from '@/components/ui/image';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const VIDEO_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i;

export default function MediaUpload({ value, onChange, onUploaded, type = 'image', label }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await api.upload(file);
      onChange(res.file_url);
      onUploaded?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const isVideo = type === 'video' || (type === 'file' && VIDEO_RE.test(value || ''));

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>}

      {type === 'image' && (
        <div className="flex items-start gap-3">
          {value ? (
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40">
              <Image src={value} fittingType="fit" className="h-full w-full object-contain" />
              <button type="button" onClick={() => onChange('')} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground shadow hover:bg-background">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            </div>
          )}
          <label className={cn('flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent', uploading && 'pointer-events-none opacity-60')}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {value ? '更换图片' : '上传图片'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
        </div>
      )}

      {isVideo && (
        <div className="space-y-3">
          {value && (
            <div className="relative overflow-hidden rounded-lg border border-border">
              <video src={value} controls className="max-h-64 w-full bg-black" />
              <button type="button" onClick={() => onChange('')} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground shadow hover:bg-background">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className={cn('flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent', uploading && 'pointer-events-none opacity-60')}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              上传视频
              <input type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            <span className="text-xs text-muted-foreground">或粘贴链接</span>
            <Input
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://...mp4"
              className="h-9 max-w-xs"
            />
          </div>
        </div>
      )}

      {type === 'file' && !isVideo && (
        <div className="space-y-3">
          {value && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <FileText size={16} className="text-primary" />
              <a href={value} target="_blank" rel="noreferrer" className="max-w-[260px] truncate text-sm text-primary hover:underline">{value}</a>
              <button type="button" onClick={() => onChange('')} className="ml-auto text-destructive hover:underline text-xs">移除</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className={cn('flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent', uploading && 'pointer-events-none opacity-60')}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              上传文件
              <input type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            <span className="text-xs text-muted-foreground">或粘贴链接</span>
            <Input
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://..."
              className="h-9 max-w-xs"
            />
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
