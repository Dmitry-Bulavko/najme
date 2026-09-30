import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { Suspense } from 'react';

import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('forgotPassword.title') };
}

export default async function ForgotPasswordPage({
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
          <h1 className="text-title font-bold">{t('forgotPassword.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('forgotPassword.subtitle')}</p>
        </div>
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
