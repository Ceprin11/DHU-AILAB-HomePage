import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileArchive, FileText, Loader2, Lock, UploadCloud } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatBeijingTime, formatFileSize, groupDirections, previewFileName } from '@/lib/recruit';

const ACCEPTED_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.html', '.htm'];
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const EMPTY_FORM = { direction: '', qq: '', wechat: '', email: '', note: '' };

function Field({ label, required = true, optional = false, hint = null, children, htmlFor }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted-foreground">选填</span>}
      </Label>
      {children}
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

const extensionOf = (fileName) => {
  const index = fileName.lastIndexOf('.');
  return index < 0 ? '' : fileName.slice(index).toLowerCase();
};

// Who is applying (name, student id, grade, major) comes from the signed-in applicant account, not from this form.
export default function SubmissionForm({ cohort, applicant = null, preview = false }) {
  const { submission } = cohort;
  const needsDirection = submission.directions.length > 0;
  const directionSections = groupDirections(submission.directions, submission.groups);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [status, setStatus] = useState({ phase: 'idle', error: '', result: null });
  const fileInput = useRef(null);
  const attachmentInput = useRef(null);
  // The applicant's own earlier submissions: shown as a history, used to pre-fill contact details and to fix the paper once it is locked.
  const [mine, setMine] = useState({ submissions: [], locked_direction: '' });
  const signedIn = Boolean(applicant) && !preview;
  // Until the paper choice locks, a student may submit just the chosen paper and bring the report later.
  const lock = submission.directionLock;
  const reportOptional = Boolean(lock && !lock.locked);

  const loadMine = useCallback(() => {
    if (!signedIn) return Promise.resolve();
    return api.applicant.mySubmissions(cohort.id).then((result) => {
      setMine(result);
      const [latest] = result.submissions;
      setForm((current) => ({
        ...current,
        direction: result.locked_direction || current.direction,
        ...(latest && !current.qq && !current.wechat && !current.email ? { qq: latest.qq, wechat: latest.wechat, email: latest.email } : {}),
      }));
    }).catch(() => {});
  }, [cohort.id, signedIn]);

  useEffect(() => { loadMine(); }, [loadMine]);

  if (!submission.open) {
    return (
      <div className="rounded-xl border border-border/75 bg-secondary/30 px-6 py-10 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-primary/10 bg-amber/20 text-primary"><Lock size={19} strokeWidth={1.8} aria-hidden="true" /></span>
        <p className="mt-4 text-base font-semibold text-foreground">暂时不能提交</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{submission.reason || '当前不接收提交'}</p>
      </div>
    );
  }

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const choose = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const uploading = status.phase === 'uploading';

  const validate = () => {
    if (needsDirection && !form.direction) return '请选择方向';
    const { qq, wechat, email } = form;
    if (!qq.trim() && !wechat.trim() && !email.trim()) return 'QQ、微信、邮箱至少填写一个';
    if (qq.trim() && !/^[0-9]{5,12}$/.test(qq.trim())) return 'QQ 号应为 5-12 位数字';
    if (wechat.trim() && !/^[A-Za-z0-9_-]{3,30}$/.test(wechat.trim())) return '微信号只能包含字母、数字、下划线和短横线';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '邮箱格式不正确';
    if (!file && !reportOptional) return '请选择要提交的报告';
    if (!file && attachment) return '上传代码与结果压缩包时，请同时上传报告';
    if (!file) return '';
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) return '报告文件类型不支持，仅支持 PDF、PPT、HTML';
    if (file.size > MAX_FILE_BYTES) return `报告文件不能超过 ${MAX_FILE_BYTES / 1024 / 1024}MB`;
    if (attachment && extensionOf(attachment.name) !== '.zip') return '代码与结果请打包成一个 .zip 文件';
    if (attachment && attachment.size > MAX_ATTACHMENT_BYTES) return `压缩包不能超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB`;
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (uploading || preview) return;
    const problem = validate();
    if (problem) return setStatus({ phase: 'idle', error: problem, result: null });
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value.trim()));
    if (file) body.append('file', file);
    if (attachment) body.append('attachment', attachment);
    setStatus({ phase: 'uploading', error: '', result: null, progress: 0 });
    try {
      const result = await api.recruit.submit(cohort.id, body, { onProgress: (ratio) => setStatus((current) => (current.phase === 'uploading' ? { ...current, progress: ratio } : current)) });
      setStatus({ phase: 'done', error: '', result });
      loadMine();
    } catch (error) {
      setStatus({ phase: 'idle', error: error.message || '提交失败，请稍后重试', result: null });
      // The lock may have started while the page was open: reload it so the paper select shows the right choice.
      loadMine();
    }
  };

  const reset = () => {
    setForm((current) => ({ ...EMPTY_FORM, direction: current.direction, qq: current.qq, wechat: current.wechat, email: current.email }));
    setFile(null);
    setAttachment(null);
    if (fileInput.current) fileInput.current.value = '';
    if (attachmentInput.current) attachmentInput.current.value = '';
    setStatus({ phase: 'idle', error: '', result: null });
  };

  if (status.phase === 'done' && status.result.has_report === false) {
    return (
      <div className="rounded-xl border border-primary/25 bg-accent/40 px-6 py-10 text-center" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><CheckCircle2 size={24} strokeWidth={1.8} aria-hidden="true" /></span>
        <p className="mt-4 font-display text-xl font-bold text-foreground">选题已登记</p>
        {applicant && <p className="mt-3 text-sm text-foreground/90">已记录：{[applicant.name, applicant.student_id, applicant.grade, applicant.major, form.direction].filter(Boolean).join(' · ')}</p>}
        <p className="mt-2 text-sm text-muted-foreground">
          {lock ? `${formatBeijingTime(lock.at)} 论文锁定前还可以更换，以最后一次提交为准。` : ''}报告写好后回到这里提交{submission.deadline ? `，截止时间 ${formatBeijingTime(submission.deadline)}` : ''}。
        </p>
        <Button type="button" variant="outline" className="mt-6" onClick={reset}>返回提交页</Button>
      </div>
    );
  }

  if (status.phase === 'done') {
    return (
      <div className="rounded-xl border border-primary/25 bg-accent/40 px-6 py-10 text-center" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><CheckCircle2 size={24} strokeWidth={1.8} aria-hidden="true" /></span>
        <p className="mt-4 font-display text-xl font-bold text-foreground">提交成功</p>
        {applicant && <p className="mt-3 text-sm text-foreground/90">已记录：{[applicant.name, applicant.student_id, applicant.grade, applicant.major, form.direction].filter(Boolean).join(' · ')}</p>}
        <p className="mt-2 text-sm text-muted-foreground">文件已按统一规则命名并保存：</p>
        <p className="mx-auto mt-2 max-w-full break-all rounded-lg bg-card px-4 py-2.5 font-mono text-sm text-foreground">{status.result.final_name}</p>
        {status.result.attachment_name && <p className="mx-auto mt-2 max-w-full break-all rounded-lg bg-card px-4 py-2.5 font-mono text-sm text-foreground">{status.result.attachment_name}</p>}
        <p className="mt-3 text-xs text-muted-foreground">如需修改，请重新提交，系统会自动递增版本号，之前的提交不会被覆盖。</p>
        <Button type="button" variant="outline" className="mt-6" onClick={reset}>再提交一份</Button>
      </div>
    );
  }

  const extension = file ? extensionOf(file.name) : '.pdf';
  const namePreview = previewFileName({ ...form, name: applicant?.name, student_id: applicant?.student_id, grade: applicant?.grade, major: applicant?.major }, extension);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <p className="text-xs text-muted-foreground">带 <span className="text-destructive">*</span> 的为必填项。</p>

      <div className="grid gap-5 sm:grid-cols-2">
        {needsDirection && (
          <Field label="选择方向（论文）" hint={mine.locked_direction ? `论文已锁定，你只能继续提交「${mine.locked_direction}」。` : null}>
            <Select value={form.direction} onValueChange={choose('direction')} disabled={Boolean(mine.locked_direction)}>
              <SelectTrigger aria-label="选择方向"><SelectValue placeholder="请选择论文" /></SelectTrigger>
              <SelectContent>
                {directionSections.map((section) => (
                  <SelectGroup key={section.name || 'rest'}>
                    {section.name && directionSections.length > 1 && <SelectLabel>{section.name}</SelectLabel>}
                    {section.directions.map((direction) => <SelectItem key={direction} value={direction}>{direction}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <div role="group" aria-labelledby="submit-contact-title" className="min-w-0 space-y-3 rounded-xl border border-border/75 bg-card/60 px-4 py-5 sm:px-5">
        <div>
          <p id="submit-contact-title" className="text-sm font-medium text-foreground">联系方式<span className="ml-0.5 text-destructive" aria-hidden="true">*</span><span className="ml-1.5 text-xs font-normal text-muted-foreground">三项至少填一项</span></p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">方便实验室联系你，仅实验室管理员可见。{mine.submissions.length > 0 && '已按你上一次提交的内容填好，可以修改。'}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="QQ" required={false} htmlFor="submit-qq"><Input id="submit-qq" value={form.qq} onChange={update('qq')} maxLength={12} inputMode="numeric" autoComplete="off" /></Field>
          <Field label="微信" required={false} htmlFor="submit-wechat"><Input id="submit-wechat" value={form.wechat} onChange={update('wechat')} maxLength={30} autoComplete="off" /></Field>
          <Field label="邮箱" required={false} htmlFor="submit-email"><Input id="submit-email" type="email" value={form.email} onChange={update('email')} maxLength={80} autoComplete="email" /></Field>
        </div>
      </div>

      <Field label="备注" required={false} optional htmlFor="submit-note"><Textarea id="submit-note" value={form.note} onChange={update('note')} maxLength={1000} rows={3} placeholder="想对评审说的话，可以不填" /></Field>

      <Field
        label="报告"
        required={!reportOptional}
        optional={reportOptional}
        hint={<>
          {reportOptional && <span className="block font-medium text-foreground/80">{formatBeijingTime(lock.at)} 论文锁定前，可以先不传报告，只提交选好的论文；锁定后再提交时必须附上报告。</span>}
          {`仅支持 PDF、PPT、HTML，不超过 ${MAX_FILE_BYTES / 1024 / 1024}MB。用 Word 或 LaTeX 模版写好后导出为 PDF。`}
        </>}
      >
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-5 py-7 text-center transition-colors hover:border-primary/50 hover:bg-secondary/30 focus-within:border-primary">
          <UploadCloud size={22} strokeWidth={1.8} className="text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{file ? file.name : '点击选择报告文件'}</span>
          {file && <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>}
          <input ref={fileInput} type="file" accept={ACCEPTED_EXTENSIONS.join(',')} className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
      </Field>

      <Field label="代码与结果" required={false} optional hint={`把代码、README、预测结果 CSV、实验日志等打包成一个 .zip，不超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024}MB。题目要求交代码或预测结果的，请一定附上；不要放数据集和模型权重。`}>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-5 py-6 text-center transition-colors hover:border-primary/50 hover:bg-secondary/30 focus-within:border-primary">
          <FileArchive size={22} strokeWidth={1.8} className="text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{attachment ? attachment.name : '点击选择 .zip 压缩包'}</span>
          {attachment && <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>}
          <input ref={attachmentInput} type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
        </label>
        {attachment && <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => { setAttachment(null); if (attachmentInput.current) attachmentInput.current.value = ''; }}>不附带压缩包</button>}
      </Field>

      {file || !reportOptional ? (
        <div className="rounded-lg bg-secondary/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">提交后文件会被统一命名为（版本号由系统自动生成，不使用你上传时的文件名）：</p>
          <p className="mt-1 break-all font-mono text-sm text-foreground">{namePreview}</p>
          {attachment && <p className="mt-1 break-all font-mono text-sm text-foreground">{namePreview.replace(/\.[^.]+$/, '')}_代码与结果.zip</p>}
        </div>
      ) : (
        <p className="rounded-lg bg-secondary/40 px-4 py-3 text-xs leading-5 text-muted-foreground">没有选择报告：这次提交只登记你选的论文{form.direction ? `「${form.direction}」` : ''}。</p>
      )}

      {status.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{status.error}</p>}

      <Button type="submit" disabled={uploading || preview} className="w-full gap-2 sm:w-auto">
        {uploading ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {status.progress >= 1 ? '上传完成，正在保存…' : `上传中 ${Math.round((status.progress || 0) * 100)}%，请不要关闭页面`}</> : preview ? '预览模式下不能提交' : file || !reportOptional ? '提交' : '登记选题'}
      </Button>

      <MySubmissions submissions={mine.submissions} />
    </form>
  );
}

// Only the signed-in applicant's own records; nobody else's submissions are ever sent to this page.
function MySubmissions({ submissions }) {
  if (!submissions.length) return null;
  return (
    <section aria-labelledby="my-submissions-title" className="border-t border-border/75 pt-6">
      <h2 id="my-submissions-title" className="text-sm font-semibold text-foreground">我的提交记录<span className="ml-2 font-normal text-muted-foreground">共 {submissions.length} 次</span></h2>
      <ul className="mt-3 space-y-2">
        {submissions.map((item, index) => (
          <li key={item.id} className="flex items-start gap-3 rounded-lg border border-border/70 bg-card/60 px-3.5 py-2.5">
            <FileText size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {item.has_report === false
                ? <p className="text-xs text-foreground">登记选题：{item.direction}（未上传报告）</p>
                : <p className="break-all font-mono text-xs text-foreground">{item.final_name}</p>}
              {item.attachment_name && <p className="mt-0.5 break-all font-mono text-xs text-foreground">{item.attachment_name}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">{formatBeijingTime(item.created_at)}{item.has_report !== false && ` · ${formatFileSize(item.size)}`}{index === 0 && ' · 最新'}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
