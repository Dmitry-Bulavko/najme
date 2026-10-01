'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { clearLastBusinessId, writeLastBusinessId } from './last-business';
import { useMyBusinesses } from './use-my-businesses';

/**
 * Account-menu entries for business mode: create, open the only membership, or the list page.
 */
export function AccountBusinessMenu() {
  const t = useTranslations('business');
  const locale = useLocale();
  const router = useRouter();
  const { data, isLoading, isError } = useMyBusinesses();

  if (isLoading) {
    return (
      <DropdownMenuItem disabled>
        <Skeleton className="h-4 w-28" />
      </DropdownMenuItem>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <DropdownMenuItem asChild>
        <Link href={`/${locale}/business/new`}>{t('menu.createBusiness')}</Link>
      </DropdownMenuItem>
    );
  }

  if (data.length === 1) {
    const only = data[0]!;
    return (
      <>
        <DropdownMenuItem
          onSelect={() => {
            writeLastBusinessId(only.businessId);
            router.push(`/${locale}/business/${only.businessId}`);
          }}
        >
          {t('menu.businessMode')}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/business/new`}>{t('menu.createBusiness')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            clearLastBusinessId();
            router.push(`/${locale}`);
          }}
        >
          {t('menu.clientMode')}
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <>
      <DropdownMenuItem asChild>
        <Link href={`/${locale}/business`}>{t('menu.businessMode')}</Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={`/${locale}/business/new`}>{t('menu.createBusiness')}</Link>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          clearLastBusinessId();
          router.push(`/${locale}`);
        }}
      >
        {t('menu.clientMode')}
      </DropdownMenuItem>
    </>
  );
}
