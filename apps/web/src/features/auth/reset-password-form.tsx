'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@najme/contracts';
import { Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useEmailLinkToken } from './use-email-link-token';

type ResetFormValues = {
  newPassword: string;
  confirmPassword: string;
};

/**
 * Reset-password form. Reads `token` from the query string (email link) and POSTs
 * `/auth/reset-password`. On success redirects to sign-in.
 */
export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const token = useEmailLinkToken();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const passwordId = useId();
  const confirmId = useId();
  const passwordErrorId = `${passwordId}-error`;
  const confirmErrorId = `${confirmId}-error`;

  const resetFormSchema = useMemo(
    () =>
      z
        .object({
          newPassword: passwordSchema,
          confirmPassword: z.string().min(1),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          path: ['confirmPassword'],
          message: t('passwordReset.mismatch'),
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetFormSchema),
  });

  if (!token) {
    return (
      <div className="grid gap-4 text-center">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('passwordReset.missingToken')}
        </p>
        <Link
          href={`/${locale}/forgot-password`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('passwordReset.requestNewLink')}
        </Link>
      </div>
    );
  }

  async function onSubmit(data: ResetFormValues) {
    setApiError(null);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword: data.newPassword },
      });
      router.replace(`/${locale}/sign-in`);
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

      <div className="grid gap-2">
        <Label htmlFor={passwordId}>{t('passwordReset.passwordLabel')}</Label>
        <div className="relative">
          <Input
            {...register('newPassword')}
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className="pr-10"
            aria-invalid={errors.newPassword ? true : undefined}
            aria-describedby={errors.newPassword ? passwordErrorId : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={
              showPassword ? t('passwordReset.hidePassword') : t('passwordReset.showPassword')
            }
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.newPassword?.message ? (
          <p id={passwordErrorId} role="alert" className="text-xs font-medium text-destructive">
            {errors.newPassword.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={confirmId}>{t('passwordReset.confirmLabel')}</Label>
        <Input
          {...register('confirmPassword')}
          id={confirmId}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? confirmErrorId : undefined}
        />
        {errors.confirmPassword?.message ? (
          <p id={confirmErrorId} role="alert" className="text-xs font-medium text-destructive">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="md" loading={isSubmitting} className="w-full">
        {t('passwordReset.submit')}
      </Button>
    </form>
  );
}
