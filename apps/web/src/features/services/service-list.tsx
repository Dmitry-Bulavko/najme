'use client';

import {
  formatMinorAsMajor,
  servicesResponseSchema,
  type ContractLocale,
  type Service,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessContext } from '@/features/business/business-shell';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

/** Services list: duration, price, staff count, active; OWNER/ADMIN can manage. */
export function ServiceList() {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale() as ContractLocale;
  const { business } = useBusinessContext();
  const canManage = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const base = `/${locale}/business/${business.id}/services`;

  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/services`);
      setServices(servicesResponseSchema.parse(raw));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(errorMessage(tErrors, code));
      setServices(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, tErrors]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / business change
    void load();
  }, [load]);

  const empty = useMemo(() => services !== null && services.length === 0, [services]);

  async function confirmDelete(serviceId: string): Promise<void> {
    setDeletingId(serviceId);
    try {
      await apiRequest(`/businesses/${business.id}/services/${serviceId}`, { method: 'DELETE' });
      toast.success(t('services.deletedToast'));
      setServices((prev) => prev?.filter((s) => s.id !== serviceId) ?? null);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-foreground">{t('services.heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? t('services.subtitle') : t('services.readOnlySubtitle')}
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href={`${base}/new`}>{t('services.add')}</Link>
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('services.loading')}>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-border p-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void load()}>
            {t('services.retry')}
          </Button>
        </div>
      ) : empty ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('services.empty')}</p>
          {canManage ? (
            <Button asChild className="mt-4">
              <Link href={`${base}/new`}>{t('services.emptyCta')}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {services?.map((service) => (
            <li
              key={service.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{service.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('services.listMeta', {
                    duration: service.durationMinutes,
                    price: `${formatMinorAsMajor(service.price.amount, locale)} ${service.price.currency}`,
                    staffCount: service.staffMemberIds.length,
                  })}
                </p>
              </div>
              <span
                className={
                  service.active
                    ? 'text-xs font-bold text-foreground'
                    : 'text-xs font-bold text-muted-foreground'
                }
              >
                {service.active ? t('services.active') : t('services.inactive')}
              </span>
              {canManage ? (
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`${base}/${service.id}`}>{t('services.edit')}</Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === service.id}
                      >
                        {t('services.delete')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('services.deleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('services.deleteDescription', { name: service.name })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('services.deleteCancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deletingId === service.id}
                          onClick={(event) => {
                            event.preventDefault();
                            void confirmDelete(service.id);
                          }}
                        >
                          {deletingId === service.id
                            ? t('services.deleting')
                            : t('services.deleteConfirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
