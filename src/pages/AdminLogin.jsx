import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, Lock, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSiteText } from '@/lib/siteText';

export default function AdminLogin() {
  const text = useSiteText();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  if (user?.role === 'member') {
    return <Navigate to={user.must_change_password ? '/member-password' : '/member-center'} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const authenticatedUser = await login(account.trim(), password);
      if (authenticatedUser.role === 'member') {
        navigate(authenticatedUser.must_change_password ? '/member-password' : '/member-center', { replace: true });
        return;
      }
      const target = location.state?.from || '/admin';
      navigate(target, { replace: true });
    } catch (loginError) {
      setError(loginError.message || text('login_error'));
      setLoading(false);
    }
  };

  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden border-b border-border/75 px-5 py-16 sm:px-8">
      <div className="absolute inset-0 neural-grid opacity-50" />
      <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-amber/15 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-xl border border-border/75 bg-background/95 p-7 shadow-[0_20px_55px_hsl(var(--foreground)/0.08)] backdrop-blur sm:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/10 bg-accent text-primary">
          <KeyRound size={20} strokeWidth={1.8} />
        </div>
        <p className="mt-5 font-mono-date text-xs uppercase tracking-[0.22em] text-primary">{text('login_eyebrow')}</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">{text('login_title')}</h1>
        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-account">{text('login_account')}</Label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="login-account"
                autoComplete="username"
                autoFocus
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder={text('login_account_placeholder')}
                className="h-11 pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">{text('login_password')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={text('login_password_placeholder')}
                className="h-11 pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="h-11 w-full font-semibold" disabled={loading}>
            {loading ? text('login_loading') : text('login_button')}
          </Button>
        </form>
      </div>
    </section>
  );
}
