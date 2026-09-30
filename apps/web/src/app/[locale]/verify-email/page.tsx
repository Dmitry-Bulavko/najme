import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { Suspense } from 'react';

import { VerifyEmailPanel } from '@/features/auth/verify-email-panel';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('emailVerification.title') };
}

export default async function VerifyEmailPage({
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
          <h1 className="text-title font-bold">{t('emailVerification.title')}</h1>
        </div>
        <Suspense
          fallback={
            <p role="status" className="text-center text-sm text-muted-foreground">
              {t('emailVerification.verifying')}
            </p>
          }
        >
          <VerifyEmailPanel />
        </Suspense>
      </div>
    </div>
  );
}
