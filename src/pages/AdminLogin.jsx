import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Lock, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLogin() {
  const { user, loginAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (!loginAdmin(account.trim(), password)) {
      setError('账号或密码错误，请重新输入。');
      return;
    }

    const target = location.state?.from || '/admin';
    navigate(target, { replace: true });
  };

  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden border-b border-border px-5 py-16 sm:px-8">
      <div className="absolute inset-0 neural-grid opacity-50" />
      <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-amber/15 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background/95 p-7 shadow-xl shadow-primary/5 backdrop-blur sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound size={20} />
        </div>
        <p className="mt-5 font-mono-date text-xs uppercase tracking-[0.22em] text-primary">AILAB Admin</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">管理员登录</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">请输入管理员账号和密码进入内容管理后台。</p>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-account">账号</Label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="admin-account"
                autoComplete="username"
                autoFocus
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="请输入管理员账号"
                className="h-11 pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入管理员密码"
                className="h-11 pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="h-11 w-full font-semibold">
            登录管理后台
          </Button>
        </form>
      </div>
    </section>
  );
}
