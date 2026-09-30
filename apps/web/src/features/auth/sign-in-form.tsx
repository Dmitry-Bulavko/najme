'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isLocale } from '@najme/i18n';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginRequestSchema, type AuthSession, type LoginRequest } from '@najme/contracts';
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from '@/i18n/routing';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useSession } from './session-context';

function setLocaleCookie(localeValue: string): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${localeValue}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export function SignInForm() {
  // auth namespace is nested; access keys as 'signIn.*' (i18n.mdc rule)
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const passwordId = useId();
  const passwordErrorId = `${passwordId}-error`;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
  });

  async function onSubmit(data: LoginRequest) {
    setApiError(null);
    try {
      const session = await apiRequest<AuthSession>('/auth/login', {
        method: 'POST',
        body: data,
      });

      signIn(session.accessToken, session.user);

      // After sign-in, if account locale differs from URL locale, navigate to the correct one.
      if (isLocale(session.user.locale) && session.user.locale !== locale) {
        setLocaleCookie(session.user.locale);
        const next = searchParams.get('next');
        const target = next ?? '/';
        const segments = target.split('/');
        segments[1] = session.user.locale;
        router.replace(segments.join('/') || `/${session.user.locale}`);
        return;
      }

      const next = searchParams.get('next');
      router.replace(next ?? `/${locale}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(tErrors(error.code as Parameters<typeof tErrors>[0]));
      } else {
        setApiError(tErrors('HTTP_ERROR'));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {apiError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {apiError}
        </p>
      ) : null}

      <FormField label={t('signIn.emailLabel')} error={errors.email?.message}>
        <Input
          {...register('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
        />
      </FormField>

      {/* Password rendered manually so the label points to the <input>, not the wrapper <div>. */}
      <div className="grid gap-2">
        <Label htmlFor={passwordId}>{t('signIn.passwordLabel')}</Label>
        <div className="relative">
          <Input
            {...register('password')}
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="pr-10"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? passwordErrorId : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? t('signIn.hidePassword') : t('signIn.showPassword')}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password?.message ? (
          <p id={passwordErrorId} role="alert" className="text-xs font-medium text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Link
          href={`/${locale}/forgot-password`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {t('signIn.forgotPassword')}
        </Link>
      </div>

      <Button type="submit" size="md" loading={isSubmitting} className="w-full">
        {t('signIn.submit')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('signIn.noAccount')}{' '}
        <Link href={`/${locale}/sign-up`} className="font-medium text-primary hover:underline">
          {t('signIn.signUpLink')}
        </Link>
      </p>
    </form>
  );
}
