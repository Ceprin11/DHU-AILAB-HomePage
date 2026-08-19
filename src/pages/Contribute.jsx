import React, { useState } from 'react';
import { CheckCircle2, FlaskConical, ImagePlus, Loader2, Medal, Trophy, Upload } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SectionHeading from '@/components/SectionHeading';
import { useAuth } from '@/lib/AuthContext';

const localDate = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const emptyMaterial = () => ({ title: '', category: '', file_type: 'other', file_url: '', thumbnail_url: '', date: localDate(), description: '' });
const emptyQA = () => ({ question: '', answer: '', category: '' });
const emptyAward = () => ({ title: '', type: 'competition', recipient: '', date: localDate(), level: '', ccf_level: '', doi_url: '', arxiv_url: '', project_url: '', code_url: '', description: '', notes: '', image_url: '' });

const fieldClass = 'mt-1.5 h-10 bg-background';
const pageContent = {
  material: { eyebrow: 'Learning Resources', title: '学习资料上传', description: '分享优质教程、论文、数据集、课件或其他学习资源。提交后会直接显示在学习资料页面。' },
  qa: { eyebrow: 'Q&A Contribution', title: '问答补充', description: '补充其他成员可能遇到的问题，并提供清晰、准确的参考答案。' },
  award: { eyebrow: 'Achievement Contribution', title: '成果上传', description: '记录实验室成员取得的竞赛获奖和科研成果。' },
};
const inferFileType = (filename = '') => {
  const extension = filename.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'pdf';
  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md'].includes(extension)) return 'doc';
  if (['zip', 'ipynb'].includes(extension)) return 'code';
  if (extension === 'csv') return 'data';
  return 'other';
};

function FormStatus({ error, success }) {
  if (error) return <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;
  if (success) return <p role="status" className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"><CheckCircle2 size={16} />{success}</p>;
  return null;
}

