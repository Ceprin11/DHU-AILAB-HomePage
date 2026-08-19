import React, { useState, useEffect } from 'react';
import { Loader2, LogOut, Save, Settings } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import EntityManager from '@/components/admin/EntityManager';
import GuideAdmin from '@/components/admin/GuideAdmin';
import PageTextAdmin from '@/components/admin/PageTextAdmin';
import MemberImportPanel from '@/components/admin/MemberImportPanel';

const memberFields = [
  { key: 'name', label: '姓名', type: 'text', required: true, helper: '只填写姓名和学号或工号即可先创建账号；未上传照片前不会显示在团队页面。' },
  { key: 'account', label: '学号或工号', type: 'text', required: true, placeholder: '成员登录账号', helper: '新增成员时会自动创建账号，初始密码与学号或工号相同。' },
  { key: 'account_active', label: '允许该成员登录', type: 'boolean', defaultValue: true, helper: '关闭后，该成员现有登录状态会立即失效。' },
  { key: 'reset_member_password', label: '将密码重置为学号或工号', type: 'boolean', showWhen: (member) => !!member.id, helper: '保存后成员需要使用初始密码重新登录，并再次设置新密码。' },
  { key: 'title', label: '职位/头衔', type: 'text', placeholder: '如：社长、技术负责人' },
  { key: 'category', label: '类别', type: 'select', options: [
    { value: 'advisor', label: '指导老师' }, { value: 'current_president', label: '现任社长' }, { value: 'current_vice_president', label: '现任副社长' }, { value: 'president', label: '社长' }, { value: 'vice_president', label: '副社长' }, { value: 'core', label: '核心成员' }, { value: 'member', label: '成员' }] },
  { key: 'grade', label: '入学年级', type: 'text', placeholder: '如：2024 或 24' },
  { key: 'major', label: '专业', type: 'text', placeholder: '如：计算机科学与技术', showWhen: (member) => member.category !== 'advisor' },
  { key: 'hometown', label: '来自', type: 'text', placeholder: '如：四川成都', showWhen: (member) => member.category !== 'advisor' },
  { key: 'hobbies', label: '兴趣爱好', type: 'textarea', rows: 2, placeholder: '如：摄影、羽毛球、阅读', showWhen: (member) => member.category !== 'advisor' },
  { key: 'graduated', label: '是否已毕业', type: 'boolean' },
  { key: 'experiences', label: '教育 / 职业经历', type: 'experiences', defaultValue: [], helper: '按公开展示顺序填写，支持教育、职业、实习和其他经历。' },
  { key: 'personal_homepage', label: '个人主页', type: 'text', placeholder: 'https://...', helper: '支持个人网站、GitHub Pages 等公开主页。' },
  { key: 'message_to_juniors', label: '写给学弟学妹的话', type: 'textarea', rows: 4, placeholder: '分享经验、建议或祝福', showWhen: (member) => !!member.graduated },
  { key: 'photo_url', label: '照片', type: 'image', helper: '新成员上传照片后会自动公开；留空时成员可登录个人中心自行完善。' },
  { key: 'email', label: '邮箱', type: 'text' },
  { key: 'research_interests', label: '研究方向', type: 'textarea', rows: 2 },
  { key: 'bio', label: '个人简介', type: 'textarea', rows: 4 },
  { key: 'competition_awards', label: '个人竞赛获奖（每行一条）', type: 'textarea', rows: 4 },
  { key: 'research_achievements', label: '个人科研成果（每行一条）', type: 'textarea', rows: 4 },
];

const memberProfileStatus = (member) => {
  if (!member.account) return '未配置登录账号';
  if (!member.account_active) return `账号 ${member.account} / 已停用`;
  if (member.profile_status === 'hidden') return `账号 ${member.account} / 已隐藏`;
  if ((!member.photo_url || member.profile_status === 'draft') && !member.account_last_login_at) return `账号 ${member.account} / 待首次登录`;
  if (!member.photo_url || member.profile_status === 'draft') return `账号 ${member.account} / 待完善资料`;
  return `账号 ${member.account} / 已公开`;
};

