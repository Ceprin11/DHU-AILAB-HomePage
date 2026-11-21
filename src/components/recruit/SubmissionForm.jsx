import React, { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Lock, UploadCloud } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatBeijingTime, formatFileSize, groupDirections, previewFileName } from '@/lib/recruit';

const ACCEPTED_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.html', '.htm'];
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const EMPTY_FORM = { direction: '', qq: '', wechat: '', email: '', note: '' };

function Field({ label, required = true, hint = null, children, htmlFor }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
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
  const [status, setStatus] = useState({ phase: 'idle', error: '', result: null });
  const fileInput = useRef(null);

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
    if (!file) return '请选择要提交的文件';
    if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) return '文件类型不支持，仅支持 PDF、PPT、HTML';
    if (file.size > MAX_FILE_BYTES) return `文件不能超过 ${MAX_FILE_BYTES / 1024 / 1024}MB`;
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (uploading || preview) return;
    const problem = validate();
    if (problem) return setStatus({ phase: 'idle', error: problem, result: null });
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value.trim()));
    body.append('file', file);
    setStatus({ phase: 'uploading', error: '', result: null });
    try {
      const result = await api.recruit.submit(cohort.id, body);
      setStatus({ phase: 'done', error: '', result });
    } catch (error) {
      setStatus({ phase: 'idle', error: error.message || '提交失败，请稍后重试', result: null });
    }
  };

  const reset = () => {
    setForm((current) => ({ ...EMPTY_FORM, direction: current.direction, qq: current.qq, wechat: current.wechat, email: current.email }));
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
    setStatus({ phase: 'idle', error: '', result: null });
  };

  if (status.phase === 'done') {
    return (
      <div className="rounded-xl border border-primary/25 bg-accent/40 px-6 py-10 text-center" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><CheckCircle2 size={24} strokeWidth={1.8} aria-hidden="true" /></span>
        <p className="mt-4 font-display text-xl font-bold text-foreground">提交成功</p>
        {applicant && <p className="mt-3 text-sm text-foreground/90">已记录：{[applicant.name, applicant.student_id, applicant.grade, applicant.major, form.direction].filter(Boolean).join(' · ')}</p>}
        <p className="mt-2 text-sm text-muted-foreground">文件已按统一规则命名并保存：</p>
        <p className="mx-auto mt-2 max-w-full break-all rounded-lg bg-card px-4 py-2.5 font-mono text-sm text-foreground">{status.result.final_name}</p>
        <p className="mt-3 text-xs text-muted-foreground">如需修改，请重新提交，系统会自动递增版本号，之前的提交不会被覆盖。</p>
        <Button type="button" variant="outline" className="mt-6" onClick={reset}>再提交一份</Button>
      </div>
    );
  }

  const extension = file ? extensionOf(file.name) : '.pptx';
  const namePreview = previewFileName({ ...form, name: applicant?.name, student_id: applicant?.student_id, grade: applicant?.grade, major: applicant?.major }, extension);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {submission.deadline && (
        <p className="rounded-lg border border-amber/60 bg-amber/15 px-4 py-2.5 text-sm text-amber-foreground">截止时间：{formatBeijingTime(submission.deadline)}（北京时间）</p>
      )}
      {needsDirection && submission.directionLock && (
        <p className="rounded-lg border border-border/75 bg-secondary/40 px-4 py-2.5 text-sm leading-6 text-foreground/90">
          {submission.directionLock.locked
            ? '论文选择已经锁定：之前提交过的同学只能继续提交原来选的那一篇；还没提交过的同学可以选一篇，提交后同样锁定。'
            : `论文可以随时更换，以你最后一次提交为准。${formatBeijingTime(submission.directionLock.at)}（北京时间）之后论文锁定，不能再更换。`}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {needsDirection && (
          <Field label="选择方向（论文）">
            <Select value={form.direction} onValueChange={choose('direction')}>
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
          <p id="submit-contact-title" className="text-sm font-medium text-foreground">联系方式<span className="ml-0.5 text-destructive" aria-hidden="true">*</span></p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">QQ、微信、邮箱至少填写一个，仅实验室管理员可见。</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="QQ" required={false} htmlFor="submit-qq"><Input id="submit-qq" value={form.qq} onChange={update('qq')} maxLength={12} inputMode="numeric" autoComplete="off" /></Field>
          <Field label="微信" required={false} htmlFor="submit-wechat"><Input id="submit-wechat" value={form.wechat} onChange={update('wechat')} maxLength={30} autoComplete="off" /></Field>
          <Field label="邮箱" required={false} htmlFor="submit-email"><Input id="submit-email" type="email" value={form.email} onChange={update('email')} maxLength={80} autoComplete="email" /></Field>
        </div>
      </div>

      <Field label="备注" required={false} htmlFor="submit-note"><Textarea id="submit-note" value={form.note} onChange={update('note')} maxLength={1000} rows={3} placeholder="想对评审说的话，可以不填" /></Field>

      <Field label="文件" hint={`仅支持 PDF、PPT、HTML，不超过 ${MAX_FILE_BYTES / 1024 / 1024}MB。`}>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-5 py-7 text-center transition-colors hover:border-primary/50 hover:bg-secondary/30 focus-within:border-primary">
          <UploadCloud size={22} strokeWidth={1.8} className="text-primary" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{file ? file.name : '点击选择文件'}</span>
          {file && <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>}
          <input ref={fileInput} type="file" accept={ACCEPTED_EXTENSIONS.join(',')} className="sr-only" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
      </Field>

      <div className="rounded-lg bg-secondary/40 px-4 py-3">
        <p className="text-xs text-muted-foreground">提交后文件会被统一命名为（版本号由系统自动生成，不使用你上传时的文件名）：</p>
        <p className="mt-1 break-all font-mono text-sm text-foreground">{namePreview}</p>
      </div>

      {status.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{status.error}</p>}

      <Button type="submit" disabled={uploading || preview} className="w-full gap-2 sm:w-auto">
        {uploading ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> 上传中，请不要关闭页面</> : preview ? '预览模式下不能提交' : '提交'}
      </Button>
    </form>
  );
}
