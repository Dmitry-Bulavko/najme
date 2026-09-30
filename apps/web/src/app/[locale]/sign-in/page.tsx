import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { SignInForm } from '@/features/auth/sign-in-form';

/**
 * `/[locale]/sign-in` — email + password sign-in.
 * Already-signed-in redirect is handled client-side in SignInForm via useSession.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signIn.title') };
}

export default async function SignInPage({
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
          <h1 className="text-title font-bold">{t('signIn.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('signIn.subtitle')}</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
