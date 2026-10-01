'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  INVITATION_TTL_DAYS,
  createInvitationRequestSchema,
  invitationSchema,
  type CreateInvitationRequest,
  type Invitation,
  type MembershipRole,
  type StaffMember,
} from '@najme/contracts';
import { isLocale } from '@najme/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

type InviteFormValues = {
  email: string;
  role: MembershipRole;
  staffMemberId: string;
};

type InviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  myRole: MembershipRole;
  /** Staff not already linked to a member. */
  staff: StaffMember[];
  onCreated: (invitation: Invitation) => void;
};

const NONE_VALUE = '__none__';

/** Create-invitation dialog: email, role, required staff link for STAFF. */
export function InviteDialog({
  open,
  onOpenChange,
  businessId,
  myRole,
  staff,
  onCreated,
}: InviteDialogProps) {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const tShell = useTranslations('shell');
  const locale = useLocale();
  const canInviteOwner = myRole === 'OWNER';
  const roleFieldId = useId();
  const staffFieldId = useId();

  const formSchema = useMemo(
    () =>
      z
        .object({
          email: z
            .string()
            .trim()
            .min(1, { error: t('team.errors.emailRequired') })
            .email({ error: t('team.errors.emailInvalid') }),
          role: z.enum(['OWNER', 'ADMIN', 'STAFF'], {
            error: t('team.errors.roleRequired'),
          }),
          staffMemberId: z.string(),
        })
        .superRefine((values, ctx) => {
          if (
            values.role === 'STAFF' &&
            (!values.staffMemberId || values.staffMemberId === NONE_VALUE)
          ) {
            ctx.addIssue({
              code: 'custom',
              message: t('team.errors.staffRequired'),
              path: ['staffMemberId'],
            });
          }
          if (values.role === 'OWNER' && !canInviteOwner) {
            ctx.addIssue({
              code: 'custom',
              message: t('team.errors.roleRequired'),
              path: ['role'],
            });
          }
        }),
    [canInviteOwner, t],
  );

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', role: 'ADMIN', staffMemberId: NONE_VALUE },
  });

  const role = useWatch({ control: form.control, name: 'role' });

  useEffect(() => {
    if (!open) {
      form.reset({ email: '', role: 'ADMIN', staffMemberId: NONE_VALUE });
    }
  }, [form, open]);

  // Drop a leftover staff pick when switching away from STAFF (field is hidden).
  useEffect(() => {
    if (role !== 'STAFF') {
      form.setValue('staffMemberId', NONE_VALUE);
    }
  }, [form, role]);

  async function onSubmit(values: InviteFormValues): Promise<void> {
    const body: CreateInvitationRequest = {
      email: values.email.trim().toLowerCase(),
      role: values.role,
      locale: isLocale(locale) ? locale : 'en',
    };
    if (values.role === 'STAFF' && values.staffMemberId !== NONE_VALUE) {
      body.staffMemberId = values.staffMemberId;
    }
    try {
      const parsedBody = createInvitationRequestSchema.parse(body);
      const raw = await apiRequest<unknown>(`/businesses/${businessId}/invitations`, {
        method: 'POST',
        body: parsedBody,
      });
      const created = invitationSchema.parse(raw);
      toast.success(t('team.invitedToast'));
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_MEMBER') {
        form.setError('email', { message: t('team.errors.alreadyMember') });
        return;
      }
      if (err instanceof ApiError && err.code === 'INVITATION_EXISTS') {
        form.setError('email', { message: t('team.errors.invitationExists') });
        return;
      }
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            const field = Array.isArray(path) ? path[0] : undefined;
            if (field === 'email' || field === 'role' || field === 'staffMemberId') {
              form.setError(field, { message: t('team.errors.invalid') });
            }
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    }
  }

  const roleOptions: MembershipRole[] = canInviteOwner
    ? ['OWNER', 'ADMIN', 'STAFF']
    : ['ADMIN', 'STAFF'];

  const roleError = form.formState.errors.role?.message;
  const staffError = form.formState.errors.staffMemberId?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tShell('close')}>
        <DialogHeader>
          <DialogTitle>{t('team.inviteDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('team.inviteDialogSubtitle', { days: INVITATION_TTL_DAYS })}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField label={t('team.inviteEmail')} error={form.formState.errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              {...form.register('email')}
              disabled={form.formState.isSubmitting}
            />
          </FormField>

          <div className="grid gap-2">
            <Label htmlFor={roleFieldId}>{t('team.inviteRole')}</Label>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as MembershipRole)}
                  disabled={form.formState.isSubmitting}
                >
                  <SelectTrigger
                    id={roleFieldId}
                    aria-invalid={roleError ? true : undefined}
                    aria-describedby={roleError ? `${roleFieldId}-error` : undefined}
                  >
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
              )}
            />
            {roleError ? (
              <p
                id={`${roleFieldId}-error`}
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                {roleError}
              </p>
            ) : null}
          </div>

          {role === 'STAFF' ? (
            <div className="grid gap-2">
              <Label htmlFor={staffFieldId}>{t('team.inviteStaff')}</Label>
              <Controller
                control={form.control}
                name="staffMemberId"
                render={({ field }) => (
                  <Select
                    value={field.value === NONE_VALUE ? undefined : field.value}
                    onValueChange={field.onChange}
                    disabled={form.formState.isSubmitting}
                  >
                    <SelectTrigger
                      id={staffFieldId}
                      aria-invalid={staffError ? true : undefined}
                      aria-describedby={
                        staffError ? `${staffFieldId}-error` : `${staffFieldId}-description`
                      }
                    >
                      <SelectValue placeholder={t('team.linkStaffPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {staffError ? (
                <p
                  id={`${staffFieldId}-error`}
                  role="alert"
                  className="text-xs font-medium text-destructive"
                >
                  {staffError}
                </p>
              ) : (
                <p id={`${staffFieldId}-description`} className="text-xs text-muted-foreground">
                  {t('team.inviteStaffHint')}
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={form.formState.isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              {t('team.inviteCancel')}
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('team.inviteSubmitting') : t('team.inviteSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
