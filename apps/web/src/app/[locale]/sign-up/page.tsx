import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { SignUpForm } from '@/features/auth/sign-up-form';

/**
 * `/[locale]/sign-up` — account creation.
 * Already-signed-in redirect is handled client-side in SignUpForm via useSession.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signUp.title') };
}

export default async function SignUpPage({
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
          <h1 className="text-title font-bold">{t('signUp.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('signUp.subtitle')}</p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