const notifFields = [
  { key: 'title', label: '标题', type: 'text', required: true },
  { key: 'content', label: '正文', type: 'textarea', rows: 6 },
  { key: 'date', label: '发布日期', type: 'date' },
  { key: 'category', label: '分类', type: 'select', options: [
    { value: 'notice', label: '通知' }, { value: 'news', label: '新闻' }, { value: 'event', label: '活动' }] },
  { key: 'pinned', label: '置顶', type: 'boolean' },
];

const awardFields = [
  { key: 'title', label: '成果名称', type: 'text', required: true },
  { key: 'type', label: '成果类型', type: 'select', options: [
    { value: 'competition', label: '竞赛获奖' }, { value: 'research', label: '科研成果' }] },
  { key: 'recipient', label: '获奖者/作者/团队', type: 'text' },
  { key: 'date', label: '日期', type: 'date' },
  { key: 'level', label: '竞赛级别（仅竞赛获奖）', type: 'select', options: [
    { value: 'national', label: '国家级' }, { value: 'provincial', label: '省级' }, { value: 'university', label: '校级' }, { value: 'other', label: '其他' }] },
  { key: 'ccf_level', label: 'CCF等级/会议（如 CCF-A、CVPR、ACL）', type: 'text' },
  { key: 'doi_url', label: 'DOI链接（仅科研成果）', type: 'text', placeholder: 'https://doi.org/10.xxxx/... 或 10.xxxx/...', helper: '填写后，论文卡片会显示 DOI 访问入口。', showWhen: (award) => award.type === 'research' },
  { key: 'arxiv_url', label: 'arXiv链接（仅科研成果）', type: 'text', placeholder: 'https://arxiv.org/abs/...', showWhen: (award) => award.type === 'research' },
  { key: 'project_url', label: '项目主页（仅科研成果）', type: 'text', placeholder: 'https://...', showWhen: (award) => award.type === 'research' },
  { key: 'code_url', label: '代码仓库（仅科研成果）', type: 'text', placeholder: 'https://github.com/...', showWhen: (award) => award.type === 'research' },
  { key: 'description', label: '详细描述', type: 'textarea', rows: 4 },
  { key: 'notes', label: '其他备注', type: 'textarea', rows: 2 },
  { key: 'image_url', label: '图片', type: 'image' },
];

const activityFields = [
  { key: 'title', label: '活动名称', type: 'text', required: true },
  { key: 'date', label: '活动日期', type: 'date' },
  { key: 'location', label: '活动地点', type: 'text' },
  { key: 'description', label: '活动介绍', type: 'textarea', rows: 5 },
  { key: 'image_url', label: '活动封面', type: 'image' },
  { key: 'document_url', label: '相关文档（可上传或粘贴链接）', type: 'file' },
  { key: 'external_link', label: '外部链接', type: 'text', placeholder: 'https://...' },
];

const videoFields = [
  { key: 'title', label: '视频标题', type: 'text', required: true },
  { key: 'bilibili_url', label: 'B站链接', type: 'text', required: true },
  { key: 'thumbnail_url', label: '封面图（留空则自动获取）', type: 'image' },
  { key: 'date', label: '发布日期', type: 'date' },
  { key: 'description', label: '视频简介', type: 'textarea', rows: 3 },
];

const materialFields = [
  { key: 'title', label: '资料名称', type: 'text', required: true },
  { key: 'category', label: '分类', type: 'text', placeholder: '如：论文、教程、数据集' },
  { key: 'file_type', label: '文件类型', type: 'select', options: [
    { value: 'pdf', label: 'PDF' }, { value: 'code', label: '代码' }, { value: 'data', label: '数据' }, { value: 'doc', label: '文档' }, { value: 'video', label: '视频' }, { value: 'other', label: '其他' }] },
  { key: 'file_url', label: '文件或链接', type: 'file', helper: '支持上传 PDF、Word、压缩包等文件，或粘贴 B站、YouTube、GitHub 等链接。' },
  { key: 'thumbnail_url', label: '封面图（留空则自动获取）', type: 'image', helper: '手动上传的封面优先于系统自动生成的封面。' },
  { key: 'date', label: '上传日期', type: 'date' },
  { key: 'description', label: '资料描述', type: 'textarea', rows: 3 },
];

