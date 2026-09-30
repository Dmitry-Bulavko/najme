import { SUPPORTED_LOCALES, toIntlLocale } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Manrope } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/shell/site-footer';
import { SiteHeader } from '@/components/shell/site-header';
import { Toaster } from '@/components/ui/sonner';
import { AppProviders } from '@/features/auth/query-provider';
import { isSupportedLocale } from '@/i18n/routing';

import '../globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
});

export function generateStaticParams(): { locale: string }[] {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}): Promise<ReactNode> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const [messages, t] = await Promise.all([getMessages(), getTranslations('shell')]);

  return (
    <html lang={toIntlLocale(locale)} className={manrope.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>
            <a
              href="#content"
              className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
            >
              {t('skipToContent')}
            </a>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <main id="content" className="flex-1">
                {children}
              </main>
              <SiteFooter />
            </div>
            <Toaster />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
