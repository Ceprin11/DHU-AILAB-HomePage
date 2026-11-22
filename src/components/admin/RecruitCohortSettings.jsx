import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, Wand2 } from 'lucide-react';
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

const lines = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

// The form edits the groups and the directions that belong to no group; the cohort stores one list plus the groups.
const toDraft = (cohort) => {
  const groups = cohort.groups || [];
  const claimed = new Set(groups.flatMap((group) => group.directions));
  return {
    ...cohort,
    groupDrafts: groups.map((group) => ({ name: group.name, directionsText: group.directions.join('\n') })),
    directionsText: (cohort.directions || []).filter((direction) => !claimed.has(direction)).join('\n'),
    existing: true,
  };
};
const toPayload = ({ groupDrafts, directionsText, existing: _existing, ...cohort }) => {
  const groups = groupDrafts.map((group) => ({ name: group.name.trim(), directions: lines(group.directionsText) }));
  return { ...cohort, groups, directions: [...groups.flatMap((group) => group.directions), ...lines(directionsText)] };
};

// Common fields for this lab's paper list; only names that are already in the cohort are used.
const SUGGESTED_GROUPS = [
  { name: '计算机视觉', members: ['ConvNeXt', 'ViT', 'DINOv2', 'U-Net', 'Swin', 'ResNet', 'YOLO', 'SAM', 'MAE'] },
  { name: '自然语言处理', members: ['BERT', 'GPT-2', 'GPT-3', 'T5', 'LLaMA', 'Transformer'] },
  { name: '多模态', members: ['CLIP', 'BLIP', 'LLaVA', 'Flamingo', 'Stable Diffusion'] },
];

