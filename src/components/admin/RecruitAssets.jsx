import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, FileText, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatFileSize } from '@/lib/recruit';
import { resolveDocsAssetUrl } from '@/components/docs/MarkdownContent';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);
const ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.avif,.pdf,.mp4,.webm,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.csv,.ipynb,.py';

export const assetSnippet = (asset) => {
  const label = asset.name.slice(0, asset.name.length - asset.extension.length);
  return IMAGE_EXTENSIONS.has(asset.extension) ? `![${label}](${asset.path})` : `[${label}](${asset.path})`;
};

export default function RecruitAssets({ cohortId, onPick = null }) {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState('');
  const [directory, setDirectory] = useState('assets');
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState(null);
  const [copied, setCopied] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  const load = useCallback(() => (
    api.recruitAdmin.assets(cohortId).then((result) => { setAssets(result); setError(''); }).catch((requestError) => setError(requestError.message || '加载失败'))
  ), [cohortId]);

  useEffect(() => { setAssets(null); load(); }, [load]);

  const upload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || uploading) return;
    setUploading(true);
    setReport(null);
    try {
      setReport(await api.recruitAdmin.uploadAssets(cohortId, files, directory.trim() || 'assets'));
    } catch (requestError) {
      setReport({ uploaded: [], failed: [{ name: '', message: requestError.message || '上传失败' }] });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
      load();
    }
  };

  const copy = async (asset) => {
    try {
      await navigator.clipboard.writeText(assetSnippet(asset));
      setCopied(asset.path);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      window.prompt('复制下面的引用代码', assetSnippet(asset));
    }
  };

  const remove = async (asset) => {
    if (!window.confirm(`确定删除「${asset.path}」吗？引用它的文档会显示为失效链接。`)) return;
    try {
      await api.recruitAdmin.deleteAsset(cohortId, asset.path);
      load();
    } catch (requestError) {
      window.alert(requestError.message || '删除失败');
    }
  };

  return (
    <div className="space-y-5">
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); upload(event.dataTransfer.files); }}
        className={`rounded-xl border border-dashed px-5 py-6 text-center transition-colors ${dragging ? 'border-primary bg-accent/40' : 'border-border bg-card'}`}
      >
        <UploadCloud size={22} strokeWidth={1.8} className="mx-auto text-primary" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-foreground">把文件拖到这里，或</p>
        <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />} 选择文件
        </Button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(event) => upload(event.target.files)} />
        <div className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-2 text-xs text-muted-foreground">
          <label htmlFor="asset-directory" className="shrink-0">存放文件夹</label>
          <Input id="asset-directory" value={directory} onChange={(event) => setDirectory(event.target.value)} className="h-8 text-xs" placeholder="assets" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">支持图片、PDF、视频、Word、PPT、Excel、ZIP、文本、Notebook，单个不超过 30MB。同名文件不会被覆盖，会自动加编号。</p>
      </div>

      {report && (
        <div role="status" className="space-y-1 rounded-lg border border-border/75 bg-secondary/30 px-4 py-3 text-sm">
          {report.uploaded?.length > 0 && <p className="text-foreground">已上传 {report.uploaded.length} 个文件。</p>}
          {report.failed?.map((item, index) => <p key={index} className="text-destructive">{item.name ? `${item.name}：` : ''}{item.message}</p>)}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!assets && !error && <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>}
      {assets && assets.length === 0 && <p className="rounded-lg border border-border/75 bg-secondary/20 py-8 text-center text-sm text-muted-foreground">这一期还没有上传过附件。</p>}

      {assets && assets.length > 0 && (
        <ul className="divide-y divide-border/75 overflow-hidden rounded-xl border border-border/75 bg-card">
          {assets.map((asset) => (
            <li key={asset.path} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/75 bg-secondary/40 text-primary">
                {IMAGE_EXTENSIONS.has(asset.extension)
                  ? <img src={resolveDocsAssetUrl(cohortId, asset.path)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <FileText size={18} strokeWidth={1.8} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{asset.name}</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">{asset.path} · {formatFileSize(asset.size)}</span>
              </span>
              {onPick && <Button type="button" size="sm" onClick={() => onPick(asset)}>插入</Button>}
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => copy(asset)} aria-label={`复制 ${asset.name} 的引用代码`}>
                {copied === asset.path ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}<span className="hidden sm:inline">{copied === asset.path ? '已复制' : '复制引用'}</span>
              </Button>
              <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => remove(asset)} aria-label={`删除 ${asset.name}`}><Trash2 size={15} aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
