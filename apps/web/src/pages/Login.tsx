import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useData';
import { getErrorMessage } from '../lib/errors';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Fields';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

const demos = [
  { role: 'Admin', email: 'admin@smartstock.dev' },
  { role: 'Manager', email: 'manager@smartstock.dev' },
  { role: 'Employee', email: 'employee@smartstock.dev' },
];

export default function Login() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string; registeredEmail?: string } | null)?.from;
  const registeredEmail = (location.state as { from?: string; registeredEmail?: string } | null)?.registeredEmail;
  const redirectTo = from && from !== '/login' && from !== '/register' ? from : '/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: registeredEmail || '', password: '' },
  });

  useEffect(() => {
    if (registeredEmail) {
      setValue('email', registeredEmail, { shouldValidate: true });
    }
  }, [registeredEmail, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.email.trim(), values.password);
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      setError(getErrorMessage(loginError, 'Sign in failed. Check your email and password.'));
    }
  });

  const fillDemo = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Passw0rd!', { shouldValidate: true });
    setError(null);
  };

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-navy-950">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-navy-950 p-10 text-white lg:flex xl:w-[50%] xl:p-14">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-brand-500/20 blur-[110px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-sky-500/10 blur-[100px]"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-inset ring-brand-400/25">
              <Boxes className="h-6 w-6 text-brand-400" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-bold tracking-tight">SmartStock</p>
              <p className="text-[11px] font-medium text-slate-500">Inventory control</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            Operations, in sync
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white xl:text-[44px] xl:leading-[1.08]">
            Inventory clarity,
            <br />
            in real time.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            One calm workspace for products, stock movements, purchase orders and the alerts that
            keep your shelves honest.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              {
                icon: <Radio className="h-4 w-4" aria-hidden="true" />,
                title: 'Live updates',
                text: 'Stock and order changes appear instantly for everyone.',
              },
              {
                icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
                title: 'Audited by design',
                text: 'Every movement is immutable and tied to the person who made it.',
              },
              {
                icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
                title: 'Decisions with context',
                text: 'Valuation, low-stock and purchasing signals from real data.',
              },
            ].map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-brand-300 ring-1 ring-inset ring-white/10">
                  {feature.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{feature.title}</p>
                  <p className="text-xs leading-relaxed text-slate-500">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-6 border-t border-white/10 pt-6 text-[11px] text-slate-500">
          <span>Role-based access</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" aria-hidden="true" />
          <span>Purchase order workflow</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" aria-hidden="true" />
          <span>Dark mode ready</span>
        </div>
      </aside>

      <main className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-navy-900 text-brand-400">
              <Boxes className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">SmartStock</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Inventory control</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-400">
            Welcome back
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Sign in to your workspace
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Use your SmartStock account to continue.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            {registeredEmail && !error ? (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Account created successfully! Please sign in with your credentials.
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            ) : null}

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
              error={errors.password?.message}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              }
              {...register('password')}
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
              >
                Forgot your password?
              </Link>
            </div>

            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
              Sign in
              {!isSubmitting ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
            </Button>

            <div className="text-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
                >
                  Create an account
                </Link>
              </span>
            </div>
          </form>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-navy-900/60">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Demo accounts
              </p>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Password: Passw0rd!
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {demos.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => fillDemo(demo.email)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-navy-950 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
                >
                  <span className="block font-semibold">{demo.role}</span>
                  <span className="block truncate text-[10px] text-slate-400">{demo.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
              Demo data is seeded on the API. Accounts are for local development only.
            </p>
          </div>

          <p className="mt-8 text-center text-[11px] text-slate-400">
            SmartStock v1.0 · Inventory, purchasing and stock control
          </p>
        </div>
      </main>
    </div>
  );
}
