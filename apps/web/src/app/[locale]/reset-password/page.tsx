import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('passwordReset.title'),
    // ADR-0011: token pages must not leak the query through Referer.
    referrer: 'no-referrer',
  };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="mx-auto mt-16 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-title font-bold">{t('passwordReset.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('passwordReset.subtitle')}</p>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
