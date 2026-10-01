import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';
import { Suspense } from 'react';

import { AcceptInvitationPanel } from '@/features/team/accept-invitation-panel';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return {
    title: t('inviteAccept.pageTitle'),
    // ADR-0011: token pages must not leak the query through Referer.
    referrer: 'no-referrer',
  };
}

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ReactElement> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="mx-auto mt-16 w-full max-w-sm">
        <Suspense
          fallback={
            <p role="status" className="text-center text-sm text-muted-foreground">
              {t('inviteAccept.loading')}
            </p>
          }
        >
          <AcceptInvitationPanel />
        </Suspense>
      </div>
    </div>
  );
}
