import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Eye, EyeOff, Loader2, Rocket, Undo2, XCircle } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';

const STATUS_TEXT = { draft: '未发布', current: '本次招新', upcoming: '即将开始', archived: '往期' };

export default function RecruitPublishPanel({ cohort, cohorts, onChanged }) {
  const [pages, setPages] = useState(null);
  const [withDrafts, setWithDrafts] = useState(true);
  const [when, setWhen] = useState('');
  const [status, setStatus] = useState({ busy: '', error: '', notice: '' });

  useEffect(() => {
    let cancelled = false;
    setPages(null);
    api.recruitAdmin.pages(cohort.id).then((result) => { if (!cancelled) setPages(result); }).catch(() => { if (!cancelled) setPages([]); });
    return () => { cancelled = true; };
  }, [cohort.id, cohort.status]);

  useEffect(() => { setWithDrafts(cohort.publish_drafts !== false); setWhen(''); setStatus({ busy: '', error: '', notice: '' }); }, [cohort.id, cohort.publish_drafts]);

  const draftCount = pages ? pages.filter((page) => page.draft).length : 0;
  const hasIndex = Boolean(pages?.some((page) => page.slug === 'index'));
  const previousCurrent = cohorts.find((item) => item.status === 'current' && item.id !== cohort.id);
  const isDraft = cohort.status === 'draft';

  const run = async (name, action, notice) => {
    setStatus({ busy: name, error: '', notice: '' });
    try {
      const result = await action();
      setStatus({ busy: '', error: '', notice: typeof notice === 'function' ? notice(result) : notice });
      onChanged();
    } catch (error) {
      setStatus({ busy: '', error: error.message || '操作失败', notice: '' });
    }
  };

  const publishNow = () => {
    const lines = [
      `现在发布「${cohort.label}」？`,
      '',
      '· 访客立刻可以看到这一期的文档和提交入口。建议先点“预发布”确认效果。',
      previousCurrent ? `· 原来的“本次招新”「${previousCurrent.label}」会转为“往期”。` : '',
      withDrafts && draftCount ? `· ${draftCount} 篇草稿文档会同时发布。` : '',
      !withDrafts && draftCount ? `· ${draftCount} 篇草稿文档仍保持草稿，访客看不到。` : '',
    ].filter((line, index) => line || index === 1);
    if (!window.confirm(lines.join('\n'))) return;
    run('publish', () => api.recruitAdmin.publish(cohort.id, withDrafts), (result) => `已发布。${result.published ? `同时发布了 ${result.published} 篇草稿文档。` : ''}`);
  };

  const schedule = () => {
    if (!when) return setStatus({ busy: '', error: '请先选择发布时间', notice: '' });
    run('schedule', () => api.recruitAdmin.schedule(cohort.id, when, withDrafts), '已设置定时发布。');
  };

  const submissionsOn = cohort.submissions !== false;
  const submissionNote = !submissionsOn
    ? (cohort.status === 'current' ? '已关闭：访客打开“提交”页只会看到“本期暂不接收提交”，不能上传文件。' : '已关闭：这一期成为本次招新后也不会开放提交。')
    : isDraft ? '发布后对访客开放。'
      : cohort.status === 'current' ? (cohort.submission_state?.open ? '访客现在可以提交。' : `开关已打开，但访客现在不能提交：${cohort.submission_state?.reason || '未知原因'}。`)
        : '只有“本次招新”接收提交。';

  const toggleSubmissions = (open) => run(
    'submissions',
    () => api.recruitAdmin.setSubmissionsOpen(cohort.id, open),
    open ? '已打开提交入口。' : '已关闭提交入口，访客现在不能提交。',
  );

  const unpublish = () => {
    if (!window.confirm(`撤回「${cohort.label}」？\n\n撤回后访客立刻看不到这一期的文档和提交入口，已收到的提交不会丢失。\n\n注意：之前因为发布而转为“往期”的批次不会自动恢复，需要的话到“批次设置”里手动改回。`)) return;
    run('unpublish', () => api.recruitAdmin.unpublish(cohort.id), '已撤回为未发布。');
  };

  return (
    <section aria-label="发布" className="rounded-xl border border-border/75 bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${isDraft ? 'bg-amber/25 text-amber-foreground' : 'bg-primary text-primary-foreground'}`}>
          {isDraft ? <EyeOff size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}{STATUS_TEXT[cohort.status] || cohort.status}
        </span>
        <p className="text-sm text-muted-foreground">
          {isDraft
            ? (cohort.publish_at ? `已设定在 ${cohort.publish_at}（北京时间）自动发布，在此之前访客看不到。` : '尚未发布，访客看不到这一期的任何内容。')
            : '已对访客公开。'}
        </p>
        {!isDraft && <Button type="button" variant="outline" size="sm" className="ml-auto gap-1.5" disabled={Boolean(status.busy)} onClick={unpublish}>{status.busy === 'unpublish' ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Undo2 size={14} aria-hidden="true" />} 撤回发布</Button>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/75 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Switch checked={submissionsOn} disabled={Boolean(status.busy)} onCheckedChange={toggleSubmissions} aria-label="开放提交入口" />
          开放提交入口
          {status.busy === 'submissions' && <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden="true" />}
        </label>
        <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
          {submissionNote}
          {cohort.direction_lock_at ? ` 论文锁定时间：${cohort.direction_lock_at}（北京时间）。` : ' 未设置论文锁定时间。'}
        </p>
      </div>

      {isDraft && (
        <div className="mt-4 space-y-4 border-t border-border/75 pt-4">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <li>{hasIndex ? '✓' : '○'} 总招新文档（index）</li>
            <li>文档 {pages ? pages.length : '…'} 篇，其中草稿 {pages ? draftCount : '…'} 篇</li>
            <li>{cohort.directions.length ? `✓ 已配置 ${cohort.directions.length} 个选择方向${cohort.groups?.length ? `，分成 ${cohort.groups.length} 组` : ''}` : '○ 还没有配置选择方向'}</li>
            <li>{cohort.submission_deadline ? `✓ 提交截止 ${cohort.submission_deadline}` : '○ 未设提交截止时间'}</li>
          </ul>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={withDrafts} onCheckedChange={setWithDrafts} aria-label="同时发布草稿文档" />
            发布时同时发布所有草稿文档{draftCount > 0 && <span className="text-xs text-muted-foreground">（{draftCount} 篇）</span>}
          </label>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <Button asChild variant="outline" className="gap-1.5">
              <a href={`/recruit/${encodeURIComponent(cohort.id)}?preview=1`} target="_blank" rel="noreferrer"><Eye size={15} aria-hidden="true" /> 预发布（看发布后的样子）</a>
            </Button>
            <Button type="button" className="gap-1.5" disabled={Boolean(status.busy)} onClick={publishNow}>
              {status.busy === 'publish' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Rocket size={15} aria-hidden="true" />} 立即发布
            </Button>

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <label htmlFor="publish-at" className="block text-xs font-medium text-muted-foreground">定时发布（北京时间）</label>
                <DatePicker id="publish-at" includeTime timeZone="Asia/Shanghai" value={when} onChange={setWhen} placeholder="选择发布时间" disablePast className="h-9 w-56" />
              </div>
              <Button type="button" variant="outline" className="gap-1.5" disabled={Boolean(status.busy)} onClick={schedule}>
                {status.busy === 'schedule' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CalendarClock size={15} aria-hidden="true" />} {cohort.publish_at ? '改期' : '设置定时'}
              </Button>
              {cohort.publish_at && (
                <Button type="button" variant="ghost" className="gap-1.5" disabled={Boolean(status.busy)} onClick={() => run('cancel', () => api.recruitAdmin.cancelSchedule(cohort.id), '已取消定时发布。')}>
                  <XCircle size={15} aria-hidden="true" /> 取消定时
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">到点后系统会自动发布；即使当时服务器正好重启，也会在下一次有人访问时补上。</p>
        </div>
      )}

      {status.error && <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{status.error}</p>}
      {status.notice && <p role="status" className="mt-3 rounded-lg border border-primary/25 bg-accent/40 px-4 py-2.5 text-sm text-foreground">{status.notice}</p>}
    </section>
  );
}
