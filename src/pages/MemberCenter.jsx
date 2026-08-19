import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Camera,
  Check,
  ExternalLink,
  FlaskConical,
  LogOut,
  Mail,
  MapPin,
  Save,
  UserRound,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import BrandMarks from '@/components/BrandMarks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/AuthContext';

const navigation = [
  { id: 'basic-profile', label: '基本资料', icon: UserRound },
  { id: 'academic-profile', label: '学术与经历', icon: FlaskConical },
  { id: 'contact-profile', label: '联系方式', icon: Mail },
];

const fieldClass = 'h-11 border-border/85 bg-background/80 transition-colors focus-visible:bg-background';
const textareaClass = 'min-h-28 resize-y border-border/85 bg-background/80 leading-6 transition-colors focus-visible:bg-background';

function FormSection({ id, icon: Icon, title, description, children }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-xl border border-border/75 bg-card/80 px-5 py-6 shadow-[0_16px_48px_hsl(var(--foreground)/0.035)] backdrop-blur-sm sm:px-7 sm:py-7"
    >
      <div className="mb-7 flex items-start gap-3.5 border-b border-border/70 pb-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <h2 id={`${id}-title`} className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function MemberCenter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const photoInputRef = useRef(null);
  const initials = useMemo(() => profile?.name?.slice(0, 1) || '你', [profile?.name]);
  const isPublished = Boolean(profile?.photo_url)
    && profile?.profile_status !== 'draft'
    && profile?.profile_status !== 'hidden';

  useEffect(() => {
    if (user?.role !== 'member' || user.must_change_password) return;
    api.member.profile()
      .then(setProfile)
      .catch((loadError) => setError(loadError.message || '成员资料加载失败'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const updateField = (field) => (event) => {
    setSaved(false);
    setProfile((current) => ({ ...current, [field]: event.target.value }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaved(false);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const editableProfile = Object.fromEntries([
        'major',
        'hometown',
        'hobbies',
        'research_interests',
        'bio',
        'competition_awards',
        'research_achievements',
        'email',
        'personal_homepage',
      ].map((field) => [field, profile[field] || '']));
      let updatedProfile = await api.member.updateProfile(editableProfile);
      if (photoFile) updatedProfile = await api.member.uploadPhoto(photoFile);
      setProfile(updatedProfile);
      setPhotoFile(null);
      setPhotoPreview('');
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || '成员资料保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin-login', { replace: true });
  };

  if (!user) return <Navigate to="/admin-login" replace />;
  if (user.role !== 'member') return <Navigate to="/admin" replace />;
  if (user.must_change_password) return <Navigate to="/member-password" replace />;
  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground" role="status">正在加载成员资料</div>;
  }
  if (!profile) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-5 text-center">
        <p role="alert" className="text-sm text-destructive">{error || '无法读取成员资料'}</p>
        <Button variant="outline" onClick={handleLogout}>返回登录页</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b border-border/75 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/" className="rounded-sm" aria-label="返回 AILAB 首页"><BrandMarks /></Link>
            <span className="hidden h-6 w-px bg-border sm:block" />
            <span className="hidden truncate text-sm font-semibold text-foreground sm:block">成员个人中心</span>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="min-h-11 px-3 text-muted-foreground hover:text-foreground">
            <LogOut size={16} aria-hidden="true" />退出登录
          </Button>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 neural-grid opacity-20" />
        <div className="pointer-events-none absolute -left-40 top-8 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-48 top-[28rem] h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-7 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 overflow-hidden rounded-xl border border-border/75 bg-card/85 p-4 shadow-[0_18px_52px_hsl(var(--foreground)/0.045)] backdrop-blur-sm lg:block">
              <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-accent/55">
                {photoPreview || profile.photo_url ? (
                  <img src={photoPreview || profile.photo_url} alt={`${profile.name}的个人照片`} className="h-full w-full object-contain" />
                ) : (
                  <span className="font-display text-7xl font-bold text-primary/20" aria-hidden="true">{initials}</span>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                  aria-label="选择个人照片"
                  disabled={saving}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute bottom-3 right-3 hidden min-h-10 border border-border/75 bg-background/92 shadow-sm lg:inline-flex"
                >
                  <Camera size={15} aria-hidden="true" />更换照片
                </Button>
              </div>

              <div className="min-w-0 py-1 lg:px-1 lg:pb-1 lg:pt-5">
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground lg:text-2xl">{profile.name}</h2>
                <p className="mt-1.5 text-sm font-medium text-primary">{[profile.grade, profile.major, profile.title].filter(Boolean).join(' / ')}</p>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">姓名、年级和成员身份由管理员维护。</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  className="mt-4 min-h-10 lg:hidden"
                >
                  <Camera size={15} aria-hidden="true" />更换照片
                </Button>
              </div>
            </section>

            <nav aria-label="个人资料分区" className="grid grid-cols-3 gap-2 rounded-xl border border-border/75 bg-card/65 p-2 backdrop-blur-sm lg:grid-cols-1">
              {navigation.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="interactive-link flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground lg:min-h-11 lg:flex-row lg:justify-start lg:gap-2 lg:px-3 lg:text-sm"
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span className="whitespace-nowrap">{label}</span>
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">个人资料</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {isPublished ? '维护将在团队页面公开展示的个人信息。' : '你的资料目前不会公开；上传照片并保存后将自动显示在团队页面。'}
                </p>
              </div>
              <p role="status" aria-live="polite" className="flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
                {saved && <Check size={16} className="text-primary" aria-hidden="true" />}
                {saved ? '个人资料已保存' : saving ? '正在保存' : '修改后请及时保存'}
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!isPublished && (
              <div className="mb-5 rounded-lg border border-primary/15 bg-accent/65 px-4 py-3 text-sm leading-6 text-foreground/85">
                当前状态：待完善。你可以先保存文字资料，只有成功上传照片后个人资料才会公开。
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <FormSection id="basic-profile" icon={UserRound} title="基本资料" description="介绍你的个人背景和兴趣。">
                <div className="space-y-2">
                  <Label htmlFor="member-major">专业</Label>
                  <Input id="member-major" value={profile.major || ''} onChange={updateField('major')} className={fieldClass} placeholder="如：计算机科学与技术" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-hometown">来自</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="member-hometown" value={profile.hometown || ''} onChange={updateField('hometown')} className={`${fieldClass} pl-10`} placeholder="如：四川成都" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-hobbies">兴趣爱好</Label>
                  <Input id="member-hobbies" value={profile.hobbies || ''} onChange={updateField('hobbies')} className={fieldClass} placeholder="如：摄影、羽毛球、阅读" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="member-bio">个人简介</Label>
                  <Textarea id="member-bio" value={profile.bio || ''} onChange={updateField('bio')} className={textareaClass} placeholder="介绍你的学习经历和正在参与的项目" />
                </div>
              </FormSection>

              <FormSection id="academic-profile" icon={FlaskConical} title="学术与经历" description="记录研究方向、竞赛经历和科研成果。">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="member-research">研究方向</Label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Textarea id="member-research" value={profile.research_interests || ''} onChange={updateField('research_interests')} className={`${textareaClass} pl-10`} placeholder="填写你的研究方向" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-awards">竞赛获奖</Label>
                  <Textarea id="member-awards" value={profile.competition_awards || ''} onChange={updateField('competition_awards')} className={textareaClass} placeholder="每行填写一条" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-achievements">科研成果</Label>
                  <Textarea id="member-achievements" value={profile.research_achievements || ''} onChange={updateField('research_achievements')} className={textareaClass} placeholder="每行填写一条" />
                </div>
              </FormSection>

              <FormSection id="contact-profile" icon={Mail} title="联系方式" description="填写你愿意公开的联系入口。">
                <div className="space-y-2">
                  <Label htmlFor="member-email">邮箱</Label>
                  <Input id="member-email" type="email" value={profile.email || ''} onChange={updateField('email')} className={fieldClass} placeholder="name@dhu.edu.cn" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-homepage">个人主页</Label>
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="member-homepage" type="url" value={profile.personal_homepage || ''} onChange={updateField('personal_homepage')} className={`${fieldClass} pl-10`} placeholder="https://..." />
                  </div>
                </div>
              </FormSection>

              <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-xl border border-border/80 bg-background/92 px-4 py-3 shadow-[0_16px_50px_hsl(var(--foreground)/0.1)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm text-muted-foreground">
                  {isPublished ? '保存后，公开团队页面将同步更新。' : '没有照片时只保存草稿，上传照片后自动公开。'}
                </p>
                <Button type="submit" size="lg" className="w-full active:translate-y-px sm:w-auto" disabled={saving}>
                  <Save size={16} aria-hidden="true" />{saving ? '正在保存' : '保存修改'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
