import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FilePlus2, FileUp, ImagePlus, Loader2, Save, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import RecruitAssets, { assetSnippet } from '@/components/admin/RecruitAssets';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IMAGE_EXTENSIONS_BY_TYPE, cleanEditorMarkdown, nameUploadedFile } from '@/lib/recruit';
import { cn } from '@/lib/utils';

const MarkdownEditor = lazy(() => import('@/components/admin/MarkdownEditor'));

const NEW = '__new__';
const VIEWS = [{ id: 'visual', label: '编辑' }, { id: 'source', label: 'Markdown 源码' }];

const emptyForm = () => ({ slug: '', title: '', order: '', summary: '', draft: false, body: '# 新文档\n\n' });
const toForm = (page) => ({ slug: page.slug, title: page.title, order: page.order === '' ? '' : String(page.order), summary: page.summary, draft: page.draft, body: page.body });
const snapshot = (form) => JSON.stringify(form);

function Field({ label, htmlFor, children, className }) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export default function RecruitPagesEditor({ cohort }) {
  const [pages, setPages] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [view, setView] = useState('visual');
  const [editorVersion, setEditorVersion] = useState(0);
  const [status, setStatus] = useState({ busy: false, error: '', notice: '' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const editor = useRef(null);
  const textarea = useRef(null);
  const importInput = useRef(null);
  const dirty = Boolean(form) && snapshot(form) !== saved;
  const remoteImageCount = form ? new Set(Array.from(form.body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)/g), (match) => match[1])).size : 0;
  const reloadEditor = () => setEditorVersion((version) => version + 1);

  const loadPages = useCallback(() => api.recruitAdmin.pages(cohort.id).then(setPages).catch((error) => setStatus((current) => ({ ...current, error: error.message || '加载失败' }))), [cohort.id]);

  useEffect(() => { setPages(null); setSelected(null); setForm(null); setSaved(''); loadPages(); }, [loadPages]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const confirmLeave = () => !dirty || window.confirm('有未保存的修改，确定放弃吗？');

  const showForm = (next, slug, notice = '') => {
    setForm(next);
    setSaved(snapshot(next));
    setSelected(slug);
    reloadEditor();
    setStatus({ busy: false, error: '', notice });
  };

  const open = async (slug) => {
    if (slug === selected || !confirmLeave()) return;
    setStatus({ busy: true, error: '', notice: '' });
    try {
      showForm(toForm(await api.recruitAdmin.page(cohort.id, slug)), slug);
    } catch (error) {
      setStatus({ busy: false, error: error.message || '打开失败', notice: '' });
    }
  };

  const create = () => {
    if (!confirmLeave()) return;
    setForm(emptyForm());
    setSaved('');
    setSelected(NEW);
    reloadEditor();
    setStatus({ busy: false, error: '', notice: '' });
  };

  const save = async () => {
    if (!form || status.busy) return;
    if (uploading > 0 || /\]\(uploading-/.test(form.body)) return setStatus({ busy: false, error: '图片还在上传，请稍等几秒再保存。', notice: '' });
    if (!form.slug.trim()) return setStatus({ busy: false, error: '请填写文档名（用于网址，如 gpt-2）', notice: '' });
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const page = await api.recruitAdmin.savePage(cohort.id, form.slug.trim(), { title: form.title, order: form.order, summary: form.summary, draft: form.draft, body: form.body });
      const next = toForm(page);
      setForm(next);
      setSaved(snapshot(next));
      setSelected(page.slug);
      setStatus({ busy: false, error: '', notice: form.draft ? '已保存为草稿，访客暂时看不到。' : '已保存并发布。' });
      loadPages();
    } catch (error) {
      setStatus({ busy: false, error: error.message || '保存失败', notice: '' });
    }
  };

  const remove = async () => {
    if (!form || selected === NEW) return;
    if (!window.confirm(`确定删除文档「${form.slug}」吗？删除后无法恢复。`)) return;
    try {
      await api.recruitAdmin.deletePage(cohort.id, form.slug);
      setForm(null);
      setSaved('');
      setSelected(null);
      setStatus({ busy: false, error: '', notice: '已删除。' });
      loadPages();
    } catch (error) {
      setStatus({ busy: false, error: error.message || '删除失败', notice: '' });
    }
  };

  const importFile = async (file, overwrite = false) => {
    if (!file) return;
    if (!overwrite && !confirmLeave()) return;
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const result = await api.recruitAdmin.importPage(cohort.id, file, overwrite);
      await loadPages();
      showForm(toForm(await api.recruitAdmin.page(cohort.id, result.slug)), result.slug, `已导入为「${result.slug}」，请检查后确认是否发布。`);
    } catch (error) {
      if (error.status === 409 && window.confirm(`${error.message}\n\n要覆盖它吗？`)) return importFile(file, true);
      setStatus({ busy: false, error: error.message || '导入失败', notice: '' });
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  };

  const onUploading = useCallback((delta) => setUploading((count) => count + delta), []);
  const onNotice = useCallback((message) => setStatus((current) => ({ ...current, error: '', notice: message })), []);
  const onUploadError = useCallback((message) => setStatus((current) => ({ ...current, error: message, notice: '' })), []);
  const onVisualChange = useCallback((markdown) => {
    setForm((current) => (current ? { ...current, body: cleanEditorMarkdown(markdown) } : current));
  }, []);

  // --- source mode (plain textarea) ---
  const insertIntoSource = (text) => {
    const element = textarea.current;
    const start = element?.selectionStart ?? form.body.length;
    const end = element?.selectionEnd ?? form.body.length;
    setForm((current) => ({ ...current, body: `${current.body.slice(0, start)}${text}${current.body.slice(end)}` }));
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const uploadIntoSource = async (files) => {
    const before = form.body.slice(0, textarea.current?.selectionStart ?? form.body.length);
    const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const jobs = files.map((file, index) => ({
      file: nameUploadedFile(file, index, files.length),
      isImage: file.type in IMAGE_EXTENSIONS_BY_TYPE,
      token: `uploading-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    const placeholder = (job) => `${job.isImage ? '!' : ''}[上传中…](${job.token})`;
    insertIntoSource(`${lead}${jobs.map(placeholder).join('\n\n')}\n\n`);
    setUploading((count) => count + jobs.length);
    setStatus((current) => ({ ...current, error: '', notice: '' }));
    await Promise.all(jobs.map(async (job) => {
      const marker = placeholder(job);
      const replace = (to) => setForm((current) => ({ ...current, body: current.body.replace(marker, () => to) }));
      try {
        const asset = (await api.recruitAdmin.uploadAssets(cohort.id, [job.file], 'assets')).uploaded?.[0];
        if (!asset) throw new Error('上传失败');
        replace(job.isImage ? `![图片](${asset.path})` : assetSnippet(asset));
      } catch (error) {
        setForm((current) => ({ ...current, body: current.body.replace(`${marker}\n\n`, () => '').replace(marker, () => '') }));
        setStatus((current) => ({ ...current, error: `${job.file.name}：${error.message || '上传失败'}`, notice: '' }));
      } finally {
        setUploading((count) => count - 1);
      }
    }));
  };

  const onSourcePaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type in IMAGE_EXTENSIONS_BY_TYPE);
    if (!files.length || event.clipboardData?.getData('text/plain')?.trim()) return;
    event.preventDefault();
    uploadIntoSource(files);
  };

  const onSourceDrop = (event) => {
    setDragging(false);
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    event.preventDefault();
    uploadIntoSource(files);
  };

  const pickAsset = (asset) => {
    const snippet = assetSnippet(asset);
    if (view === 'visual') editor.current?.insertMarkdown(`${snippet}\n`);
    else insertIntoSource(snippet);
    setPickerOpen(false);
  };

  const switchView = (next) => {
    if (next === view) return;
    if (next === 'visual') reloadEditor();
    setView(next);
  };

  const onKeyDown = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" size="sm" className="flex-1 gap-1.5" onClick={create}><FilePlus2 size={14} aria-hidden="true" /> 新建</Button>
          <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => importInput.current?.click()}><FileUp size={14} aria-hidden="true" /> 导入 .md</Button>
          <input ref={importInput} type="file" accept=".md,.markdown,text/markdown" className="sr-only" onChange={(event) => importFile(event.target.files?.[0])} />
        </div>
        {!pages && <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>}
        {pages?.length === 0 && <p className="rounded-lg border border-border/75 bg-secondary/20 px-3 py-6 text-center text-sm text-muted-foreground">这一期还没有文档。点“新建”或“导入 .md”开始。</p>}
        <ul className="space-y-1">
          {selected === NEW && <li className="rounded-lg border border-primary bg-accent/50 px-3 py-2 text-sm font-medium text-primary">（新文档）</li>}
          {pages?.map((page) => (
            <li key={page.slug}>
              <button
                type="button"
                onClick={() => open(page.slug)}
                aria-current={page.slug === selected ? 'true' : undefined}
                className={cn('w-full rounded-lg border px-3 py-2 text-left transition-colors', page.slug === selected ? 'border-primary bg-accent/50' : 'border-border/75 bg-card hover:border-primary/40')}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{page.title}</span>
                  {page.draft && <span className="shrink-0 rounded bg-amber/25 px-1.5 text-[11px] font-semibold text-amber-foreground">草稿</span>}
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{page.slug}{page.order !== '' && ` · 排序 ${page.order}`}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">文档名为 <code>index</code> 的是总招新文档，始终排在最前。其他文档按“排序”数字从小到大排列。</p>
      </aside>

      <section className="min-w-0">
        {status.error && <p role="alert" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{status.error}</p>}
        {status.notice && <p role="status" className="mb-3 rounded-lg border border-primary/25 bg-accent/40 px-4 py-2.5 text-sm text-foreground">{status.notice}</p>}

        {!form ? (
          <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 px-6 text-center text-sm text-muted-foreground">
            {status.busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : '从左侧选择一篇文档编辑，或新建、导入一篇。'}
          </div>
        ) : (
          <div className="space-y-4" onKeyDown={onKeyDown}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_6rem]">
              <Field label={selected === NEW ? '文档名（网址，保存后不可改）' : '文档名（网址）'} htmlFor="page-slug">
                <Input id="page-slug" value={form.slug} onChange={update('slug')} disabled={selected !== NEW} placeholder="如 gpt-2 或 index" className="font-mono text-sm" />
              </Field>
              <Field label="标题（留空则使用正文第一个一级标题）" htmlFor="page-title"><Input id="page-title" value={form.title} onChange={update('title')} maxLength={100} /></Field>
              <Field label="排序" htmlFor="page-order"><Input id="page-order" value={form.order} onChange={update('order')} inputMode="decimal" placeholder="如 2" /></Field>
            </div>
            <Field label="简介（可选）" htmlFor="page-summary"><Input id="page-summary" value={form.summary} onChange={update('summary')} maxLength={300} /></Field>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Switch checked={form.draft} onCheckedChange={(value) => setForm((current) => ({ ...current, draft: value }))} aria-label="草稿" />
                草稿<span className="text-xs text-muted-foreground">（开启后访客看不到）</span>
              </label>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {selected !== NEW && !form.draft && cohort.status !== 'draft' && (
                  <Button asChild variant="ghost" size="sm" className="gap-1.5"><a href={`/recruit/${encodeURIComponent(cohort.id)}${form.slug === 'index' ? '' : `/${encodeURIComponent(form.slug)}`}`} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> 在站内查看</a></Button>
                )}
                {selected !== NEW && <Button type="button" variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={remove}><Trash2 size={14} aria-hidden="true" /> 删除</Button>}
                <Button type="button" size="sm" className="gap-1.5" disabled={status.busy || (!dirty && selected !== NEW)} onClick={save}>
                  {status.busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />} {dirty ? '保存' : '已保存'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/75 pt-4">
              <div role="tablist" aria-label="编辑方式" className="inline-flex rounded-lg bg-secondary/60 p-0.5">
                {VIEWS.map((item) => (
                  <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => switchView(item.id)} className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', view === item.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{item.label}</button>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setPickerOpen(true)}><ImagePlus size={13} aria-hidden="true" /> 图片 / 附件</Button>
              {view === 'visual' && remoteImageCount > 0 && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={uploading > 0} onClick={() => editor.current?.localizeImages()}>转存 {remoteImageCount} 张外链图片</Button>
              )}
              <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                {uploading > 0 ? <span className="inline-flex items-center gap-1.5 text-primary"><Loader2 size={12} className="animate-spin" aria-hidden="true" /> 正在上传 {uploading} 个文件…</span> : '输入 / 唤出菜单 · 可直接粘贴或拖入图片 · Ctrl / ⌘ + S 保存'}
              </span>
            </div>

            {view === 'visual' ? (
              <Suspense fallback={<div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-border/75 bg-card text-sm text-muted-foreground"><Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" /> 正在加载编辑器…</div>}>
                <MarkdownEditor
                  key={`${selected}-${editorVersion}`}
                  ref={editor}
                  initialValue={form.body}
                  cohortId={cohort.id}
                  onChange={onVisualChange}
                  onUploading={onUploading}
                  onError={onUploadError}
                  onNotice={onNotice}
                />
              </Suspense>
            ) : (
              <textarea
                ref={textarea}
                value={form.body}
                onChange={update('body')}
                onPaste={onSourcePaste}
                onDrop={onSourceDrop}
                onDragOver={(event) => { if (event.dataTransfer?.types?.includes('Files')) { event.preventDefault(); setDragging(true); } }}
                onDragLeave={() => setDragging(false)}
                spellCheck={false}
                aria-label="Markdown 正文"
                className={cn('h-[65vh] min-h-[20rem] w-full resize-y rounded-xl border bg-card p-4 font-mono text-sm leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring', dragging ? 'border-primary ring-2 ring-primary/40' : 'border-input')}
              />
            )}
          </div>
        )}
      </section>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>插入图片或附件</DialogTitle>
            <DialogDescription>选择已有文件，或先上传。点“插入”会在光标处加入。</DialogDescription>
          </DialogHeader>
          <RecruitAssets cohortId={cohort.id} onPick={pickAsset} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