const qaFields = [
  { key: 'question', label: '问题', type: 'textarea', rows: 2, required: true },
  { key: 'answer', label: '回答', type: 'textarea', rows: 4, required: true },
  { key: 'category', label: '分类', type: 'text' },
  { key: 'order_index', label: '排序(小在前)', type: 'number' },
];

const clubLifeFields = [
  { key: 'title', label: '标题', type: 'text', required: true, placeholder: '如：五一踏青' },
  { key: 'album', label: '相册分组', type: 'text', placeholder: '如：2025日常活动' },
  { key: 'date', label: '日期', type: 'date' },
  { key: 'image_url', label: '照片', type: 'image' },
  { key: 'description', label: '照片描述', type: 'textarea', rows: 2 },
];

const homeImageFields = [
  { key: 'title', label: '图片名称', type: 'text', required: true, placeholder: '如：实验室合影' },
  { key: 'image_url', label: '主页图片', type: 'image', required: true },
  { key: 'alt_text', label: '图片说明', type: 'text', placeholder: '用于图片无法显示时的文字说明' },
  { key: 'is_visible', label: '在首页展示', type: 'boolean', defaultValue: true, helper: '关闭后图片仍会保留，可随时重新开启展示。' },
  { key: 'order_index', label: '轮播顺序（数字越小越靠前）', type: 'number' },
];

function SiteSettingsTab() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.entities.SiteSettings.list().then((r) => setData(r[0] || {})).catch(() => setData({}));
  }, []);

  const set = (k, v) => setData((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        contact_email: data.contact_email || '',
        bilibili_url: data.bilibili_url || '',
        bilibili_name: data.bilibili_name || '',
        qq_group: data.qq_group || '',
        lab_intro: data.lab_intro || '',
        lab_slogan: data.lab_slogan || '',
        autumn_requirements: data.autumn_requirements || '',
        autumn_process: data.autumn_process || '',
        summer_requirements: data.summer_requirements || '',
        summer_process: data.summer_process || '',
      };
      if (data.id) {
        await api.entities.SiteSettings.update(data.id, payload);
      } else {
        await api.entities.SiteSettings.create(payload);
      }
      alert('保存成功');
    } catch (e) {
      alert('保存失败：' + (e.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold">实验室信息</h3>
        <div className="mt-4 space-y-4">
          <div><Label className="mb-1.5 block">实验室简介（首页展示）</Label><Textarea rows={3} value={data.lab_intro || ''} onChange={(e) => set('lab_intro', e.target.value)} /></div>
          <div><Label className="mb-1.5 block">实验室标语</Label><Input value={data.lab_slogan || ''} onChange={(e) => set('lab_slogan', e.target.value)} /></div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold">联系方式</h3>
        <div className="mt-4 space-y-4">
          <div><Label className="mb-1.5 block">联系邮箱</Label><Input value={data.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} placeholder="ailab@dhu.edu.cn" /></div>
          <div><Label className="mb-1.5 block">B站主页链接</Label><Input value={data.bilibili_url || ''} onChange={(e) => set('bilibili_url', e.target.value)} placeholder="https://space.bilibili.com/..." /></div>
          <div><Label className="mb-1.5 block">B站名称</Label><Input value={data.bilibili_name || ''} onChange={(e) => set('bilibili_name', e.target.value)} /></div>
          <div><Label className="mb-1.5 block">QQ群号</Label><Input value={data.qq_group || ''} onChange={(e) => set('qq_group', e.target.value)} /></div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold">秋季招新</h3>
        <div className="mt-4 space-y-4">
          <div><Label className="mb-1.5 block">秋季招新要求（每行一条）</Label><Textarea rows={4} value={data.autumn_requirements || ''} onChange={(e) => set('autumn_requirements', e.target.value)} /></div>
          <div><Label className="mb-1.5 block">秋季招新流程（每行一步）</Label><Textarea rows={4} value={data.autumn_process || ''} onChange={(e) => set('autumn_process', e.target.value)} /></div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold">暑期招新</h3>
        <div className="mt-4 space-y-4">
          <div><Label className="mb-1.5 block">暑期招新要求（每行一条）</Label><Textarea rows={4} value={data.summer_requirements || ''} onChange={(e) => set('summer_requirements', e.target.value)} /></div>
          <div><Label className="mb-1.5 block">暑期招新流程（每行一步）</Label><Textarea rows={4} value={data.summer_process || ''} onChange={(e) => set('summer_process', e.target.value)} /></div>
        </div>
      </div>
      <Button onClick={save} disabled={saving} className="gap-1.5">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 保存设置
      </Button>
    </div>
  );
}

function MemberManagementTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <>
      <MemberImportPanel onImported={() => setRefreshKey((key) => key + 1)} />
      <EntityManager key={refreshKey} entityName="Member" label="成员" fields={memberFields} sort="name" itemTitle={(it) => it.name} itemSubtitle={memberProfileStatus} />
    </>
  );
}

