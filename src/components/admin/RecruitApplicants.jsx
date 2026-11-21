import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Search, Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBeijingTime } from '@/lib/recruit';

// Accounts that applicants registered on the submit page. They are not members and can only fill in the application.
export default function RecruitApplicants() {
  const [applicants, setApplicants] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reset, setReset] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api.recruitAdmin.applicants()
    .then((result) => { setApplicants(result); setError(''); })
    .catch((requestError) => setError(requestError.message || '加载失败')), []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!applicants || !needle) return applicants || [];
    return applicants.filter((item) => [item.name, item.student_id, item.major, item.grade].some((value) => String(value).toLowerCase().includes(needle)));
  }, [applicants, query]);

  const resetPassword = async (item) => {
    if (!window.confirm(`重置「${item.name}（${item.student_id}）」的密码？\n\n会生成一个临时密码，原密码和他已登录的设备立刻失效。临时密码只显示这一次，请转告本人，并提醒他登录后修改。`)) return;
    setBusyId(item.id);
    setReset(null);
    try {
      setReset(await api.recruitAdmin.resetApplicantPassword(item.id));
      setCopied(false);
      await load();
    } catch (requestError) {
      window.alert(requestError.message || '重置失败');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (item) => {
    const note = item.submission_count > 0 ? `\n\n他已经提交了 ${item.submission_count} 份文件，这些文件会保留，只删除账号。` : '';
    if (!window.confirm(`删除报名账号「${item.name}（${item.student_id}）」？${note}\n\n删除后他可以重新注册这个学号。`)) return;
    setBusyId(item.id);
    try {
      await api.recruitAdmin.removeApplicant(item.id);
      if (reset?.student_id === item.student_id) setReset(null);
      await load();
    } catch (requestError) {
      window.alert(requestError.message || '删除失败');
    } finally {
      setBusyId('');
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(reset.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('复制临时密码', reset.password);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        同学在“提交”页注册的账号。这种账号只能用来提交，看不到任何人的提交，也进不了成员页面和后台。同学忘记密码时，在这里重置，把临时密码转告他即可。
      </p>

      {reset && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-accent/40 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1 text-foreground">
            「{reset.name}（{reset.student_id}）」的临时密码：<code className="ml-1 rounded bg-card px-2 py-0.5 font-mono text-base font-semibold tracking-wider">{reset.password}</code>
            <span className="ml-2 text-xs text-muted-foreground">只显示这一次</span>
          </span>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyPassword}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? '已复制' : '复制'}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setReset(null)}>关闭</Button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、学号、专业" aria-label="搜索报名账号" className="h-9 bg-card pl-9 text-sm" />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!applicants && !error && <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>}
      {applicants && applicants.length === 0 && <p className="rounded-lg border border-border/75 bg-secondary/20 py-8 text-center text-sm text-muted-foreground">还没有人注册报名账号。</p>}
      {applicants && applicants.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">共 {applicants.length} 个账号{query.trim() ? `，匹配 ${visible.length} 个` : ''}</p>
          <ul className="divide-y divide-border/75 overflow-hidden rounded-xl border border-border/75 bg-card">
            {visible.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}<span className="ml-2 font-normal text-muted-foreground">{item.student_id}</span></p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[item.grade, item.major].filter(Boolean).join(' · ')} · 注册于 {formatBeijingTime(item.created_at)}
                    {item.last_login_at ? ` · 最近登录 ${formatBeijingTime(item.last_login_at)}` : ''} · 已提交 {item.submission_count} 份
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={busyId === item.id} onClick={() => resetPassword(item)}>
                    {busyId === item.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <KeyRound size={14} aria-hidden="true" />} 重置密码
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={busyId === item.id} onClick={() => remove(item)} aria-label={`删除 ${item.name} 的报名账号`}><Trash2 size={15} aria-hidden="true" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
