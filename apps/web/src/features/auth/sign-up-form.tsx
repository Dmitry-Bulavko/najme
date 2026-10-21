'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { isLocale } from '@najme/i18n';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { z } from 'zod';
import { registerRequestSchema, type AuthSession, type RegisterRequest } from '@najme/contracts';
import { isSupportedLocale } from '@/i18n/routing';
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from '@/i18n/routing';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { GoogleSignInButton } from './google-sign-in-button';
import { replaceLocaleInPath, safeNextPath } from './safe-next-path';
import { useSession } from './session-context';

function setLocaleCookie(localeValue: string): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${localeValue}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

/**
 * Form schema for sign-up. Extends the contract's email/password fields with an optional
 * displayName that allows empty strings (the API omits it when empty; the contract's min(1) would
 * reject an untouched optional field if we used the contract schema directly).
 */
const signUpFormSchema = registerRequestSchema.pick({ email: true, password: true }).extend({
  displayName: z.string().optional(),
});

export function SignUpForm() {
  // auth namespace is nested; access keys as 'signUp.*' (i18n.mdc rule)
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const { signIn } = session;
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const passwordId = useId();
  const passwordErrorId = `${passwordId}-error`;
  const pathLocale = isLocale(locale) ? locale : 'en';

  // Already signed in — skip the form and honour ?next= (or home).
  useEffect(() => {
    if (session.state === 'authenticated') {
      router.replace(safeNextPath(searchParams.get('next'), pathLocale));
    }
  }, [pathLocale, router, searchParams, session.state]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  async function onSubmit(data: z.infer<typeof signUpFormSchema>) {
    setApiError(null);
    const registerLocale = isSupportedLocale(locale) ? locale : undefined;
    const body: RegisterRequest = {
      email: data.email,
      password: data.password,
      locale: registerLocale,
      ...(data.displayName?.trim() ? { displayName: data.displayName.trim() } : {}),
    };
    try {
      const session = await apiRequest<AuthSession>('/auth/register', {
        method: 'POST',
        body,
      });

      signIn(session.accessToken, session.user);

      const next = safeNextPath(searchParams.get('next'), pathLocale);

      // After sign-up, if account locale differs from URL locale, navigate to the correct one.
      if (isLocale(session.user.locale) && session.user.locale !== locale) {
        setLocaleCookie(session.user.locale);
        router.replace(replaceLocaleInPath(next, session.user.locale));
        return;
      }

      router.replace(next);
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(errorMessage(tErrors, error.code));
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

      <FormField label={t('signUp.emailLabel')} error={errors.email?.message}>
        <Input
          {...register('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('emailPlaceholder')}
        />
      </FormField>

      {/* Password rendered manually so the label points to the <input>, not the wrapper <div>. */}
      <div className="grid gap-2">
        <Label htmlFor={passwordId}>{t('signUp.passwordLabel')}</Label>
        <div className="relative">
          <Input
            {...register('password')}
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-10"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? passwordErrorId : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? t('signUp.hidePassword') : t('signUp.showPassword')}
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

      <FormField
        label={t('signUp.displayNameLabel')}
        description={t('signUp.displayNameHint')}
        error={errors.displayName?.message}
      >
        <Input {...register('displayName')} type="text" autoComplete="name" />
      </FormField>

      <Button type="submit" size="md" loading={isSubmitting} className="w-full">
        {t('signUp.submit')}
      </Button>

      <GoogleSignInButton />

      <p className="text-center text-sm text-muted-foreground">
        {t('signUp.hasAccount')}{' '}
        <Link href={`/${locale}/sign-in`} className="font-medium text-primary hover:underline">
          {t('signUp.signInLink')}
        </Link>
      </p>
    </form>
  );
}
