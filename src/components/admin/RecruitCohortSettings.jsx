import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const STATUS_OPTIONS = [
  { value: 'draft', label: '未发布（仅管理员可见）' },
  { value: 'current', label: '本次招新（接收提交）' },
  { value: 'archived', label: '往期' },
  { value: 'upcoming', label: '即将开始' },
];

const toDraft = (cohort) => ({ ...cohort, directionsText: (cohort.directions || []).join('\n'), existing: true });
const toPayload = ({ directionsText, existing: _existing, ...cohort }) => ({
  ...cohort,
  directions: directionsText.split('\n').map((line) => line.trim()).filter(Boolean),
});

function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function RecruitCohortSettings({ cohorts, onSaved }) {
  const [drafts, setDrafts] = useState(() => cohorts.map(toDraft));
  const [status, setStatus] = useState({ busy: false, error: '', notice: '' });

  useEffect(() => { setDrafts(cohorts.map(toDraft)); }, [cohorts]);

  const patch = (index, changes) => setDrafts((current) => current.map((item, position) => (position === index ? { ...item, ...changes } : item)));
  const move = (index, step) => setDrafts((current) => {
    const next = [...current];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    return next;
  });
  const add = () => setDrafts((current) => [...current, { id: '', label: '', status: 'draft', description: '', directionsText: '', submissions: true, submission_deadline: '', publish_at: '', publish_drafts: true, existing: false }]);
  const remove = (index) => {
    const item = drafts[index];
    if (!window.confirm(`从列表中移除「${item.label || item.id || '新批次'}」？${item.existing ? '\n\n它的文档和附件文件仍保留在服务器上，重新用同一个编号添加即可找回。' : ''}`)) return;
    setDrafts((current) => current.filter((_, position) => position !== index));
  };

  const save = async () => {
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const saved = await api.recruitAdmin.saveCohorts(drafts.map(toPayload));
      setStatus({ busy: false, error: '', notice: '已保存。' });
      onSaved(saved);
    } catch (error) {
      setStatus({ busy: false, error: error.message || '保存失败', notice: '' });
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">列表的顺序就是招新页面里下拉菜单的顺序，建议按时间从早到晚。同一时间只能有一个“本次招新”，只有它接收提交。新批次默认是“未发布”，访客看不到，写好后到上方的“发布”面板发布。</p>

      {drafts.map((item, index) => (
        <fieldset key={item.existing ? item.id : `new-${index}`} className="min-w-0 space-y-4 rounded-xl border border-border/75 bg-card px-4 pb-5 pt-2 sm:px-5">
          <legend className="px-2 text-sm font-semibold text-foreground">{item.label || item.id || '新批次'}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="批次编号" htmlFor={`cohort-id-${index}`} hint={item.existing ? '已创建的编号不能修改。' : '小写字母、数字和连字符，如 2027-autumn。'}>
              <Input id={`cohort-id-${index}`} value={item.id} disabled={item.existing} onChange={(event) => patch(index, { id: event.target.value.trim().toLowerCase() })} className="font-mono text-sm" />
            </Field>
            <Field label="显示名称" htmlFor={`cohort-label-${index}`}><Input id={`cohort-label-${index}`} value={item.label} maxLength={40} onChange={(event) => patch(index, { label: event.target.value })} placeholder="如 26 秋季招新" /></Field>
            <Field label="状态">
              <Select value={item.status} onValueChange={(value) => patch(index, { status: value })}>
                <SelectTrigger aria-label="状态"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="说明（显示在批次切换器旁，可选）" htmlFor={`cohort-description-${index}`}><Input id={`cohort-description-${index}`} value={item.description} maxLength={100} onChange={(event) => patch(index, { description: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="选择方向（提交表单里的选项，一行一个）" htmlFor={`cohort-directions-${index}`} hint="本次是十篇论文。方向会写进文件名，请用简短名称。">
              <Textarea id={`cohort-directions-${index}`} value={item.directionsText} rows={5} onChange={(event) => patch(index, { directionsText: event.target.value })} className="font-mono text-sm" placeholder={'ViT\nBERT\nCLIP'} />
            </Field>
            <div className="space-y-4">
              <Field label="提交截止时间（北京时间，可选）" htmlFor={`cohort-deadline-${index}`} hint="写 2026-12-06 表示当天 23:59:59，写 2026-12-06 18:00 表示具体时刻。留空表示不设截止。">
                <Input id={`cohort-deadline-${index}`} value={item.submission_deadline} onChange={(event) => patch(index, { submission_deadline: event.target.value })} placeholder="2026-12-06 18:00" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Switch checked={item.submissions} onCheckedChange={(value) => patch(index, { submissions: value })} aria-label="开放提交" />
                开放提交入口<span className="text-xs text-muted-foreground">（仅“本次招新”生效）</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label="上移"><ArrowUp size={15} aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={index === drafts.length - 1} onClick={() => move(index, 1)} aria-label="下移"><ArrowDown size={15} aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => remove(index)}><Trash2 size={14} aria-hidden="true" /> 移除</Button>
          </div>
        </fieldset>
      ))}

      {status.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{status.error}</p>}
      {status.notice && <p role="status" className="rounded-lg border border-primary/25 bg-accent/40 px-4 py-2.5 text-sm text-foreground">{status.notice}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="gap-1.5" onClick={add}><Plus size={15} aria-hidden="true" /> 添加批次</Button>
        <Button type="button" className="gap-1.5" disabled={status.busy} onClick={save}>{status.busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />} 保存批次设置</Button>
      </div>
    </div>
  );
}
