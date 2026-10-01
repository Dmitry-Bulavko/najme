'use client';

import {
  businessMemberListResponseSchema,
  businessMemberSchema,
  invitationListResponseSchema,
  invitationSchema,
  staffMembersResponseSchema,
  updateMemberRequestSchema,
  type BusinessMember,
  type Invitation,
  type MembershipRole,
  type StaffMember,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/session-context';
import { useBusinessContext } from '@/features/business/business-shell';
import { clearLastBusinessId } from '@/features/business/last-business';
import { useInvalidateMyBusinesses } from '@/features/business/use-my-businesses';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import { formatInvitationExpiry } from './format-invitation-expiry';
import { InviteDialog } from './invite-dialog';

const NONE_VALUE = '__none__';

function roleBadgeVariant(role: MembershipRole): 'default' | 'secondary' | 'outline' {
  if (role === 'OWNER') return 'default';
  if (role === 'ADMIN') return 'secondary';
  return 'outline';
}

function staffName(
  staffId: string | null,
  staff: StaffMember[],
  t: ReturnType<typeof useTranslations<'business'>>,
): string {
  if (!staffId) return t('team.notLinked');
  const found = staff.find((s) => s.id === staffId);
  return found?.displayName ?? t('team.notLinked');
}

function availableStaffForMember(
  member: BusinessMember,
  staff: StaffMember[],
  members: BusinessMember[],
): StaffMember[] {
  const linkedElsewhere = new Set(
    members
      .filter((m) => m.id !== member.id && m.staffMemberId)
      .map((m) => m.staffMemberId as string),
  );
  return staff.filter((s) => s.id === member.staffMemberId || !linkedElsewhere.has(s.id));
}

/** Team management: members, invitations, leave (OWNER/ADMIN). */
export function TeamView() {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const session = useSession();
  const { business } = useBusinessContext();
  const invalidateMyBusinesses = useInvalidateMyBusinesses();
  const canManage = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const isOwner = business.myRole === 'OWNER';
  const myUserId = session.state === 'authenticated' ? session.me.id : null;

  const [members, setMembers] = useState<BusinessMember[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { role: MembershipRole; staffMemberId: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRaw, invitationsRaw, staffRaw] = await Promise.all([
        apiRequest<unknown>(`/businesses/${business.id}/members`),
        apiRequest<unknown>(`/businesses/${business.id}/invitations`),
        apiRequest<unknown>(`/businesses/${business.id}/staff`),
      ]);
      const parsedMembers = businessMemberListResponseSchema.parse(membersRaw);
      const parsedInvitations = invitationListResponseSchema.parse(invitationsRaw);
      const parsedStaff = staffMembersResponseSchema.parse(staffRaw);
      setMembers(parsedMembers);
      setInvitations(parsedInvitations);
      setStaff(parsedStaff);
      setDrafts(
        Object.fromEntries(
          parsedMembers.map((m) => [
            m.id,
            { role: m.role, staffMemberId: m.staffMemberId ?? NONE_VALUE },
          ]),
        ),
      );
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(errorMessage(tErrors, code));
      setMembers(null);
      setInvitations(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, tErrors]);

  useEffect(() => {
    if (!canManage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / business change
    void load();
  }, [canManage, load]);

  const pending = useMemo(
    () => invitations?.filter((i) => i.status === 'PENDING') ?? [],
    [invitations],
  );
  const expired = useMemo(
    () => invitations?.filter((i) => i.status === 'EXPIRED') ?? [],
    [invitations],
  );

  async function saveMember(member: BusinessMember): Promise<void> {
    const draft = drafts[member.id];
    if (!draft) return;
    const nextStaff = draft.staffMemberId === NONE_VALUE ? null : draft.staffMemberId;
    const payload =
      draft.role !== member.role || nextStaff !== member.staffMemberId
        ? {
            ...(draft.role !== member.role ? { role: draft.role } : {}),
            ...(nextStaff !== member.staffMemberId ? { staffMemberId: nextStaff } : {}),
          }
        : null;
    if (!payload || Object.keys(payload).length === 0) return;

    setBusyId(member.id);
    try {
      const parsed = updateMemberRequestSchema.parse(payload);
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/members/${member.id}`, {
        method: 'PATCH',
        body: parsed,
      });
      const updated = businessMemberSchema.parse(raw);
      setMembers((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? null);
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: {
          role: updated.role,
          staffMemberId: updated.staffMemberId ?? NONE_VALUE,
        },
      }));
      toast.success(t('team.memberSavedToast'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(member: BusinessMember): Promise<void> {
    setBusyId(member.id);
    try {
      await apiRequest(`/businesses/${business.id}/members/${member.id}`, { method: 'DELETE' });
      setMembers((prev) => prev?.filter((m) => m.id !== member.id) ?? null);
      toast.success(t('team.removedToast'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusyId(null);
    }
  }

  async function leaveBusiness(): Promise<void> {
    setBusyId('leave');
    try {
      await apiRequest(`/businesses/${business.id}/leave`, { method: 'POST', body: {} });
      toast.success(t('team.leftToast'));
      clearLastBusinessId();
      invalidateMyBusinesses();
      router.replace(`/${locale}/business`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvitation(invitation: Invitation): Promise<void> {
    setBusyId(invitation.id);
    try {
      const raw = await apiRequest<unknown>(
        `/businesses/${business.id}/invitations/${invitation.id}/resend`,
        { method: 'POST', body: {} },
      );
      const updated = invitationSchema.parse(raw);
      setInvitations((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)) ?? null);
      toast.success(t('team.resentToast'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvitation(invitation: Invitation): Promise<void> {
    setBusyId(invitation.id);
    try {
      await apiRequest(`/businesses/${business.id}/invitations/${invitation.id}`, {
        method: 'DELETE',
      });
      setInvitations(
        (prev) =>
          prev?.map((i) => (i.id === invitation.id ? { ...i, status: 'REVOKED' as const } : i)) ??
          null,
      );
      toast.success(t('team.revokedToast'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusyId(null);
    }
  }

  async function inviteAgain(invitation: Invitation): Promise<void> {
    setBusyId(invitation.id);
    try {
      const body = {
        email: invitation.email,
        role: invitation.role,
        ...(invitation.staffMemberId ? { staffMemberId: invitation.staffMemberId } : {}),
      };
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/invitations`, {
        method: 'POST',
        body,
      });
      const created = invitationSchema.parse(raw);
      setInvitations((prev) => [created, ...(prev ?? [])]);
      toast.success(t('team.inviteAgainToast'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setBusyId(null);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {t('team.forbidden')}
        </p>
        <Button asChild variant="secondary">
          <Link href={`/${locale}/business/${business.id}`}>{t('team.backToOverview')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-bold text-foreground">{t('team.heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('team.subtitle')}</p>
        </div>
        <Button type="button" onClick={() => setInviteOpen(true)}>
          {t('team.invite')}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('team.loading')}>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-border p-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void load()}>
            {t('team.retry')}
          </Button>
        </div>
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="team-members-heading">
            <h2 id="team-members-heading" className="text-subtitle font-bold text-foreground">
              {t('team.membersHeading')}
            </h2>
            {!members || members.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('team.membersEmpty')}</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {members.map((member) => {
                  const isSelf = myUserId !== null && member.userId === myUserId;
                  const draft = drafts[member.id] ?? {
                    role: member.role,
                    staffMemberId: member.staffMemberId ?? NONE_VALUE,
                  };
                  const canEditOwner = isOwner;
                  const canManageThisOwner = member.role !== 'OWNER' || canEditOwner;
                  const roleOptions: MembershipRole[] = canEditOwner
                    ? ['OWNER', 'ADMIN', 'STAFF']
                    : ['ADMIN', 'STAFF'];
                  const staffOptions = availableStaffForMember(member, staff, members);
                  const dirty =
                    draft.role !== member.role ||
                    (draft.staffMemberId === NONE_VALUE
                      ? member.staffMemberId !== null
                      : draft.staffMemberId !== member.staffMemberId);
                  const displayName = member.displayName?.trim() || member.email;

                  return (
                    <li key={member.id} className="space-y-3 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                          {displayName}
                        </p>
                        <Badge variant={roleBadgeVariant(member.role)}>
                          {t('team.role', { role: member.role })}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('team.linkedStaff', {
                          name: staffName(member.staffMemberId, staff, t),
                        })}
                      </p>

                      {canManageThisOwner ? (
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-[8rem] space-y-1">
                            <label className="text-xs font-bold text-foreground">
                              {t('team.changeRole')}
                            </label>
                            <Select
                              value={draft.role}
                              onValueChange={(value) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [member.id]: {
                                    ...draft,
                                    role: value as MembershipRole,
                                  },
                                }))
                              }
                              disabled={busyId === member.id}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roleOptions.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {t('team.role', { role: option })}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="min-w-[10rem] flex-1 space-y-1">
                            <label className="text-xs font-bold text-foreground">
                              {t('team.linkStaff')}
                            </label>
                            <Select
                              value={draft.staffMemberId}
                              onValueChange={(value) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [member.id]: { ...draft, staffMemberId: value },
                                }))
                              }
                              disabled={busyId === member.id}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('team.linkStaffPlaceholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE_VALUE}>
                                  {t('team.linkStaffNone')}
                                </SelectItem>
                                {staffOptions.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!dirty || busyId === member.id}
                            loading={busyId === member.id}
                            onClick={() => void saveMember(member)}
                          >
                            {busyId === member.id ? t('team.savingMember') : t('team.saveMember')}
                          </Button>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {isSelf ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busyId === 'leave'}
                              >
                                {t('team.leave')}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('team.leaveTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('team.leaveDescription')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('team.leaveCancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={busyId === 'leave'}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    void leaveBusiness();
                                  }}
                                >
                                  {busyId === 'leave' ? t('team.leaving') : t('team.leaveConfirm')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : canManageThisOwner ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={busyId === member.id}
                              >
                                {t('team.remove')}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('team.removeTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('team.removeDescription', { name: displayName })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('team.removeCancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={busyId === member.id}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    void removeMember(member);
                                  }}
                                >
                                  {busyId === member.id
                                    ? t('team.removing')
                                    : t('team.removeConfirm')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-4" aria-labelledby="team-invitations-heading">
            <h2 id="team-invitations-heading" className="text-subtitle font-bold text-foreground">
              {t('team.invitationsHeading')}
            </h2>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">{t('team.pendingHeading')}</h3>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('team.pendingEmpty')}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {pending.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {invitation.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('team.role', { role: invitation.role })} ·{' '}
                          {t('team.expiresAt', {
                            when: formatInvitationExpiry(
                              invitation.expiresAt,
                              locale,
                              business.timezone,
                            ),
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyId === invitation.id}
                        loading={busyId === invitation.id}
                        onClick={() => void resendInvitation(invitation)}
                      >
                        {busyId === invitation.id ? t('team.resending') : t('team.resend')}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={busyId === invitation.id}
                          >
                            {t('team.revoke')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('team.revokeTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('team.revokeDescription', { email: invitation.email })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('team.revokeCancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              disabled={busyId === invitation.id}
                              onClick={(event) => {
                                event.preventDefault();
                                void revokeInvitation(invitation);
                              }}
                            >
                              {busyId === invitation.id
                                ? t('team.revoking')
                                : t('team.revokeConfirm')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-foreground">{t('team.expiredHeading')}</h3>
              {expired.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('team.expiredEmpty')}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {expired.map((invitation) => (
                    <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">
                          {invitation.email}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('team.role', { role: invitation.role })} ·{' '}
                          {t('team.expiredAt', {
                            when: formatInvitationExpiry(
                              invitation.expiresAt,
                              locale,
                              business.timezone,
                            ),
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={busyId === invitation.id}
                        loading={busyId === invitation.id}
                        onClick={() => void inviteAgain(invitation)}
                      >
                        {busyId === invitation.id ? t('team.invitingAgain') : t('team.inviteAgain')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        businessId={business.id}
        myRole={business.myRole}
        staff={staff}
        onCreated={(created) => {
          setInvitations((prev) => [created, ...(prev ?? [])]);
        }}
      />
    </div>
  );
}
