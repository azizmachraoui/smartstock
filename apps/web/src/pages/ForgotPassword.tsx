import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Mail } from 'lucide-react';
import { authService } from '../services/api';
import { getErrorMessage } from '../lib/errors';
import { useDocumentTitle } from '../hooks/useData';
import { AuthShell } from '../components/layout/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Fields';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  useDocumentTitle('Forgot password');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await authService.forgotPassword(values.email.trim());
      setSent(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  });

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        description="If an account exists for that address, a reset link has been generated."
      >
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Request received</p>
            <p className="mt-1 text-xs leading-relaxed">
              In this development build the reset link is printed to the API server log instead of
              being emailed. Copy the token from that log to continue.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Link to="/reset-password">
            <Button className="w-full">I have a reset token</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email address linked to your account and we'll generate a reset link."
      footer={
        <span>
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
            {error}
          </p>
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
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
