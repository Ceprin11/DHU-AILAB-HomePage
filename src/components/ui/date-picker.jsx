import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { zhCN } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const pad = (value) => String(value).padStart(2, '0');
const localDateValue = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateValue = (value) => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return undefined;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const formatDateLabel = (value, includeTime) => {
  const selected = parseDateValue(value);
  if (!selected) return '';
  const label = `${selected.getFullYear()}年${selected.getMonth() + 1}月${selected.getDate()}日`;
  return includeTime && String(value).includes('T') ? `${label} ${String(value).slice(11, 16)}` : label;
};

export function DatePicker({ id, value, onChange, includeTime = false, placeholder = '选择日期', className, disabled = false }) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const timeValue = includeTime && String(value || '').includes('T') ? String(value).slice(11, 16) : '09:00';

  const selectDate = (date) => {
    if (!date) return;
    const nextDate = localDateValue(date);
    onChange(includeTime ? `${nextDate}T${timeValue}` : nextDate);
    if (!includeTime) setOpen(false);
  };

  const selectToday = () => {
    const today = localDateValue();
    onChange(includeTime ? `${today}T${timeValue}` : today);
    if (!includeTime) setOpen(false);
  };

  const changeTime = (event) => {
    const nextTime = event.target.value;
    if (!nextTime) return;
    onChange(`${String(value || '').slice(0, 10) || localDateValue()}T${nextTime}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center gap-2.5 rounded-md border border-border/85 bg-background px-3 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:opacity-60',
            className,
          )}
        >
          <CalendarDays size={16} className="shrink-0 text-primary" />
          <span className={cn('min-w-0 flex-1 truncate', value ? 'font-medium text-foreground' : 'text-muted-foreground')}>{formatDateLabel(value, includeTime) || placeholder}</span>
          <ChevronDown size={15} className="shrink-0 text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={7} className="w-auto rounded-2xl border-border/80 bg-background p-2 shadow-[0_20px_60px_hsl(var(--foreground)/0.15)]">
        <div className="px-2 pb-1 pt-1">
          <p className="font-display text-sm font-semibold text-foreground">{includeTime ? '选择日期与时间' : '选择日期'}</p>
          <p className="mt-0.5 font-mono-date text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Date picker</p>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={selectDate}
          locale={zhCN}
          initialFocus
          className="rounded-xl bg-secondary/30"
          classNames={{
            day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-sm',
            day_today: 'border border-primary/30 bg-accent text-primary font-semibold',
          }}
        />
        {includeTime && (
          <div className="mx-2 flex items-center gap-3 border-t border-border py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary"><Clock3 size={15} /></span>
            <label htmlFor={`${id || 'date'}-time`} className="text-xs font-medium text-muted-foreground">具体时间</label>
            <input id={`${id || 'date'}-time`} type="time" value={timeValue} onChange={changeTime} className="ml-auto h-9 rounded-md border border-border/85 bg-background px-2.5 text-sm font-medium shadow-sm outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 pt-2">
          <button type="button" onClick={() => onChange('')} className="rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">清除</button>
          <div className="flex items-center gap-1">
            <button type="button" onClick={selectToday} className="rounded-lg px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent">今天</button>
            {includeTime && <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">完成</button>}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const monthLabels = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export function MonthPicker({ id, value, onChange, placeholder = '选择月份', className, disabled = false }) {
  const currentYear = Number(String(value || '').slice(0, 4)) || new Date().getFullYear();
  const selectedMonth = Number(String(value || '').slice(5, 7)) || 0;
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(currentYear);

  useEffect(() => {
    if (open) setVisibleYear(currentYear);
  }, [currentYear, open]);

  const chooseMonth = (monthIndex) => {
    onChange(`${visibleYear}-${pad(monthIndex + 1)}`);
    setOpen(false);
  };

  const chooseCurrentMonth = () => {
    const today = new Date();
    onChange(`${today.getFullYear()}-${pad(today.getMonth() + 1)}`);
    setOpen(false);
  };

  const label = value ? `${String(value).slice(0, 4)}年${Number(String(value).slice(5, 7))}月` : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-11 w-full items-center gap-2.5 rounded-md border border-border/85 bg-background px-3 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-secondary/60 disabled:opacity-60',
            className,
          )}
        >
          <CalendarDays size={16} className="shrink-0 text-primary" />
          <span className={cn('min-w-0 flex-1 truncate', value ? 'font-medium text-foreground' : 'text-muted-foreground')}>{label || placeholder}</span>
          <ChevronDown size={15} className="shrink-0 text-muted-foreground/70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={7} className="w-[19rem] rounded-2xl border-border/80 bg-background p-3 shadow-[0_20px_60px_hsl(var(--foreground)/0.15)]">
        <div className="flex items-center justify-between rounded-xl bg-secondary/45 p-1.5">
          <button type="button" onClick={() => setVisibleYear((year) => year - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground" aria-label="上一年"><ChevronLeft size={16} /></button>
          <div className="text-center"><p className="font-display text-sm font-semibold text-foreground">{visibleYear} 年</p><p className="font-mono-date text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Select month</p></div>
          <button type="button" onClick={() => setVisibleYear((year) => year + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground" aria-label="下一年"><ChevronRight size={16} /></button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {monthLabels.map((month, index) => {
            const isSelected = visibleYear === currentYear && selectedMonth === index + 1;
            return <button key={month} type="button" onClick={() => chooseMonth(index)} className={cn('rounded-lg px-2 py-2.5 text-sm transition-colors', isSelected ? 'bg-primary font-semibold text-primary-foreground shadow-sm' : 'text-foreground hover:bg-accent hover:text-primary')}>{month}</button>;
          })}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
          <button type="button" onClick={() => onChange('')} className="rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">清除</button>
          <button type="button" onClick={chooseCurrentMonth} className="rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-accent">本月</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
