import React from 'react';
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export const MEMBER_EXPERIENCE_TYPES = {
  education: {
    label: '教育经历',
    organization: '学校或教育机构',
    role: '学位或身份',
    field: '专业方向',
    organizationPlaceholder: '如：东华大学',
    rolePlaceholder: '如：工学学士、硕士研究生',
    fieldPlaceholder: '如：人工智能',
  },
  work: {
    label: '职业经历',
    organization: '公司或机构',
    role: '职位',
    field: '工作方向（可选）',
    organizationPlaceholder: '如：腾讯',
    rolePlaceholder: '如：算法工程师',
    fieldPlaceholder: '如：多模态与具身智能',
  },
  internship: {
    label: '实习经历',
    organization: '公司或机构',
    role: '实习职位',
    field: '工作方向（可选）',
    organizationPlaceholder: '如：某某研究院',
    rolePlaceholder: '如：算法实习生',
    fieldPlaceholder: '如：计算机视觉',
  },
  other: {
    label: '其他经历',
    organization: '机构名称',
    role: '身份或职位',
    field: '方向（可选）',
    organizationPlaceholder: '填写机构名称',
    rolePlaceholder: '填写身份或职位',
    fieldPlaceholder: '填写相关方向',
  },
};

export const createMemberExperience = () => ({
  id: globalThis.crypto?.randomUUID?.() || `experience-${Date.now()}`,
  type: 'education',
  start_date: '',
  end_date: '',
  is_current: false,
  organization: '',
  role: '',
  field: '',
  description: '',
});

const formatMonth = (value) => String(value || '').replace('-', '.');

export function MemberExperienceTimeline({ experiences = [], emptyMessage = '' }) {
  const visible = experiences.filter((item) => item?.organization || item?.role || item?.field);
  if (!visible.length) return emptyMessage ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null;

  return (
    <div className="relative space-y-7 pl-6 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
      {visible.map((item, index) => {
        const details = item.type === 'education'
          ? [item.field, item.role].filter(Boolean).join(' · ')
          : [item.role, item.field].filter(Boolean).join(' · ');
        const dateRange = [
          formatMonth(item.start_date),
          item.is_current ? '至今' : formatMonth(item.end_date),
        ].filter(Boolean).join(' - ');

        return (
          <article key={item.id || `${item.type}-${index}`} className="relative">
            <span className="absolute -left-6 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-primary bg-background" />
            {dateRange && <p className="font-mono-date text-xs text-muted-foreground">{dateRange}</p>}
            <h4 className="mt-1.5 text-base font-semibold text-foreground">{item.organization || '机构名称'}</h4>
            {details && <p className="mt-1 text-sm leading-6 text-foreground/75">{details}</p>}
            {item.description && <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">{item.description}</p>}
          </article>
        );
      })}
    </div>
  );
}

export default function MemberExperienceEditor({ value = [], onChange }) {
  const experiences = Array.isArray(value) ? value : [];
  const update = (id, field, nextValue) => {
    onChange(experiences.map((item) => (
      item.id === id
        ? { ...item, [field]: nextValue, ...(field === 'is_current' && nextValue ? { end_date: '' } : {}) }
        : item
    )));
  };
  const remove = (id) => onChange(experiences.filter((item) => item.id !== id));
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= experiences.length) return;
    const next = [...experiences];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {experiences.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          暂无经历。添加后将按这里的顺序显示在个人资料中。
        </div>
      )}

      {experiences.map((item, index) => {
        const type = MEMBER_EXPERIENCE_TYPES[item.type] || MEMBER_EXPERIENCE_TYPES.other;
        return (
          <article key={item.id} className="rounded-xl border border-border/80 bg-background/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/65 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  {item.type === 'education' ? <GraduationCap size={17} /> : <BriefcaseBusiness size={17} />}
                </span>
                <Select value={item.type} onValueChange={(nextValue) => update(item.id, 'type', nextValue)}>
                  <SelectTrigger className="h-10 w-40 border-border/85 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEMBER_EXPERIENCE_TYPES).map(([optionValue, option]) => (
                      <SelectItem key={optionValue} value={optionValue}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" disabled={index === 0} onClick={() => move(index, -1)} aria-label="上移这段经历"><ChevronUp size={16} /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" disabled={index === experiences.length - 1} onClick={() => move(index, 1)} aria-label="下移这段经历"><ChevronDown size={16} /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => remove(item.id)} aria-label="删除这段经历"><Trash2 size={16} /></Button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${item.id}-start`}>开始时间</Label>
                <Input id={`${item.id}-start`} type="month" value={item.start_date || ''} onChange={(event) => update(item.id, 'start_date', event.target.value)} className="h-11 border-border/85 bg-background" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${item.id}-end`}>结束时间</Label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={item.is_current === true} onCheckedChange={(checked) => update(item.id, 'is_current', checked === true)} /> 至今
                  </label>
                </div>
                <Input id={`${item.id}-end`} type="month" value={item.end_date || ''} disabled={item.is_current === true} onChange={(event) => update(item.id, 'end_date', event.target.value)} className="h-11 border-border/85 bg-background disabled:bg-secondary/60" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${item.id}-organization`}>{type.organization}</Label>
                <Input id={`${item.id}-organization`} value={item.organization || ''} onChange={(event) => update(item.id, 'organization', event.target.value)} className="h-11 border-border/85 bg-background" placeholder={type.organizationPlaceholder} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${item.id}-field`}>{type.field}</Label>
                <Input id={`${item.id}-field`} value={item.field || ''} onChange={(event) => update(item.id, 'field', event.target.value)} className="h-11 border-border/85 bg-background" placeholder={type.fieldPlaceholder} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${item.id}-role`}>{type.role}</Label>
                <Input id={`${item.id}-role`} value={item.role || ''} onChange={(event) => update(item.id, 'role', event.target.value)} className="h-11 border-border/85 bg-background" placeholder={type.rolePlaceholder} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${item.id}-description`}>补充说明（可选）</Label>
                <Textarea id={`${item.id}-description`} value={item.description || ''} onChange={(event) => update(item.id, 'description', event.target.value)} className="min-h-20 resize-y border-border/85 bg-background leading-6" placeholder="可以填写研究方向、负责内容或其他希望公开的信息" />
              </div>
            </div>
          </article>
        );
      })}

      <Button type="button" variant="outline" className="w-full border-dashed active:translate-y-px" onClick={() => onChange([...experiences, createMemberExperience()])}>
        <Plus size={16} />添加一段经历
      </Button>
    </div>
  );
}
