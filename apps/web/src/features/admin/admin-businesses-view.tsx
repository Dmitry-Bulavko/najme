'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  adminBusinessDetailSchema,
  adminBusinessListResponseSchema,
  rejectBusinessRequestSchema,
  type AdminBusinessListItem,
  type BusinessStatus,
  type RejectBusinessRequest,
} from '@najme/contracts';
import { isLocale, toIntlLocale } from '@najme/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { notFound, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session-context';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { cn } from '@/lib/utils';

const STATUS_BY_TAB = {
  pending: 'PENDING_APPROVAL',
  rejected: 'REJECTED',
  approved: 'APPROVED',
} as const satisfies Record<string, BusinessStatus>;

type TabId = keyof typeof STATUS_BY_TAB;

/**
 * Platform-admin moderation queue: tabs by status, detail panel, approve / reject.
 * Non-admins hit `notFound()` (same UX as a missing route).
 */
export function AdminBusinessesView() {
  const t = useTranslations('admin');
  const tCities = useTranslations('cities');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const intlLocale = toIntlLocale(isLocale(locale) ? locale : 'en');
  const router = useRouter();
  const session = useSession();

  const [tab, setTab] = useState<TabId>('pending');
  const [items, setItems] = useState<AdminBusinessListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const rejectForm = useForm<RejectBusinessRequest>({
    resolver: zodResolver(rejectBusinessRequestSchema),
    defaultValues: { reason: '' },
  });

  const load = useCallback(
    async (status: BusinessStatus, cursor?: string, append = false) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams({ status, limit: '20' });
        if (cursor) params.set('cursor', cursor);
        const raw = await apiRequest<unknown>(`/admin/businesses?${params.toString()}`);
        const parsed = adminBusinessListResponseSchema.parse(raw);
        setItems((prev) => (append ? [...prev, ...parsed.items] : parsed.items));
        setNextCursor(parsed.nextCursor);
        if (!append) {
          setSelectedId(parsed.items[0]?.id ?? null);
        }
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
        setError(errorMessage(tErrors, code));
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tErrors],
  );

  useEffect(() => {
    if (session.state === 'anonymous') {
      router.replace(
        `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/admin/businesses`)}`,
      );
    }
  }, [locale, router, session.state]);

  const isPlatformAdmin = session.state === 'authenticated' && session.me.isPlatformAdmin;

  useEffect(() => {
    if (!isPlatformAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch list when tab/session ready
    void load(STATUS_BY_TAB[tab]);
  }, [isPlatformAdmin, load, tab]);

  if (session.state === 'authenticated' && !session.me.isPlatformAdmin) {
    notFound();
  }

  if (session.state === 'loading' || session.state === 'anonymous') {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mt-10 space-y-4" aria-busy="true">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function approveSelected(): Promise<void> {
    if (!selected) return;
    setActionBusy(true);
    try {
      const raw = await apiRequest<unknown>(`/admin/businesses/${selected.id}/approve`, {
        method: 'POST',
      });
      adminBusinessDetailSchema.parse(raw);
      toast.success(t('actions.approvedToast'));
      await load(STATUS_BY_TAB[tab]);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setActionBusy(false);
    }
  }

  async function onReject(values: RejectBusinessRequest): Promise<void> {
    if (!selected) return;
    setActionBusy(true);
    try {
      const raw = await apiRequest<unknown>(`/admin/businesses/${selected.id}/reject`, {
        method: 'POST',
        body: values,
      });
      adminBusinessDetailSchema.parse(raw);
      toast.success(t('actions.rejectedToast'));
      setRejectOpen(false);
      rejectForm.reset({ reason: '' });
      await load(STATUS_BY_TAB[tab]);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setActionBusy(false);
    }
  }

  function cityLabel(city: AdminBusinessListItem['city']): string {
    return tCities(city);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="mt-10 mb-16 space-y-6">
        <div>
          <h1 className="text-title font-bold text-foreground">{t('heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === 'pending' || value === 'rejected' || value === 'approved') {
              setTab(value);
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="pending">{t('tabs.pending')}</TabsTrigger>
            <TabsTrigger value="rejected">{t('tabs.rejected')}</TabsTrigger>
            <TabsTrigger value="approved">{t('tabs.approved')}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-0">
            <div>
              {loading ? (
                <div className="space-y-3" aria-busy="true" aria-label={t('list.loading')}>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : error ? (
                <div className="rounded-md border border-border p-6 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() => void load(STATUS_BY_TAB[tab])}
                  >
                    {t('list.retry')}
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {t('list.empty')}
                </p>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          aria-current={selectedId === item.id ? 'true' : undefined}
                          className={cn(
                            'w-full rounded-md border border-border p-4 text-left transition-colors hover:bg-secondary',
                            // secondary (not accent): accent is brand coral and reads as an error fill
                            selectedId === item.id &&
                              'border-primary bg-secondary text-secondary-foreground',
                          )}
                        >
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('list.owner')}
                            {': '}
                            {item.ownerEmail ?? '—'}
                            {item.ownerEmail ? (
                              <>
                                {' ('}
                                {item.ownerEmailVerified
                                  ? t('list.verified')
                                  : t('list.unverified')}
                                {')'}
                              </>
                            ) : null}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.categoryName}
                            {' · '}
                            {cityLabel(item.city)}
                            {' · '}
                            {t('list.staff', { count: item.staffCount })}
                            {' · '}
                            {t('list.services', { count: item.servicesCount })}
                            {' · '}
                            {t('list.hours', { count: item.staffWithWorkingHoursCount })}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>

                  <aside className="rounded-md border border-border p-5">
                    <h2 className="text-sm font-bold text-foreground">{t('detail.title')}</h2>
                    {!selected ? (
                      <p className="mt-3 text-sm text-muted-foreground">{t('detail.empty')}</p>
                    ) : (
                      <div className="mt-4 space-y-3 text-sm">
                        <p className="text-lg font-semibold text-foreground">{selected.name}</p>
                        <p>
                          <span className="text-muted-foreground">
                            {t('detail.category')}
                            {': '}
                          </span>
                          {selected.categoryName}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            {t('detail.city')}
                            {': '}
                          </span>
                          {cityLabel(selected.city)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            {t('detail.createdAt')}
                            {': '}
                          </span>
                          {new Date(selected.createdAt).toLocaleString(intlLocale)}
                        </p>
                        {selected.reviewedAt ? (
                          <p>
                            <span className="text-muted-foreground">
                              {t('detail.reviewedAt')}
                              {': '}
                            </span>
                            {new Date(selected.reviewedAt).toLocaleString(intlLocale)}
                          </p>
                        ) : null}
                        {selected.rejectionReason ? (
                          <p>
                            <span className="text-muted-foreground">
                              {t('detail.reason')}
                              {': '}
                            </span>
                            {selected.rejectionReason}
                          </p>
                        ) : null}

                        {tab === 'pending' ? (
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button disabled={actionBusy} onClick={() => void approveSelected()}>
                              {actionBusy ? t('actions.approving') : t('actions.approve')}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={actionBusy}
                              onClick={() => setRejectOpen(true)}
                            >
                              {t('actions.reject')}
                            </Button>
                          </div>
                        ) : null}
                        {tab === 'rejected' ? (
                          <div className="pt-2">
                            <Button disabled={actionBusy} onClick={() => void approveSelected()}>
                              {actionBusy ? t('actions.approving') : t('actions.approve')}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </aside>
                </div>
              )}

              {nextCursor && !loading && !error ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => void load(STATUS_BY_TAB[tab], nextCursor, true)}
                  >
                    {t('list.loadMore')}
                  </Button>
                </div>
              ) : null}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) rejectForm.reset({ reason: '' });
        }}
      >
        <DialogContent closeLabel={t('actions.cancel')}>
          <DialogHeader>
            <DialogTitle>{t('actions.rejectTitle')}</DialogTitle>
            <DialogDescription>{t('actions.rejectHint')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={rejectForm.handleSubmit(onReject)}>
            <FormField
              label={t('actions.rejectReasonLabel')}
              error={rejectForm.formState.errors.reason?.message}
            >
              <Textarea rows={4} {...rejectForm.register('reason')} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={actionBusy}>
                {actionBusy ? t('actions.rejecting') : t('actions.rejectConfirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
