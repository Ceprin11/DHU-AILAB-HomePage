import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Inbox, Loader2, MousePointerClick, Search, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import { SidebarLayout, SidebarLink } from '@/components/recruit/SidebarLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import useDocumentTitle from '@/hooks/use-document-title';
import { useAuth } from '@/lib/AuthContext';
import { fieldOfDirection, formatBeijingTime, formatFileSize, groupSubmissions, sectionSubmissionGroups, submissionFileUrl } from '@/lib/recruit';
import { cn } from '@/lib/utils';

const FilePreview = lazy(() => import('@/components/recruit/FilePreview'));

const submissionsPath = (cohortId, id) => `/recruit/${encodeURIComponent(cohortId)}/submissions${id ? `/${encodeURIComponent(id)}` : ''}`;
const groupLabel = (direction) => direction || '未选方向';
const contactLine = (row) => [row.qq && `QQ ${row.qq}`, row.wechat && `微信 ${row.wechat}`, row.email].filter(Boolean).join(' / ');

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;

const exportCsv = (cohortId, rows) => {
  const header = ['提交时间', '方向', '姓名', '学号', '年级', '专业', 'QQ', '微信', '邮箱', '版本', '文件名', '备注'];
  const lines = rows.map((row) => [formatBeijingTime(row.created_at), row.direction, row.name, row.student_id, row.grade, row.major, row.qq, row.wechat, row.email, `v${row.version}`, row.final_name, row.note]);
  const csv = `\uFEFF${[header, ...lines].map((line) => line.map(escapeCsv).join(',')).join('\r\n')}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `${cohortId}-提交名单.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export default function SubmissionReview({ cohort, submissionId }) {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    api.recruit.submissions(cohort.id)
      .then((result) => { if (!cancelled) { setRows(result); setError(''); } })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || '加载失败'); });
    return () => { cancelled = true; };
  }, [cohort.id, user]);

  const grouped = useMemo(() => (rows ? groupSubmissions(rows, cohort.submission.directions) : null), [rows, cohort.submission.directions]);

  const visibleGroups = useMemo(() => {
    if (!grouped) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return grouped.groups;
    return grouped.groups
      .map((group) => ({ ...group, people: group.people.filter((person) => [person.name, person.student_id, person.major, group.direction].some((value) => String(value).toLowerCase().includes(needle))) }))
      .filter((group) => group.people.length > 0);
  }, [grouped, query]);

  const sections = useMemo(() => sectionSubmissionGroups(visibleGroups, cohort.submission.groups), [visibleGroups, cohort.submission.groups]);

  const person = grouped?.people.find((item) => item.versions.some((version) => version.id === submissionId)) || null;
  const selected = person?.versions.find((version) => version.id === submissionId) || null;
  useDocumentTitle(person ? `${person.name} · 收到的提交 · ${cohort.label} · AILAB` : `收到的提交 · ${cohort.label} · AILAB`);

  const remove = async () => {
    if (!selected || removing) return;
    if (!window.confirm(`确定删除「${selected.final_name}」吗？文件会被永久删除，无法恢复。`)) return;
    setRemoving(true);
    try {
      await api.recruit.removeSubmission(selected.id);
      const remaining = rows.filter((row) => row.id !== selected.id);
      setRows(remaining);
      const sibling = person.versions.find((version) => version.id !== selected.id);
      navigate(submissionsPath(cohort.id, sibling?.id));
    } catch (removeError) {
      window.alert(removeError.message || '删除失败');
    } finally {
      setRemoving(false);
    }
  };

  if (isLoadingAuth) return <ContentLoading className="mt-8" />;
  if (!user) {
    return (
      <div className="mt-8 rounded-xl border border-border/75 bg-secondary/30 px-6 py-12 text-center">
        <p className="text-base font-semibold text-foreground">请先登录实验室账号</p>
        <p className="mt-1.5 text-sm text-muted-foreground">登录后即可查看并预览同学们提交的文件。</p>
        <Button asChild className="mt-5"><Link to="/admin-login">去登录</Link></Button>
      </div>
    );
  }
  if (error) return <EmptyState title="提交列表暂时无法加载" description={error} icon={Inbox} />;
  if (!rows) return <ContentLoading className="mt-8" />;
  if (rows.length === 0) return <EmptyState title="还没有收到提交" description="同学们提交后会出现在这里。" icon={Inbox} />;

  const sidebar = (
    <div>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、学号、论文" aria-label="搜索同学" className="h-9 bg-card pl-9 text-sm" />
      </div>
      <p className="mb-4 mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>共 {grouped.people.length} 人 · {rows.length} 份</span>
        {isAdmin && <button type="button" onClick={() => exportCsv(cohort.id, rows)} className="inline-flex items-center gap-1 font-medium text-primary hover:text-foreground"><Download size={12} aria-hidden="true" /> 导出名单</button>}
      </p>
      {visibleGroups.length === 0 && <p className="px-1 text-sm text-muted-foreground">没有符合条件的同学</p>}
      <nav aria-label="同学列表" className="space-y-6">
        {sections.map((section) => (
          <div key={section.name || 'rest'} className="space-y-4">
            {section.name && <h2 className="border-b border-border/75 pb-1 font-display text-sm font-bold tracking-[-0.01em] text-foreground">{section.name}</h2>}
            {section.groups.map((group) => (
              <section key={group.direction || 'none'} aria-label={groupLabel(group.direction)}>
                <h3 className="mb-1 flex items-center justify-between pr-2 font-mono-date text-[11px] font-medium tracking-[0.08em] text-muted-foreground">
                  <span>{groupLabel(group.direction)}</span><span>{group.people.length}</span>
                </h3>
                <ul className="space-y-0.5 border-l border-border/75">
                  {group.people.map((item) => (
                    <li key={item.key}>
                      <SidebarLink to={submissionsPath(cohort.id, item.latest.id)} active={item.key === person?.key}>
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate">{item.name}<span className="ml-1.5 text-xs font-normal text-muted-foreground">{item.student_id}</span></span>
                          {item.versions.length > 1 && <span className="shrink-0 rounded bg-amber/25 px-1.5 text-[11px] font-semibold text-amber-foreground">v{item.latest.version}</span>}
                        </span>
                      </SidebarLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );

  const mobile = (
    <Select value={person?.key} onValueChange={(key) => navigate(submissionsPath(cohort.id, grouped.people.find((item) => item.key === key).latest.id))}>
      <SelectTrigger className="h-10 w-full bg-card" aria-label="选择同学"><SelectValue placeholder={`选择同学（共 ${grouped.people.length} 人）`} /></SelectTrigger>
      <SelectContent>
        {grouped.groups.map((group) => (
          <SelectGroup key={group.direction || 'none'}>
            <SelectLabel>{[fieldOfDirection(cohort.submission.groups, group.direction), groupLabel(group.direction)].filter(Boolean).join(' · ')}</SelectLabel>
            {group.people.map((item) => <SelectItem key={item.key} value={item.key}>{item.name} {item.student_id}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <SidebarLayout sidebar={sidebar} mobile={mobile}>
      {!selected ? (
        <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-secondary/20 px-6 text-center">
          <MousePointerClick size={22} strokeWidth={1.6} className="text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{submissionId ? '没有找到这份提交，可能已被删除。' : '从左侧选择一位同学，查看 TA 提交的文件。'}</p>
        </div>
      ) : (
        <article>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">{person.name}<span className="ml-2 text-base font-normal text-muted-foreground">{person.student_id}</span></h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{[person.direction, person.grade, person.major].filter(Boolean).join(' · ')}</p>
              {isAdmin && contactLine(selected) && <p className="mt-1 text-sm text-muted-foreground">{contactLine(selected)}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5"><a href={submissionFileUrl(selected.id, { download: true })}><Download size={14} aria-hidden="true" /> 下载</a></Button>
              {isAdmin && <Button type="button" variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" disabled={removing} onClick={remove}>{removing ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />} 删除</Button>}
            </div>
          </header>

          {person.versions.length > 1 && (
            <nav aria-label="版本" className="mt-5 flex flex-wrap gap-2">
              {person.versions.map((version) => (
                <Link
                  key={version.id}
                  to={submissionsPath(cohort.id, version.id)}
                  aria-current={version.id === selected.id ? 'page' : undefined}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    version.id === selected.id ? 'border-primary bg-accent/50 font-semibold text-primary' : 'border-border/75 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {person.switchedPaper && `${version.direction} `}v{version.version}{version.id === person.latest.id && '（最新）'} · {formatBeijingTime(version.created_at)}
                </Link>
              ))}
            </nav>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="break-all font-mono text-foreground">{selected.final_name}</span>
            <span>{formatFileSize(selected.size)}</span>
            <span>{formatBeijingTime(selected.created_at)}</span>
          </div>
          {selected.note && <p className="mt-3 whitespace-pre-line rounded-lg border border-border/75 bg-card px-4 py-3 text-sm text-foreground/90">备注：{selected.note}</p>}

          <div className="mt-5">
            <Suspense fallback={<ContentLoading className="mt-0" count={1} />}>
              <FilePreview key={selected.id} submission={selected} />
            </Suspense>
          </div>
        </article>
      )}
    </SidebarLayout>
  );
}