function Field({ label, htmlFor, hint, children }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function RecruitCohortSettings({ cohorts, onSaved, onRenamed }) {
  const [drafts, setDrafts] = useState(() => cohorts.map(toDraft));
  const [status, setStatus] = useState({ busy: false, error: '', notice: '' });

  useEffect(() => { setDrafts(cohorts.map(toDraft)); }, [cohorts]);

  const patch = (index, changes) => setDrafts((current) => current.map((item, position) => (position === index ? { ...item, ...changes } : item)));
  const move = (index, step) => setDrafts((current) => {
    const next = [...current];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    return next;
  });
  const patchGroup = (index, groupIndex, changes) => patch(index, { groupDrafts: drafts[index].groupDrafts.map((group, position) => (position === groupIndex ? { ...group, ...changes } : group)) });
  const addGroup = (index, name = '') => patch(index, { groupDrafts: [...drafts[index].groupDrafts, { name, directionsText: '' }] });
  const removeGroup = (index, groupIndex) => {
    const group = drafts[index].groupDrafts[groupIndex];
    // The papers of a removed group are kept as un-grouped ones.
    patch(index, {
      groupDrafts: drafts[index].groupDrafts.filter((_, position) => position !== groupIndex),
      directionsText: [...lines(group.directionsText), ...lines(drafts[index].directionsText)].join('\n'),
    });
  };
  const moveGroup = (index, groupIndex, step) => {
    const next = [...drafts[index].groupDrafts];
    [next[groupIndex], next[groupIndex + step]] = [next[groupIndex + step], next[groupIndex]];
    patch(index, { groupDrafts: next });
  };
  const applySuggestedGroups = (index) => {
    const item = drafts[index];
    const all = [...item.groupDrafts.flatMap((group) => lines(group.directionsText)), ...lines(item.directionsText)];
    const used = new Set();
    const groupDrafts = SUGGESTED_GROUPS.map((suggested) => {
      const members = all.filter((direction) => suggested.members.some((name) => name.toLowerCase() === direction.toLowerCase()));
      members.forEach((direction) => used.add(direction));
      return { name: suggested.name, directionsText: members.join('\n') };
    }).filter((group) => group.directionsText);
    patch(index, { groupDrafts, directionsText: all.filter((direction) => !used.has(direction)).join('\n') });
  };
  const add = () => setDrafts((current) => [...current, { id: '', label: '', status: 'draft', description: '', groupDrafts: [], directionsText: '', submissions: true, submission_deadline: '', direction_lock_at: '', publish_at: '', publish_drafts: true, existing: false }]);
  const remove = (index) => {
    const item = drafts[index];
    if (!window.confirm(`从列表中移除「${item.label || item.id || '新批次'}」？${item.existing ? '\n\n它的文档和附件文件仍保留在服务器上，重新用同一个编号添加即可找回。' : ''}`)) return;
    setDrafts((current) => current.filter((_, position) => position !== index));
  };

  const rename = async (item) => {
    const input = window.prompt(`把批次编号「${item.id}」改成（小写字母、数字和连字符，如 2026-fall）：`, item.id);
    const next = (input || '').trim().toLowerCase();
    if (!next || next === item.id) return;
    if (!window.confirm(`确认把「${item.id}」改成「${next}」？\n\n文档、图片附件和已收到的提交会一起迁移，页面网址会从 /recruit/${item.id} 变成 /recruit/${next}，旧网址不再有效。\n\n这个页面上还没保存的修改会丢失。`)) return;
    setStatus({ busy: true, error: '', notice: '' });
    try {
      const result = await api.recruitAdmin.renameCohort(item.id, next);
      setStatus({ busy: false, error: '', notice: `批次编号已改为 ${result.id}。` });
      onRenamed(result.id, result.cohorts);
    } catch (error) {
      setStatus({ busy: false, error: error.message || '修改失败', notice: '' });
    }
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
            <Field label="批次编号" htmlFor={`cohort-id-${index}`} hint={item.existing ? '编号是网址的一部分，要改请点右侧的“修改编号”。' : '小写字母、数字和连字符，如 2027-fall。'}>
              <div className="flex gap-2">
                <Input id={`cohort-id-${index}`} value={item.id} disabled={item.existing} onChange={(event) => patch(index, { id: event.target.value.trim().toLowerCase() })} className="font-mono text-sm" />
                {item.existing && <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={status.busy} onClick={() => rename(item)}>修改编号</Button>}
              </div>
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
            <div className="min-w-0 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">选择方向（论文）和分组</p>
                <p className="text-xs leading-5 text-muted-foreground">提交表单、文档目录和“收到的提交”都会按分组归类。每个方向一行，会写进文件名，请用简短名称。</p>
              </div>
              {item.groupDrafts.map((group, groupIndex) => (
                <div key={groupIndex} className="min-w-0 space-y-2 rounded-lg border border-border/75 bg-secondary/20 p-3">
                  <div className="flex items-center gap-1">
                    <Input value={group.name} maxLength={20} onChange={(event) => patchGroup(index, groupIndex, { name: event.target.value })} placeholder="分组名，如 计算机视觉" aria-label="分组名" className="h-8 flex-1 bg-card text-sm font-medium" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={groupIndex === 0} onClick={() => moveGroup(index, groupIndex, -1)} aria-label="分组上移"><ArrowUp size={14} aria-hidden="true" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={groupIndex === item.groupDrafts.length - 1} onClick={() => moveGroup(index, groupIndex, 1)} aria-label="分组下移"><ArrowDown size={14} aria-hidden="true" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeGroup(index, groupIndex)} aria-label="删除分组"><Trash2 size={14} aria-hidden="true" /></Button>
                  </div>
                  <Textarea value={group.directionsText} rows={Math.min(8, Math.max(3, lines(group.directionsText).length + 1))} onChange={(event) => patchGroup(index, groupIndex, { directionsText: event.target.value })} aria-label={`${group.name || '分组'}的方向`} className="bg-card font-mono text-sm" placeholder={'ViT\nBERT'} />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor={`cohort-directions-${index}`} className="text-xs font-medium text-muted-foreground">{item.groupDrafts.length ? '未分组的方向' : '方向列表'}</Label>
                <Textarea id={`cohort-directions-${index}`} value={item.directionsText} rows={item.groupDrafts.length ? 3 : 5} onChange={(event) => patch(index, { directionsText: event.target.value })} className="font-mono text-sm" placeholder={'ViT\nBERT\nCLIP'} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addGroup(index)}><Plus size={14} aria-hidden="true" /> 添加分组</Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => applySuggestedGroups(index)}><Wand2 size={14} aria-hidden="true" /> 按 计算机视觉 / 自然语言处理 / 多模态 自动分组</Button>
              </div>
            </div>
            <div className="space-y-4">
              <Field label="提交截止时间（北京时间，可选）" htmlFor={`cohort-deadline-${index}`} hint="写 2026-12-06 表示当天 23:59:59，写 2026-12-06 18:00 表示具体时刻。留空表示不设截止。">
                <Input id={`cohort-deadline-${index}`} value={item.submission_deadline} onChange={(event) => patch(index, { submission_deadline: event.target.value })} placeholder="2026-12-06 18:00" />
              </Field>
              <Field label="论文锁定时间（北京时间，可选）" htmlFor={`cohort-lock-${index}`} hint="到这个时间后，已经提交过的同学只能继续提交原来选的论文，不能再换；在这之前可以随便换，以最后一次提交为准。写法：2026-11-28 23:59，留空表示不锁定。">
                <Input id={`cohort-lock-${index}`} value={item.direction_lock_at || ''} onChange={(event) => patch(index, { direction_lock_at: event.target.value })} placeholder="2026-11-28 23:59" />
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
