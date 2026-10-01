'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createStaffMemberRequestSchema,
  staffMemberSchema,
  updateStaffMemberRequestSchema,
  type StaffMember,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useBusinessContext } from '@/features/business/business-shell';
import { ImageUpload } from '@/features/uploads/image-upload';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

type StaffFormValues = {
  displayName: string;
  active: boolean;
};

type StaffFormProps = {
  mode: 'create' | 'edit';
  staffId?: string;
};

/** Create or edit a staff member. Photo upload is available after create (needs staffId). */
export function StaffForm({ mode, staffId }: StaffFormProps) {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const { business } = useBusinessContext();
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const listHref = `/${locale}/business/${business.id}/staff`;
  const activeId = useId();

  const [member, setMember] = useState<StaffMember | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');

  const formSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, { error: t('staff.errors.nameRequired') })
          .max(120, { error: t('staff.errors.nameTooLong') }),
        active: z.boolean(),
      }),
    [t],
  );

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: '', active: true },
  });

  useEffect(() => {
    if (mode !== 'edit' || !staffId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff/${staffId}`);
        const parsed = staffMemberSchema.parse(raw);
        if (cancelled) return;
        setMember(parsed);
        form.reset({ displayName: parsed.displayName, active: parsed.active });
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
        setLoadError(errorMessage(tErrors, code));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [business.id, form, mode, staffId, tErrors]);

  async function onSubmit(values: StaffFormValues): Promise<void> {
    if (!canEdit) return;
    try {
      if (mode === 'create') {
        const body = createStaffMemberRequestSchema.parse({
          displayName: values.displayName.trim(),
          active: values.active,
        });
        const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff`, {
          method: 'POST',
          body,
        });
        const created = staffMemberSchema.parse(raw);
        toast.success(t('staff.createdToast'));
        router.push(`/${locale}/business/${business.id}/staff/${created.id}`);
        return;
      }
      if (!staffId) return;
      const body = updateStaffMemberRequestSchema.parse({
        displayName: values.displayName.trim(),
        active: values.active,
      });
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff/${staffId}`, {
        method: 'PATCH',
        body,
      });
      const updated = staffMemberSchema.parse(raw);
      setMember(updated);
      form.reset({ displayName: updated.displayName, active: updated.active });
      toast.success(t('staff.savedToast'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            const field = Array.isArray(path) ? path[0] : undefined;
            if (field === 'displayName' || field === 'active') {
              form.setError(field, { message: t('staff.errors.invalid') });
            }
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    }
  }

  if (!canEdit && mode === 'create') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {t('staff.forbidden')}
        </p>
        <Button asChild variant="secondary">
          <Link href={listHref}>{t('staff.backToList')}</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('staff.loading')}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-border p-4 text-center">
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
        <Button asChild variant="secondary" className="mt-3">
          <Link href={listHref}>{t('staff.backToList')}</Link>
        </Button>
      </div>
    );
  }

  const readOnly = !canEdit;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="text-title font-bold text-foreground">
          {mode === 'create' ? t('staff.createHeading') : t('staff.editHeading')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {readOnly ? t('staff.readOnlySubtitle') : t('staff.formSubtitle')}
        </p>
      </div>

      {mode === 'edit' && staffId ? (
        <ImageUpload
          businessId={business.id}
          kind="STAFF_PHOTO"
          staffId={staffId}
          currentUrl={member?.photoUrl ?? null}
          frame="square"
          readOnly={readOnly}
          onChanged={({ photoUrl }) => {
            setMember((prev) => (prev ? { ...prev, photoUrl: photoUrl ?? null } : prev));
          }}
        />
      ) : null}

      {mode === 'create' ? (
        <p className="text-xs text-muted-foreground">{t('staff.photoAfterCreate')}</p>
      ) : null}

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField label={t('staff.name')} error={form.formState.errors.displayName?.message}>
          <Input
            {...form.register('displayName')}
            disabled={readOnly || form.formState.isSubmitting}
            autoComplete="off"
          />
        </FormField>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <Label htmlFor={activeId} className="text-sm font-bold">
            {t('staff.activeToggle')}
          </Label>
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <Switch
                id={activeId}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={readOnly || form.formState.isSubmitting}
              />
            )}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <Button type="submit" loading={form.formState.isSubmitting}>
              {mode === 'create' ? t('staff.createSubmit') : t('staff.save')}
            </Button>
          ) : null}
          <Button asChild type="button" variant="secondary">
            <Link href={listHref}>{t('staff.backToList')}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
