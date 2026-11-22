import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Eye } from 'lucide-react';
import { api } from '@/api/client';
import RecruitApplicants from '@/components/admin/RecruitApplicants';
import RecruitAssets from '@/components/admin/RecruitAssets';
import RecruitCohortSettings from '@/components/admin/RecruitCohortSettings';
import RecruitPagesEditor from '@/components/admin/RecruitPagesEditor';
import RecruitPublishPanel from '@/components/admin/RecruitPublishPanel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RecruitAdmin() {
  const [cohorts, setCohorts] = useState(null);
  const [error, setError] = useState('');
  const [cohortId, setCohortId] = useState('');

  const load = useCallback(() => api.recruitAdmin.cohorts()
    .then((result) => {
      setCohorts(result);
      setCohortId((current) => (result.some((item) => item.id === current) ? current : (result.find((item) => item.status === 'current') || result[0])?.id || ''));
      setError('');
    })
    .catch((requestError) => setError(requestError.message || '加载失败')), []);

  useEffect(() => { load(); }, [load]);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!cohorts) return <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>;

  const cohort = cohorts.find((item) => item.id === cohortId) || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-foreground">招新批次</span>
        {cohorts.length > 0 && (
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger className="h-9 w-auto min-w-[11rem] bg-card" aria-label="选择招新批次"><SelectValue /></SelectTrigger>
            <SelectContent>{cohorts.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <div className="ml-auto flex gap-2">
          {cohort && <Button asChild variant="outline" size="sm" className="gap-1.5"><a href={`/recruit/${encodeURIComponent(cohort.id)}?preview=1`} target="_blank" rel="noreferrer"><Eye size={14} aria-hidden="true" /> 预览发布效果</a></Button>}
          {cohort && cohort.status !== 'draft' && <Button asChild variant="outline" size="sm" className="gap-1.5"><a href={`/recruit/${encodeURIComponent(cohort.id)}`} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> 查看招新页面</a></Button>}
          {cohort && cohort.status !== 'draft' && <Button asChild variant="outline" size="sm"><a href={`/recruit/${encodeURIComponent(cohort.id)}/submissions`} target="_blank" rel="noreferrer">收到的提交</a></Button>}
        </div>
      </div>

      {cohort && <RecruitPublishPanel key={cohort.id} cohort={cohort} cohorts={cohorts} onChanged={load} />}

      <Tabs defaultValue={cohort ? 'pages' : 'cohorts'} key={cohort ? 'with-cohort' : 'empty'}>
        <TabsList className="h-auto bg-secondary/50 p-1">
          {cohort && <TabsTrigger value="pages">文档</TabsTrigger>}
          {cohort && <TabsTrigger value="assets">图片与附件</TabsTrigger>}
          <TabsTrigger value="cohorts">批次设置</TabsTrigger>
          <TabsTrigger value="applicants">报名账号</TabsTrigger>
        </TabsList>
        {cohort && <TabsContent value="pages" className="mt-5"><RecruitPagesEditor key={cohort.id} cohort={cohort} /></TabsContent>}
        {cohort && <TabsContent value="assets" className="mt-5"><RecruitAssets key={cohort.id} cohortId={cohort.id} /></TabsContent>}
        <TabsContent value="applicants" className="mt-5"><RecruitApplicants /></TabsContent>
        <TabsContent value="cohorts" className="mt-5">
          {cohorts.length === 0 && <p className="mb-4 rounded-lg border border-border/75 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">还没有招新批次。先添加一个，再回来写文档。</p>}
          <RecruitCohortSettings cohorts={cohorts} onRenamed={(id, list) => { setCohorts(list); setCohortId(id); }} onSaved={(saved) => { setCohorts(saved.map((item) => ({ description: '', directions: [], submissions: true, submission_deadline: '', ...item }))); load(); }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