export default function Contribute({ type = 'material' }) {
  const { user } = useAuth();
  const [material, setMaterial] = useState(emptyMaterial);
  const [qa, setQA] = useState(emptyQA);
  const [award, setAward] = useState(emptyAward);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!user) return <Navigate to="/admin-login" state={{ from: `/contribute/${type}` }} replace />;
  if (user.role === 'member' && user.must_change_password) return <Navigate to="/member-password" replace />;

  const clearStatus = () => { setError(''); setSuccess(''); };
  const submit = async (entityName, payload, reset, successMessage) => {
    clearStatus();
    setSaving(true);
    try {
      await api.contributions.create(entityName, payload);
      reset();
      setSuccess(successMessage);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '投稿失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const uploadMaterial = async (file) => {
    if (!file) return;
    clearStatus();
    setUploading('material');
    try {
      const result = await api.contributions.upload(file);
      setMaterial((current) => ({ ...current, file_url: result.file_url, thumbnail_url: result.thumbnail_url || '', file_type: inferFileType(file.name) }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '文件上传失败');
    } finally {
      setUploading('');
    }
  };

  const uploadAwardImage = async (file) => {
    if (!file) return;
    clearStatus();
    setUploading('award');
    try {
      const result = await api.contributions.upload(file);
      setAward((current) => ({ ...current, image_url: result.file_url }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败');
    } finally {
      setUploading('');
    }
  };

  return (
    <div className="page-shell page-section max-w-5xl">
      <SectionHeading eyebrow={pageContent[type]?.eyebrow} title={pageContent[type]?.title} description={pageContent[type]?.description} />

        {type === 'material' && <div className="mt-10">
          <form onSubmit={(event) => { event.preventDefault(); submit('StudyMaterial', material, () => setMaterial(emptyMaterial()), '学习资料投稿成功'); }} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="material-title">资料名称 *</Label><Input id="material-title" required maxLength={300} value={material.title} onChange={(event) => setMaterial({ ...material, title: event.target.value })} className={fieldClass} /></div>
              <div><Label htmlFor="material-category">分类</Label><Input id="material-category" maxLength={100} value={material.category} onChange={(event) => setMaterial({ ...material, category: event.target.value })} className={fieldClass} placeholder="如：论文、教程、数据集" /></div>
              <div><Label htmlFor="material-date">上传日期</Label><DatePicker id="material-date" value={material.date} onChange={(value) => setMaterial({ ...material, date: value })} className="mt-1.5" /></div>
              <div className="sm:col-span-2"><Label htmlFor="material-description">资料说明</Label><Textarea id="material-description" rows={4} maxLength={10000} value={material.description} onChange={(event) => setMaterial({ ...material, description: event.target.value })} className="mt-1.5" /></div>
              <div className="sm:col-span-2">
                <Label htmlFor="material-url">文件或外部链接 *</Label>
                <div className="mt-1.5 flex flex-col gap-3 sm:flex-row">
                  <Input id="material-url" required value={material.file_url} onChange={(event) => setMaterial({ ...material, file_url: event.target.value })} placeholder="https://... 或上传文件" />
                  <label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-semibold hover:bg-accent">
                    {uploading === 'material' ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{uploading === 'material' ? '上传中…' : '上传文件'}
                    <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.webp,.avif,.pdf,.txt,.md,.csv,.zip,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.ipynb" disabled={Boolean(uploading)} onChange={(event) => { uploadMaterial(event.target.files?.[0]); event.target.value = ''; }} />
                  </label>
                </div>
              </div>
            </div>
            <FormStatus error={error} success={success} />
            <div className="flex justify-end"><Button type="submit" disabled={saving || Boolean(uploading)}>{saving && <Loader2 className="animate-spin" />}提交学习资料</Button></div>
          </form>
        </div>}

        {type === 'qa' && <div className="mt-10">
          <form onSubmit={(event) => { event.preventDefault(); submit('QA', qa, () => setQA(emptyQA()), '问答补充成功'); }} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
            <div><Label htmlFor="qa-question">问题 *</Label><Textarea id="qa-question" required rows={3} maxLength={1000} value={qa.question} onChange={(event) => setQA({ ...qa, question: event.target.value })} className="mt-1.5" placeholder="填写其他成员可能遇到的问题" /></div>
            <div><Label htmlFor="qa-answer">参考答案 *</Label><Textarea id="qa-answer" required rows={7} maxLength={10000} value={qa.answer} onChange={(event) => setQA({ ...qa, answer: event.target.value })} className="mt-1.5" placeholder="给出清晰、准确的解答" /></div>
            <div><Label htmlFor="qa-category">分类</Label><Input id="qa-category" maxLength={100} value={qa.category} onChange={(event) => setQA({ ...qa, category: event.target.value })} className={fieldClass} placeholder="如：实验室、学习、竞赛" /></div>
            <FormStatus error={error} success={success} />
            <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}提交问答</Button></div>
          </form>
        </div>}

        {type === 'award' && <div className="mt-10">
          <form onSubmit={(event) => { event.preventDefault(); submit('Award', award, () => setAward(emptyAward()), '成果投稿成功'); }} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="award-title">成果名称 *</Label><Input id="award-title" required maxLength={300} value={award.title} onChange={(event) => setAward({ ...award, title: event.target.value })} className={fieldClass} /></div>
              <div>
                <Label htmlFor="award-type">成果类型</Label>
                <Select value={award.type} onValueChange={(value) => setAward({ ...award, type: value })}>
                  <SelectTrigger id="award-type" className="mt-1.5 h-10 border-border/85 bg-background shadow-sm">
                    <SelectValue placeholder="选择成果类型" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/80 p-1 shadow-xl">
                    <SelectItem value="competition" className="rounded-lg py-2.5">
                      <span className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber/30 text-primary"><Trophy size={14} /></span><span className="font-medium">竞赛获奖</span></span>
                    </SelectItem>
                    <SelectItem value="research" className="rounded-lg py-2.5">
                      <span className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-primary"><FlaskConical size={14} /></span><span className="font-medium">科研成果</span></span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="award-date">日期</Label><DatePicker id="award-date" value={award.date} onChange={(value) => setAward({ ...award, date: value })} className="mt-1.5" /></div>
              <div className="sm:col-span-2"><Label htmlFor="award-recipient">获奖者 / 作者 / 团队</Label><Input id="award-recipient" maxLength={500} value={award.recipient} onChange={(event) => setAward({ ...award, recipient: event.target.value })} className={fieldClass} /></div>
              {award.type === 'competition' ? <div>
                <Label htmlFor="award-level">竞赛级别</Label>
                <Select value={award.level || 'unspecified'} onValueChange={(value) => setAward({ ...award, level: value === 'unspecified' ? '' : value })}>
                  <SelectTrigger id="award-level" className="mt-1.5 h-10 border-border/85 bg-background shadow-sm">
                    <SelectValue placeholder="选择竞赛级别" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/80 p-1 shadow-xl">
                    <SelectItem value="unspecified" className="rounded-lg py-2.5 text-muted-foreground">暂不填写</SelectItem>
                    <SelectItem value="national" className="rounded-lg py-2.5"><span className="flex items-center gap-2.5"><Medal size={15} className="text-primary" /><span>国家级</span></span></SelectItem>
                    <SelectItem value="provincial" className="rounded-lg py-2.5"><span className="flex items-center gap-2.5"><Medal size={15} className="text-primary/85" /><span>省级</span></span></SelectItem>
                    <SelectItem value="university" className="rounded-lg py-2.5"><span className="flex items-center gap-2.5"><Medal size={15} className="text-primary/70" /><span>校级</span></span></SelectItem>
                    <SelectItem value="other" className="rounded-lg py-2.5"><span className="flex items-center gap-2.5"><Medal size={15} className="text-muted-foreground" /><span>其他</span></span></SelectItem>
                  </SelectContent>
                </Select>
              </div> : <div><Label htmlFor="award-ccf">CCF 等级 / 会议</Label><Input id="award-ccf" maxLength={100} value={award.ccf_level} onChange={(event) => setAward({ ...award, ccf_level: event.target.value })} className={fieldClass} /></div>}
              <div className="sm:col-span-2"><Label htmlFor="award-description">成果说明</Label><Textarea id="award-description" rows={5} maxLength={10000} value={award.description} onChange={(event) => setAward({ ...award, description: event.target.value })} className="mt-1.5" /></div>
              {award.type === 'research' && <><div><Label htmlFor="award-doi">DOI</Label><Input id="award-doi" value={award.doi_url} onChange={(event) => setAward({ ...award, doi_url: event.target.value })} className={fieldClass} placeholder="10.xxxx/..." /></div><div><Label htmlFor="award-arxiv">arXiv 链接</Label><Input id="award-arxiv" type="url" value={award.arxiv_url} onChange={(event) => setAward({ ...award, arxiv_url: event.target.value })} className={fieldClass} /></div><div><Label htmlFor="award-project">项目主页</Label><Input id="award-project" type="url" value={award.project_url} onChange={(event) => setAward({ ...award, project_url: event.target.value })} className={fieldClass} /></div><div><Label htmlFor="award-code">代码仓库</Label><Input id="award-code" type="url" value={award.code_url} onChange={(event) => setAward({ ...award, code_url: event.target.value })} className={fieldClass} /></div></>}
              <div className="sm:col-span-2">
                <Label>成果图片</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  {award.image_url && <img src={award.image_url} alt="成果图片预览" className="h-24 w-32 rounded-lg border border-border object-contain" />}
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-semibold hover:bg-accent">{uploading === 'award' ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}{uploading === 'award' ? '上传中…' : '上传图片'}<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" disabled={Boolean(uploading)} onChange={(event) => { uploadAwardImage(event.target.files?.[0]); event.target.value = ''; }} /></label>
                </div>
              </div>
            </div>
            <FormStatus error={error} success={success} />
            <div className="flex justify-end"><Button type="submit" disabled={saving || Boolean(uploading)}>{saving && <Loader2 className="animate-spin" />}提交成果</Button></div>
          </form>
        </div>}
    </div>
  );
}