export default function Admin() {
  const { user, logoutAdmin } = useAuth();
  const navigate = useNavigate();

  if (user?.role !== 'admin') {
    return <Navigate to="/admin-login" replace />;
  }

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin-login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Settings size={18} /></span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">管理后台</h1>
            <p className="font-mono-date text-xs text-muted-foreground">AILAB Admin Console</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
          <LogOut size={15} /> 退出登录
        </Button>
      </div>

      <Tabs defaultValue="members" className="mt-8">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto bg-secondary/50 p-1">
          <TabsTrigger value="members">团队成员</TabsTrigger>
          <TabsTrigger value="ai-guide">AI入门</TabsTrigger>
          <TabsTrigger value="notifications">通知</TabsTrigger>
          <TabsTrigger value="awards">成果展示</TabsTrigger>
          <TabsTrigger value="activities">活动</TabsTrigger>
          <TabsTrigger value="clublife">社团生活</TabsTrigger>
          <TabsTrigger value="home-images">主页图片</TabsTrigger>
          <TabsTrigger value="videos">视频</TabsTrigger>
          <TabsTrigger value="materials">资料</TabsTrigger>
          <TabsTrigger value="qa">问答</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
          <TabsTrigger value="page-text">页面文案</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6"><MemberManagementTab /></TabsContent>
        <TabsContent value="ai-guide" className="mt-6"><GuideAdmin /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><EntityManager entityName="Notification" label="通知" fields={notifFields} itemTitle={(it) => it.title} /></TabsContent>
        <TabsContent value="awards" className="mt-6"><EntityManager entityName="Award" label="成果" fields={awardFields} itemTitle={(it) => it.title} /></TabsContent>
        <TabsContent value="activities" className="mt-6"><EntityManager entityName="Activity" label="活动" fields={activityFields} itemTitle={(it) => it.title} /></TabsContent>
        <TabsContent value="clublife" className="mt-6"><EntityManager entityName="ClubLife" label="社团生活" fields={clubLifeFields} sort="-date" itemTitle={(it) => it.title} /></TabsContent>
        <TabsContent value="home-images" className="mt-6">
          <EntityManager entityName="HomeImage" label="主页图片" fields={homeImageFields} sort="order_index" itemTitle={(it) => it.title} quickToggle={{ key: 'is_visible', label: '切换首页展示：', onLabel: '展示中', offLabel: '已隐藏' }} />
        </TabsContent>
        <TabsContent value="videos" className="mt-6"><EntityManager entityName="VideoLink" label="视频" fields={videoFields} itemTitle={(it) => it.title} /></TabsContent>
        <TabsContent value="materials" className="mt-6"><EntityManager entityName="StudyMaterial" label="学习资料" fields={materialFields} itemTitle={(it) => it.title} /></TabsContent>
        <TabsContent value="qa" className="mt-6"><EntityManager entityName="QA" label="问答" fields={qaFields} sort="order_index" itemTitle={(it) => it.question} /></TabsContent>
        <TabsContent value="settings" className="mt-6"><SiteSettingsTab /></TabsContent>
        <TabsContent value="page-text" className="mt-6"><PageTextAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}
