import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Eye } from 'lucide-react';
import { api } from '@/api/client';
import { ContentLoading, EmptyState } from '@/components/ContentState';
import RecruitDocs, { recruitPath } from '@/components/recruit/RecruitDocs';
import { recruitSectionPath } from '@/lib/recruit';
import ApplicantGate from '@/components/recruit/ApplicantGate';
import SubmissionForm from '@/components/recruit/SubmissionForm';
import SubmissionTimes from '@/components/recruit/SubmissionTimes';
import SubmissionReview from '@/components/recruit/SubmissionReview';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useDocumentTitle from '@/hooks/use-document-title';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const STATUS_LABELS = { current: '本次招新', archived: '往期', upcoming: '即将开始', draft: '未发布' };
const STATUS_STYLES = {
  current: 'bg-primary text-primary-foreground',
  archived: 'bg-muted text-muted-foreground',
  upcoming: 'bg-amber/25 text-amber-foreground',
  draft: 'bg-amber/25 text-amber-foreground',
};

const pickDefaultCohort = (cohorts) => (
  cohorts.find((cohort) => cohort.status === 'current')
  || [...cohorts].reverse().find((cohort) => cohort.status !== 'upcoming' && cohort.status !== 'draft')
  || cohorts[0]
);

const viewOf = (slug) => (slug === 'submit' || slug === 'submissions' ? slug : 'docs');

function StatusBadge({ status }) {
  return <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', STATUS_STYLES[status] || STATUS_STYLES.archived)}>{STATUS_LABELS[status] || STATUS_LABELS.archived}</span>;
}

function Shell({ switcher = null, tabs = null, children }) {
  return (
    <div className="page-shell pb-20 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-primary">
            <span className="h-px w-5 bg-primary/55" aria-hidden="true" />
            <span className="font-mono-date text-[10px] font-medium uppercase tracking-[0.18em] sm:text-[11px]">Recruitment</span>
          </div>
          <p className="mt-3.5 font-display text-[2rem] font-bold leading-[1.16] tracking-[-0.03em] text-foreground sm:text-[2.5rem]">招新</p>
        </div>
        {switcher}
      </div>
      {tabs}
      {children}
    </div>
  );
}

function PreviewBanner({ cohort }) {
  const unpublished = cohort.status === 'draft';
  return (
    <div role="status" className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber/60 bg-amber/15 px-4 py-3 text-sm text-amber-foreground">
      <span className="inline-flex items-center gap-1.5 font-semibold"><Eye size={15} aria-hidden="true" /> 预览模式</span>
      <span className="min-w-0 flex-1">
        这是「{cohort.label}」发布后访客会看到的样子{unpublished ? '，目前还没有发布，访客看不到' : ''}。标有“草稿”的文档只有在发布时选择“同时发布草稿”才会公开，提交表单在预览里不能提交。
      </span>
      <Link to={recruitPath(cohort.id)} className="shrink-0 font-medium underline underline-offset-2 hover:text-foreground">退出预览</Link>
    </div>
  );
}

function SectionTabs({ cohortId, view, hasSubmit, signedIn, preview }) {
  const tabs = [
    { view: 'docs', label: '文档', to: recruitPath(cohortId, undefined, { preview }) },
    ...(hasSubmit ? [{ view: 'submit', label: '提交', to: recruitSectionPath(cohortId, 'submit', { preview }) }] : []),
    ...(signedIn && !preview ? [{ view: 'submissions', label: '收到的提交', to: recruitSectionPath(cohortId, 'submissions') }] : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="招新栏目" className="mt-8 flex gap-1 overflow-x-auto border-b border-border/75">
      {tabs.map((tab) => (
        <Link
          key={tab.view}
          to={tab.to}
          aria-current={tab.view === view ? 'page' : undefined}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            tab.view === view ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export default function Recruit() {
  const { cohort: cohortId, slug, submissionId } = useParams();
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1' && user?.role === 'admin';
  const [cohorts, setCohorts] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isLoadingAuth) return undefined;
    let cancelled = false;
    setCohorts(null);
    setFailed(false);
    api.docs.cohorts({ preview })
      .then((result) => { if (!cancelled) setCohorts(result || []); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [preview, isLoadingAuth]);

  const cohort = cohorts?.find((item) => item.id === cohortId) || null;
  const view = submissionId ? 'submissions' : viewOf(slug);
  useDocumentTitle(cohort && view === 'submit' ? `提交 · ${cohort.label} · AILAB` : '');

  if (failed) return <Shell><EmptyState title="内容暂时无法加载" description="请稍后刷新页面重试。" icon={BookOpen} /></Shell>;
  if (!cohorts) return <Shell><ContentLoading /></Shell>;

  if (!cohortId) {
    const target = pickDefaultCohort(cohorts);
    return target ? <Navigate to={recruitPath(target.id, undefined, { preview })} replace /> : <Shell><EmptyState title="招新内容还在准备中" icon={BookOpen} /></Shell>;
  }

  if (!cohort) {
    return (
      <Shell>
        <EmptyState title="没有找到这一期招新" description="请从招新批次列表中重新选择。" icon={BookOpen} />
        <p className="mt-6 text-center text-sm"><Link to="/recruit" className="font-medium text-primary hover:text-foreground">返回招新</Link></p>
      </Shell>
    );
  }

  const switcher = (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={cohort.id} onValueChange={(value) => navigate(recruitPath(value, undefined, { preview }))}>
        <SelectTrigger className="h-10 w-auto min-w-[12rem] gap-3 bg-card font-medium" aria-label="选择招新批次"><SelectValue /></SelectTrigger>
        <SelectContent>{cohorts.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
      <StatusBadge status={cohort.status} />
      {cohort.description && <span className="text-sm text-muted-foreground">{cohort.description}</span>}
    </div>
  );

  const hasSubmit = cohort.status === 'current' || cohort.submission.open;
  const tabs = <SectionTabs cohortId={cohort.id} view={view} hasSubmit={hasSubmit} signedIn={Boolean(user)} preview={preview} />;

  return (
    <Shell switcher={switcher} tabs={<>{preview && <PreviewBanner cohort={cohort} />}{tabs}</>}>
      {view === 'docs' && <RecruitDocs key={cohort.id} cohort={cohort} slug={slug} preview={preview} />}
      {view === 'submit' && (
        <div className="mx-auto mt-8 w-full max-w-2xl">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-4xl">提交</h1>
          <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">先注册或登录报名账号，再选论文、填联系方式、上传文件。姓名、学号、年级、专业来自账号，文件会按“方向_姓名_学号_年级_专业_版本”统一命名，方便实验室整理。</p>
          <SubmissionTimes submission={cohort.submission} />
          {cohort.submission.open ? (
            <ApplicantGate grades={cohort.submission.grades} preview={preview}>
              {(applicant) => <SubmissionForm cohort={cohort} applicant={applicant} preview={preview} />}
            </ApplicantGate>
          ) : <SubmissionForm cohort={cohort} preview={preview} />}
        </div>
      )}
      {view === 'submissions' && !preview && <SubmissionReview key={cohort.id} cohort={cohort} submissionId={submissionId} />}
    </Shell>
  );
}
