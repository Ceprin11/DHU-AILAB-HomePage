import React from 'react';
import { CalendarClock, Lock } from 'lucide-react';
import { formatBeijingTime } from '@/lib/recruit';
import { cn } from '@/lib/utils';

const DAY = 24 * 60 * 60 * 1000;

// "还剩 3 天", "还剩 5 小时", or the passed label once the moment is over.
const remaining = (iso, now, passedLabel) => {
  const left = new Date(iso).getTime() - now.getTime();
  if (!Number.isFinite(left)) return null;
  if (left <= 0) return { text: passedLabel, passed: true };
  if (left >= DAY) return { text: `还剩 ${Math.floor(left / DAY)} 天`, passed: false };
  const hours = Math.floor(left / (60 * 60 * 1000));
  return { text: hours >= 1 ? `还剩 ${hours} 小时` : '不到 1 小时', passed: false };
};

function Row({ icon: Icon, title, time, status, children }) {
  return (
    <li className="flex gap-3 px-4 py-3.5 sm:px-5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon size={16} strokeWidth={1.8} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="font-mono text-sm text-foreground">{time}<span className="ml-1 font-sans text-xs text-muted-foreground">北京时间</span></p>
          {status && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.passed ? 'bg-secondary text-muted-foreground' : 'bg-amber/25 text-amber-foreground')}>{status.text}</span>
          )}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

// The two dates that matter to an applicant: when the paper choice locks, and when submissions close.
export default function SubmissionTimes({ submission, now = new Date() }) {
  const lock = submission.directions?.length ? submission.directionLock : null;
  const deadline = submission.deadline || '';
  if (!lock && !deadline) return null;

  const rows = [
    lock && { key: 'lock', at: lock.at },
    deadline && { key: 'deadline', at: deadline },
  ].filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <section aria-label="时间安排" className="mb-6 overflow-hidden rounded-xl border border-border/75 bg-card/60">
      <ul className="divide-y divide-border/70">
        {rows.map((row) => (row.key === 'lock' ? (
          <Row key="lock" icon={Lock} title="论文锁定" time={formatBeijingTime(lock.at)} status={remaining(lock.at, now, '已锁定')}>
            {lock.locked
              ? '已经提交过的同学只能继续提交原来选的论文；还没提交过的同学可以选一篇，提交后同样锁定。'
              : '在这之前可以随时更换论文，以最后一次提交为准；到点后不能再换。'}
          </Row>
        ) : (
          <Row key="deadline" icon={CalendarClock} title="提交截止" time={formatBeijingTime(deadline)} status={remaining(deadline, now, '已截止')}>
            截止前可以多次提交，之前的版本都会保留；到点后提交入口关闭。
          </Row>
        )))}
      </ul>
    </section>
  );
}
