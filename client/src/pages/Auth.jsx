import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, ErrorBanner, Field, Input } from '../components/ui/index.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { Logo } from '../layouts/AppLayout.jsx';
import { useAuth } from '../store/authStore.js';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="mb-8"><Logo /></div>
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-7">
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-sm text-slate-600">{footer}</p>
    </div>
  );
}

function useAuthForm(action) {
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const submit = (values, onDone) => async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      onDone(await action(values));
    } catch (err) {
      if (Array.isArray(err.details)) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return { error, fieldErrors, loading, submit };
}

export function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const { error, fieldErrors, loading, submit } = useAuthForm(login);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <AuthShell
      title="Log in"
      subtitle="Log in to see your forms."
      footer={<>No account yet? <Link to="/register" className="font-medium text-brand-600 hover:underline">Sign up</Link></>}
    >
      <form className="space-y-4" onSubmit={submit(values, () => navigate(location.state?.from ?? '/dashboard', { replace: true }))}>
        <ErrorBanner>{error}</ErrorBanner>
        <Field label="Email" error={fieldErrors.email} required>
          {(a) => <Input {...a} type="email" autoComplete="email" value={values.email} onChange={set('email')} required />}
        </Field>
        <Field label="Password" error={fieldErrors.password} required>
          {(a) => <Input {...a} type="password" autoComplete="current-password" value={values.password} onChange={set('password')} required />}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>Log in</Button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [confirmEmail, setConfirmEmail] = useState(false);
  const { error, fieldErrors, loading, submit } = useAuthForm(register);
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  if (confirmEmail) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`We sent a confirmation link to ${values.email}. Confirm your email, then log in.`}
        footer={<Link to="/login" className="font-medium text-brand-600 hover:underline">Go to log in</Link>}
      />
    );
  }

  return (
    <AuthShell
      title="Sign up"
      subtitle="Takes a minute. No card needed."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline">Log in</Link></>}
    >
      <form
        className="space-y-4"
        onSubmit={submit(values, ({ requiresConfirmation }) =>
          requiresConfirmation ? setConfirmEmail(true) : navigate('/dashboard', { replace: true }))}
      >
        <ErrorBanner>{error}</ErrorBanner>
        <Field label="Name" error={fieldErrors.name} required>
          {(a) => <Input {...a} autoComplete="name" value={values.name} onChange={set('name')} required maxLength={100} />}
        </Field>
        <Field label="Email" error={fieldErrors.email} required>
          {(a) => <Input {...a} type="email" autoComplete="email" value={values.email} onChange={set('email')} required />}
        </Field>
        <Field label="Password" hint="At least 8 characters." error={fieldErrors.password} required>
          {(a) => <Input {...a} type="password" autoComplete="new-password" value={values.password} onChange={set('password')} required minLength={8} maxLength={72} />}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>Sign up</Button>
      </form>
    </AuthShell>
  );
}
