import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, Users } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { parseMemberCsv } from '@/lib/memberCsv';

const ACTION_LABELS = {
  create: '新建草稿',
  bind: '绑定已有成员',
  skip: '已存在，跳过',
  conflict: '需要处理',
};

export default function MemberImportPanel({ onImported }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  const selectFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError('');
    setReport(null);
    setCompleted(false);
    try {
      const parsedRows = parseMemberCsv(await file.text());
      const preview = await api.admin.previewMemberImport(parsedRows);
      setFileName(file.name);
      setRows(parsedRows);
      setReport(preview);
    } catch (caught) {
      setRows([]);
      setFileName('');
      setError(caught.message || '无法读取该文件');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const executeImport = async () => {
    const importable = (report?.counts?.create || 0) + (report?.counts?.bind || 0);
    if (!importable || !window.confirm(`确定导入 ${importable} 位成员吗？\n\n新账号的初始密码与学号或工号相同，成员首次登录后必须修改密码。`)) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.admin.importMembers(rows);
      setReport(result);
      setCompleted(true);
      onImported?.();
    } catch (caught) {
      setError(caught.message || '批量导入失败');
    } finally {
      setLoading(false);
    }
  };

  const counts = report?.counts || {};
  const importable = (counts.create || 0) + (counts.bind || 0);

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border bg-secondary/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users size={16} /></span>
            批量导入成员账号
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            支持“学号、姓名、年级”列，也支持每行“学号 - 姓名”。系统会先预检，同名成员只绑定账号，不覆盖已有资料。
          </p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv,.txt,text/plain" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={loading} onClick={() => inputRef.current?.click()}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          选择 CSV
        </Button>
      </div>

      {(error || report) && (
        <div className="p-5">
          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {report && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 flex items-center gap-1.5 text-sm font-medium"><FileSpreadsheet size={15} />{fileName}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">新建 {counts.create || 0}</span>
                <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-700">绑定 {counts.bind || 0}</span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">跳过 {counts.skip || 0}</span>
                {!!counts.conflict && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700">需处理 {counts.conflict}</span>}
              </div>

              <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="sticky top-0 bg-secondary text-muted-foreground">
                    <tr><th className="px-3 py-2 font-medium">行</th><th className="px-3 py-2 font-medium">学号/工号</th><th className="px-3 py-2 font-medium">姓名</th><th className="px-3 py-2 font-medium">年级</th><th className="px-3 py-2 font-medium">处理方式</th><th className="px-3 py-2 font-medium">说明</th></tr>
                  </thead>
                  <tbody>
                    {report.items.map((item) => (
                      <tr key={`${item.row}-${item.account}`} className="border-t border-border/70">
                        <td className="px-3 py-2 text-muted-foreground">{item.row}</td>
                        <td className="px-3 py-2 font-mono">{item.account || '—'}</td>
                        <td className="px-3 py-2 font-medium">{item.name || '—'}</td>
                        <td className="px-3 py-2">{item.grade || '—'}</td>
                        <td className={`px-3 py-2 ${item.action === 'conflict' ? 'text-amber-700' : 'text-foreground'}`}>{ACTION_LABELS[item.action]}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">
                  {completed ? '导入完成。新建成员上传照片前不会出现在公开团队页面。' : '有冲突的行不会写入，可修正 CSV 后重新预检。'}
                </p>
                {completed ? (
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} /> 已完成</span>
                ) : (
                  <Button size="sm" className="shrink-0 gap-1.5" disabled={loading || importable === 0} onClick={executeImport}>
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    导入可安全处理的 {importable} 位
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
