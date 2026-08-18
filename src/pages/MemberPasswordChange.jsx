import React, { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import BrandMarks from '@/components/BrandMarks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';

export default function MemberPasswordChange() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) return <Navigate to="/admin-login" replace />;
  if (user.role !== 'member') return <Navigate to="/admin" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 8) {
      setError('新密码至少需要 8 位');
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/member-center', { replace: true });
    } catch (changeError) {
      setError(changeError.message || '密码修改失败');
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin-login', { replace: true });
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-5 py-12 sm:px-8">
      <div className="pointer-events-none absolute inset-0 neural-grid opacity-30" />
      <div className="pointer-events-none absolute -right-24 top-12 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

      <section className="relative w-full max-w-md rounded-xl border border-border/75 bg-card/90 p-6 shadow-[0_22px_65px_hsl(var(--foreground)/0.08)] backdrop-blur-sm sm:p-8">
        <BrandMarks />
        <div className="mt-7 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
          <KeyRound size={20} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
          {user.must_change_password ? '设置新的登录密码' : '修改登录密码'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {user.must_change_password ? '首次登录需要修改初始密码，完成后才能进入成员中心。' : '请输入当前密码并设置新的登录密码。'}
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">当前密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 pl-10" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} placeholder="至少 8 位" className="h-11" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} className="h-11" required />
          </div>
          <Button type="submit" className="h-11 w-full font-semibold" disabled={saving}>
            {saving ? '正在保存' : '保存并进入成员中心'}
          </Button>
        </form>

        <button type="button" onClick={handleLogout} className="mt-5 min-h-11 w-full text-sm text-muted-foreground transition-colors hover:text-foreground">
          退出当前账号
        </button>
      </section>
    </main>
  );
}
