'use client';

import {
  businessMemberListResponseSchema,
  staffMembersResponseSchema,
  type BusinessMember,
  type StaffMember,
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

function linkedLabel(
  staffId: string,
  members: BusinessMember[] | null,
  t: ReturnType<typeof useTranslations<'business'>>,
): string {
  if (!members) return t('staff.linkedUnknown');
  const member = members.find((m) => m.staffMemberId === staffId);
  if (!member) return t('staff.notLinked');
  return member.displayName?.trim() || member.email;
}

/** Staff list with photo, name, active flag, linked member; OWNER/ADMIN can create/edit/delete. */
export function StaffList() {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const { business } = useBusinessContext();
  const canManage = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const base = `/${locale}/business/${business.id}/staff`;

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [members, setMembers] = useState<BusinessMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const staffRaw = await apiRequest<unknown>(`/businesses/${business.id}/staff`);
      setStaff(staffMembersResponseSchema.parse(staffRaw));
      if (canManage) {
        try {
          const membersRaw = await apiRequest<unknown>(`/businesses/${business.id}/members`);
          setMembers(businessMemberListResponseSchema.parse(membersRaw));
        } catch {
          setMembers(null);
        }
      } else {
        setMembers(null);
      }
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(errorMessage(tErrors, code));
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, canManage, tErrors]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / business change
    void load();
  }, [load]);

  const empty = useMemo(() => staff !== null && staff.length === 0, [staff]);

  async function confirmDelete(staffId: string): Promise<void> {
    setDeletingId(staffId);
    try {
      await apiRequest(`/businesses/${business.id}/staff/${staffId}`, { method: 'DELETE' });
      toast.success(t('staff.deletedToast'));
      setStaff((prev) => prev?.filter((s) => s.id !== staffId) ?? null);
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
          <h1 className="text-title font-bold text-foreground">{t('staff.heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? t('staff.subtitle') : t('staff.readOnlySubtitle')}
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link href={`${base}/new`}>{t('staff.add')}</Link>
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('staff.loading')}>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-border p-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void load()}>
            {t('staff.retry')}
          </Button>
        </div>
      ) : empty ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('staff.empty')}</p>
          {canManage ? (
            <Button asChild className="mt-4">
              <Link href={`${base}/new`}>{t('staff.emptyCta')}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {staff?.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
            >
              <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-secondary">
                {member.photoUrl ? (
                  // Plain img: storage hosts differ per environment (same as ImageUpload).
                  // eslint-disable-next-line @next/next/no-img-element -- remote upload URLs
                  <img
                    src={member.photoUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="size-12 object-cover"
                  />
                ) : (
                  <span className="flex size-12 items-center justify-center text-xs font-bold text-muted-foreground">
                    {member.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{member.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t('staff.linkedLabel', {
                    name: linkedLabel(member.id, members, t),
                  })}
                </p>
              </div>
              <span
                className={
                  member.active
                    ? 'text-xs font-bold text-foreground'
                    : 'text-xs font-bold text-muted-foreground'
                }
              >
                {member.active ? t('staff.active') : t('staff.inactive')}
              </span>
              {canManage ? (
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`${base}/${member.id}`}>{t('staff.edit')}</Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === member.id}
                      >
                        {t('staff.delete')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('staff.deleteTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('staff.deleteDescription', { name: member.displayName })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('staff.deleteCancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deletingId === member.id}
                          onClick={(event) => {
                            event.preventDefault();
                            void confirmDelete(member.id);
                          }}
                        >
                          {deletingId === member.id
                            ? t('staff.deleting')
                            : t('staff.deleteConfirm')}
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
