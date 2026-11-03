import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { authService } from '../services/api';
import { useDocumentTitle } from '../hooks/useData';
import { getErrorMessage, getFieldErrors } from '../lib/errors';
import { AuthShell } from '../components/layout/AuthShell';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Fields';

const registerFormSchema = z
  .object({
    firstName: z
      .string({ required_error: 'First name is required' })
      .trim()
      .min(1, 'First name is required')
      .max(50, 'First name is too long'),
    lastName: z
      .string({ required_error: 'Last name is required' })
      .trim()
      .min(1, 'Last name is required')
      .max(50, 'Last name is too long'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email address'),
    phone: z.string().trim().optional(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one digit'),
    confirmPassword: z
      .string({ required_error: 'Please confirm your password' })
      .min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof registerFormSchema>;

export default function Register() {
  useDocumentTitle('Create account');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await authService.register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || undefined,
        password: values.password,
      });
      setRegisteredEmail(values.email.trim());
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) {
        for (const [field, msg] of Object.entries(fieldErrors)) {
          if (field in values) {
            setFieldError(field as keyof FormValues, { message: msg });
          }
        }
      }
      setError(getErrorMessage(err, 'Failed to create account. Please check your information.'));
    }
  });

  if (registeredEmail) {
    return (
      <AuthShell
        title="Account created successfully"
        description="Your SmartStock workspace account has been registered with the EMPLOYEE role."
      >
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div>
            <p className="font-semibold">Ready to sign in</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
              Your account <span className="font-mono font-medium">{registeredEmail}</span> is ready. You can now sign in with your password to access the workspace.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Link to="/login" state={{ registeredEmail }} className="block w-full">
            <Button type="button" className="w-full">
              Sign in to your account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      description="Register for a SmartStock account to access inventory and operations."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-400"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="First name"
            type="text"
            autoComplete="given-name"
            placeholder="Jane"
            required
            leftIcon={<UserIcon className="h-4 w-4" aria-hidden="true" />}
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            label="Last name"
            type="text"
            autoComplete="family-name"
            placeholder="Doe"
            required
            leftIcon={<UserIcon className="h-4 w-4" aria-hidden="true" />}
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="jane.doe@company.com"
          required
          leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Phone number"
          type="tel"
          autoComplete="tel"
          placeholder="+1 555-0123 (optional)"
          leftIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="At least 8 chars, 1 uppercase, 1 digit"
          required
          leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
          error={errors.password?.message}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
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

        <Input
          label="Confirm password"
          type={showConfirmPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
          leftIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
          error={errors.confirmPassword?.message}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          }
          {...register('confirmPassword')}
        />

        <div className="pt-2">
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Create account
            {!isSubmitting ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
