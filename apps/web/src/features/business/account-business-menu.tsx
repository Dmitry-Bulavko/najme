'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { writeLastBusinessId } from './last-business';
import { useMyBusinesses } from './use-my-businesses';

/**
 * Account-menu business entries: list memberships as a picker, create, and client mode.
 * Client mode does not clear the remembered business id.
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

  if (isError) {
    return (
      <>
        <DropdownMenuItem disabled>{t('list.error')}</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/business/new`}>{t('menu.createBusiness')}</Link>
        </DropdownMenuItem>
      </>
    );
  }

  if (!data || data.length === 0) {
    return (
      <DropdownMenuItem asChild>
        <Link href={`/${locale}/business/new`}>{t('menu.createBusiness')}</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenuLabel>{t('menu.switchBusiness')}</DropdownMenuLabel>
      {data.map((biz) => (
        <DropdownMenuItem
          key={biz.businessId}
          onSelect={() => {
            writeLastBusinessId(biz.businessId);
            router.push(`/${locale}/business/${biz.businessId}`);
          }}
        >
          <span className="truncate">{biz.name}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href={`/${locale}/business/new`}>{t('menu.createBusiness')}</Link>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          router.push(`/${locale}`);
        }}
      >
        {t('menu.clientMode')}
      </DropdownMenuItem>
    </>
  );
}
