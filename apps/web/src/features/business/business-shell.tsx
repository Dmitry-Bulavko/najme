'use client';

import { businessSchema, type Business, type MembershipRole } from '@najme/contracts';
import { Menu } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { notFound, usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/session-context';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { cn } from '@/lib/utils';

import { isSchedulePathActive, resolveScheduleHref } from '@/features/schedule/schedule-href';

import { businessHref, navItemsForRole } from './business-nav';
import { writeLastBusinessId } from './last-business';
import { useMyBusinesses } from './use-my-businesses';

type BusinessContextValue = {
  business: Business;
  setBusiness: (update: Business | ((prev: Business) => Business)) => void;
  reload: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function useBusinessContext(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error('useBusinessContext must be used under BusinessShell');
  }
  return ctx;
}

type BusinessNavLinksProps = {
  businessId: string;
  role: MembershipRole;
  locale: string;
  pathname: string;
  onNavigate?: () => void;
};

function BusinessNavLinks({
  businessId,
  role,
  locale,
  pathname,
  onNavigate,
}: BusinessNavLinksProps) {
  const t = useTranslations('business');
  const { data: myBusinesses } = useMyBusinesses();
  const staffMemberId = useMemo(() => {
    const row = myBusinesses?.find((b) => b.businessId === businessId);
    return row?.staffMemberId ?? null;
  }, [businessId, myBusinesses]);
  const items = navItemsForRole(role);

  return (
    <nav aria-label={t('shell.navLabel')}>
      <ul className="grid gap-1">
        {items.map((item) => {
          const href =
            item.dynamicHref === 'schedule'
              ? resolveScheduleHref(locale, businessId, role, staffMemberId)
              : businessHref(locale, businessId, item.segment);
          if (!href) {
            return null;
          }
          const active =
            item.dynamicHref === 'schedule'
              ? isSchedulePathActive(pathname, locale, businessId, role, staffMemberId)
              : item.segment === ''
                ? pathname === href
                : item.key === 'staff'
                  ? // Staff schedule lives under `/staff/[id]/schedule` — keep only one nav item active.
                    (pathname === href || pathname.startsWith(`${href}/`)) &&
                    !pathname.includes('/schedule')
                  : pathname === href || pathname.startsWith(`${href}/`);
          const label =
            item.key === 'schedule' && role === 'STAFF'
              ? t('shell.mySchedule')
              : t(`shell.${item.labelKey}`);
          return (
            <li key={item.key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'flex items-center rounded-md px-3 py-2 text-sm font-bold text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring',
                  active &&
                    'bg-secondary text-secondary-foreground shadow-[inset_3px_0_0_0_var(--color-primary)]',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href={`/${locale}/business?pick=1`}
            onClick={onNavigate}
            className="flex items-center rounded-md px-3 py-2 text-sm font-bold text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('menu.switchBusiness')}
          </Link>
        </li>
        <li>
          <Link
            href={`/${locale}`}
            onClick={onNavigate}
            className="flex items-center rounded-md px-3 py-2 text-sm font-bold text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('shell.clientMode')}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

type BusinessShellProps = {
  businessId: string;
  children: ReactNode;
};

/**
 * Role-aware business dashboard chrome: sidebar on wide screens, Sheet on narrow.
 * Client mode keeps the remembered business id; Switch business opens the picker.
 */
export function BusinessShell({ businessId, children }: BusinessShellProps) {
  const t = useTranslations('business');
  const tShell = useTranslations('shell');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const raw = await apiRequest<unknown>(`/businesses/${businessId}`);
      const parsed = businessSchema.parse(raw);
      setBusiness(parsed);
      writeLastBusinessId(parsed.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setMissing(true);
        return;
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(errorMessage(tErrors, code));
    }
  }, [businessId, tErrors]);

  useEffect(() => {
    if (session.state === 'anonymous') {
      // Preserve the full path (incl. nested segments) for post-sign-in return.
      router.replace(`/${locale}/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [locale, pathname, router, session.state]);

  useEffect(() => {
    if (session.state !== 'authenticated') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load detail when auth ready
    void load();
  }, [load, session.state]);

  const updateBusiness = useCallback((update: Business | ((prev: Business) => Business)) => {
    setBusiness((prev) => {
      if (!prev) return prev;
      return typeof update === 'function' ? update(prev) : update;
    });
  }, []);

  const ctxValue = useMemo(
    () => (business ? { business, setBusiness: updateBusiness, reload: load } : null),
    [business, load, updateBusiness],
  );

  if (missing) {
    notFound();
  }

  if (session.state === 'loading' || session.state === 'anonymous' || (!business && !error)) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (error || !business || !ctxValue) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 text-center">
        <p className="text-sm text-destructive">{error ?? t('overview.error')}</p>
        <Button className="mt-3" variant="outline" onClick={() => void load()}>
          {t('overview.retry')}
        </Button>
      </div>
    );
  }

  const current = business;

  return (
    <BusinessContext.Provider value={ctxValue}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mt-6 mb-16 flex flex-col gap-6 lg:flex-row">
          <aside className="hidden w-56 shrink-0 lg:block">
            <p className="mb-3 truncate text-sm font-bold text-foreground">{current.name}</p>
            <BusinessNavLinks
              businessId={current.id}
              role={current.myRole}
              locale={locale}
              pathname={pathname}
            />
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-center gap-2 lg:hidden">
              <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label={t('shell.openMenu')}>
                    <Menu className="size-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" closeLabel={tShell('close')} aria-describedby={undefined}>
                  <SheetHeader>
                    <SheetTitle>{t('shell.menuTitle')}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <p className="mb-3 truncate text-sm font-bold">{current.name}</p>
                    <BusinessNavLinks
                      businessId={current.id}
                      role={current.myRole}
                      locale={locale}
                      pathname={pathname}
                      onNavigate={() => setNavOpen(false)}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              <p className="truncate text-sm font-bold text-foreground">{current.name}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    </BusinessContext.Provider>
  );
}
