import React, { useState } from 'react';
import { KeyRound, Loader2, LogOut, UserRound } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useApplicant from '@/hooks/use-applicant';
import { cn } from '@/lib/utils';

function Field({ label, htmlFor, hint = null, children }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorLine({ message }) {
  return message ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{message}</p> : null;
}

const EMPTY_REGISTER = { name: '', student_id: '', grade: '', major: '', password: '', confirm: '' };

function SignInCard({ grades, onSignedIn }) {
  const [mode, setMode] = useState('login');
  const [login, setLogin] = useState({ student_id: '', password: '' });
  const [register, setRegister] = useState(EMPTY_REGISTER);
  const [status, setStatus] = useState({ busy: false, error: '' });

  const switchMode = (next) => {
    setMode(next);
    setStatus({ busy: false, error: '' });
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    if (status.busy) return;
    if (!login.student_id.trim() || !login.password) return setStatus({ busy: false, error: '请填写学号和密码' });
    setStatus({ busy: true, error: '' });
    try {
      onSignedIn(await api.applicant.login(login.student_id.trim(), login.password));
    } catch (error) {
      setStatus({ busy: false, error: error.message || '登录失败' });
    }
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    if (status.busy) return;
    if (!register.name.trim()) return setStatus({ busy: false, error: '请填写姓名' });
    if (!/^[A-Za-z0-9]{4,20}$/.test(register.student_id.trim())) return setStatus({ busy: false, error: '学号应为 4-20 位字母或数字' });
    if (!register.grade) return setStatus({ busy: false, error: '请选择年级' });
    if (!register.major.trim()) return setStatus({ busy: false, error: '请填写专业' });
    if (register.password.length < 8) return setStatus({ busy: false, error: '密码至少 8 位' });
    if (register.password !== register.confirm) return setStatus({ busy: false, error: '两次输入的密码不一致' });
    setStatus({ busy: true, error: '' });
    try {
      const { confirm: _confirm, ...payload } = register;
      onSignedIn(await api.applicant.register({ ...payload, name: payload.name.trim(), student_id: payload.student_id.trim(), major: payload.major.trim() }));
    } catch (error) {
      setStatus({ busy: false, error: error.message || '注册失败' });
    }
  };

  const updateLogin = (key) => (event) => setLogin((current) => ({ ...current, [key]: event.target.value }));
  const updateRegister = (key) => (event) => setRegister((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="rounded-xl border border-border/75 bg-card/60 px-5 py-6 sm:px-6">
      <div role="tablist" aria-label="登录或注册" className="inline-flex rounded-lg bg-secondary/60 p-0.5">
        {[['login', '登录'], ['register', '注册']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => switchMode(id)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
        ))}
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        提交需要先注册报名账号。这个账号只用来提交报名材料，不是实验室成员账号，看不到任何人的提交。
      </p>

      {mode === 'login' ? (
        <form onSubmit={submitLogin} noValidate className="mt-5 space-y-5">
          <Field label="学号" htmlFor="applicant-login-id"><Input id="applicant-login-id" value={login.student_id} onChange={updateLogin('student_id')} maxLength={20} autoComplete="username" /></Field>
          <Field label="密码" htmlFor="applicant-login-password" hint="忘记密码请联系实验室管理员重置。"><Input id="applicant-login-password" type="password" value={login.password} onChange={updateLogin('password')} maxLength={64} autoComplete="current-password" /></Field>
          <ErrorLine message={status.error} />
          <Button type="submit" disabled={status.busy} className="gap-2">{status.busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} 登录</Button>
        </form>
      ) : (
        <form onSubmit={submitRegister} noValidate className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="姓名" htmlFor="applicant-name"><Input id="applicant-name" value={register.name} onChange={updateRegister('name')} maxLength={30} autoComplete="name" /></Field>
            <Field label="学号" htmlFor="applicant-student-id"><Input id="applicant-student-id" value={register.student_id} onChange={updateRegister('student_id')} maxLength={20} autoComplete="username" /></Field>
            <Field label="年级">
              <Select value={register.grade} onValueChange={(value) => setRegister((current) => ({ ...current, grade: value }))}>
                <SelectTrigger aria-label="年级"><SelectValue placeholder="请选择年级" /></SelectTrigger>
                <SelectContent>{grades.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="专业" htmlFor="applicant-major"><Input id="applicant-major" value={register.major} onChange={updateRegister('major')} maxLength={30} placeholder="如：人工智能" /></Field>
            <Field label="密码" htmlFor="applicant-password" hint="至少 8 位。"><Input id="applicant-password" type="password" value={register.password} onChange={updateRegister('password')} maxLength={64} autoComplete="new-password" /></Field>
            <Field label="确认密码" htmlFor="applicant-confirm"><Input id="applicant-confirm" type="password" value={register.confirm} onChange={updateRegister('confirm')} maxLength={64} autoComplete="new-password" /></Field>
          </div>
          <p className="rounded-lg bg-secondary/40 px-4 py-2.5 text-xs leading-5 text-muted-foreground">姓名、学号、年级、专业注册后不能修改，提交的文件会按这些信息统一命名，请如实填写。</p>
          <ErrorLine message={status.error} />
          <Button type="submit" disabled={status.busy} className="gap-2">{status.busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} 注册并登录</Button>
        </form>
      )}
    </div>
  );
}

function PasswordForm({ onDone }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [status, setStatus] = useState({ busy: false, error: '', done: false });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (status.busy) return;
    if (form.next.length < 8) return setStatus({ busy: false, error: '新密码至少 8 位', done: false });
    if (form.next !== form.confirm) return setStatus({ busy: false, error: '两次输入的新密码不一致', done: false });
    setStatus({ busy: true, error: '', done: false });
    try {
      await api.applicant.changePassword(form.current, form.next);
      setStatus({ busy: false, error: '', done: true });
      setForm({ current: '', next: '', confirm: '' });
    } catch (error) {
      setStatus({ busy: false, error: error.message || '修改失败', done: false });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-4 border-t border-border/75 pt-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="当前密码" htmlFor="applicant-current"><Input id="applicant-current" type="password" value={form.current} onChange={update('current')} autoComplete="current-password" maxLength={64} /></Field>
        <Field label="新密码" htmlFor="applicant-next"><Input id="applicant-next" type="password" value={form.next} onChange={update('next')} autoComplete="new-password" maxLength={64} /></Field>
        <Field label="确认新密码" htmlFor="applicant-confirm-next"><Input id="applicant-confirm-next" type="password" value={form.confirm} onChange={update('confirm')} autoComplete="new-password" maxLength={64} /></Field>
      </div>
      <ErrorLine message={status.error} />
      {status.done && <p role="status" className="rounded-lg border border-primary/25 bg-accent/40 px-4 py-2.5 text-sm text-foreground">密码已修改。</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={status.busy} className="gap-1.5">{status.busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} 保存新密码</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>收起</Button>
      </div>
    </form>
  );
}

function AccountBar({ applicant, onSignedOut }) {
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await api.applicant.logout();
    } finally {
      setBusy(false);
      onSignedOut();
    }
  };

  return (
    <div className="rounded-xl border border-border/75 bg-secondary/30 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><UserRound size={17} strokeWidth={1.8} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{applicant.name}<span className="ml-2 font-normal text-muted-foreground">{applicant.student_id}</span></p>
          <p className="truncate text-xs text-muted-foreground">{[applicant.grade, applicant.major].filter(Boolean).join(' · ')} · 这些信息来自你的报名账号，不能在表单里修改</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setChanging((value) => !value)}><KeyRound size={14} aria-hidden="true" /> 修改密码</Button>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={busy} onClick={signOut}><LogOut size={14} aria-hidden="true" /> 退出登录</Button>
        </div>
      </div>
      {changing && <PasswordForm onDone={() => setChanging(false)} />}
    </div>
  );
}

// Shows the sign-in / register card until an applicant is signed in, then the application with the account bar on top.
// An administrator previewing the cohort sees the form with a sample applicant.
export default function ApplicantGate({ grades = [], preview = false, children }) {
  const { loading, applicant, setApplicant } = useApplicant();

  if (preview) {
    return children({ name: '（预览）', student_id: '预览', grade: grades[grades.length - 1] || '', major: '' });
  }
  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>;
  if (!applicant) return <SignInCard grades={grades} onSignedIn={setApplicant} />;
  return (
    <div className="space-y-6">
      <AccountBar applicant={applicant} onSignedOut={() => setApplicant(null)} />
      {children(applicant)}
    </div>
  );
}
