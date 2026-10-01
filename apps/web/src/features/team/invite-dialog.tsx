'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createInvitationRequestSchema,
  invitationSchema,
  type CreateInvitationRequest,
  type Invitation,
  type MembershipRole,
  type StaffMember,
} from '@najme/contracts';
import { isLocale } from '@najme/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
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
  staff: StaffMember[];
  onCreated: (invitation: Invitation) => void;
};

const NONE_VALUE = '__none__';

/** Create-invitation dialog: email, role, optional/required staff link for STAFF. */
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

  async function onSubmit(values: InviteFormValues): Promise<void> {
    const body: CreateInvitationRequest = {
      email: values.email.trim().toLowerCase(),
      role: values.role,
      locale: isLocale(locale) ? locale : 'en',
    };
    if (values.role === 'STAFF' || (values.staffMemberId && values.staffMemberId !== NONE_VALUE)) {
      body.staffMemberId = values.staffMemberId === NONE_VALUE ? undefined : values.staffMemberId;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tShell('close')}>
        <DialogHeader>
          <DialogTitle>{t('team.inviteDialogTitle')}</DialogTitle>
          <DialogDescription>{t('team.inviteDialogSubtitle')}</DialogDescription>
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

          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormField label={t('team.inviteRole')} error={form.formState.errors.role?.message}>
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as MembershipRole)}
                  disabled={form.formState.isSubmitting}
                >
                  <SelectTrigger aria-invalid={Boolean(form.formState.errors.role)}>
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
              </FormField>
            )}
          />

          <Controller
            control={form.control}
            name="staffMemberId"
            render={({ field }) => (
              <FormField
                label={t('team.inviteStaff')}
                error={form.formState.errors.staffMemberId?.message}
                description={role === 'STAFF' ? t('team.inviteStaffHint') : undefined}
              >
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={form.formState.isSubmitting}
                >
                  <SelectTrigger aria-invalid={Boolean(form.formState.errors.staffMemberId)}>
                    <SelectValue placeholder={t('team.linkStaffPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {role !== 'STAFF' ? (
                      <SelectItem value={NONE_VALUE}>{t('team.linkStaffNone')}</SelectItem>
                    ) : null}
                    {staff.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />

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
