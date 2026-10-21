'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

/**
 * Forgot-password form. Always shows the "sent" confirmation after a successful 202 so the
 * response never reveals whether the email exists (ADR-0011).
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
  });

  async function onSubmit(data: ForgotPasswordRequest) {
    setApiError(null);
    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: data });
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(errorMessage(tErrors, error.code));
      } else {
        setApiError(tErrors('HTTP_ERROR'));
      }
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4 text-center">
        <p role="status" className="rounded-md bg-success/10 px-3 py-3 text-sm text-text01">
          <span className="block font-bold">{t('forgotPassword.sentTitle')}</span>
          <span className="mt-1 block text-muted-foreground">{t('forgotPassword.sentBody')}</span>
        </p>
        <Link
          href={`/${locale}/sign-in`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('forgotPassword.backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      {apiError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {apiError}
        </p>
      ) : null}

      <FormField label={t('forgotPassword.emailLabel')} error={errors.email?.message}>
        <Input
          {...register('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('emailPlaceholder')}
        />
      </FormField>

      <Button type="submit" size="md" loading={isSubmitting} className="w-full">
        {t('forgotPassword.submit')}
      </Button>

      <p className="text-center text-sm">
        <Link
          href={`/${locale}/sign-in`}
          className="font-medium text-muted-foreground hover:text-foreground hover:underline"
        >
          {t('forgotPassword.backToSignIn')}
        </Link>
      </p>
    </form>
  );
}
