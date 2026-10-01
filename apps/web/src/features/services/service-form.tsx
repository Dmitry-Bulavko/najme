'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createServiceRequestSchema,
  serviceSchema,
  staffMembersResponseSchema,
  updateServiceRequestSchema,
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
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useBusinessContext } from '@/features/business/business-shell';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import {
  CustomFieldsEditor,
  draftFromResponse,
  draftsToPayload,
  type DraftCustomField,
} from './custom-fields-editor';
import { mapServiceValidationErrors } from './map-service-validation';
import {
  BUFFER_MINUTE_OPTIONS,
  DURATION_MINUTE_OPTIONS,
  SERVICE_HORIZON_PRESETS,
  SERVICE_NOTICE_PRESETS,
  optionsWithNullableCurrent,
} from './service-presets';
import { isValidCustomFieldKey } from './slug-custom-field-key';

type ServiceFormValues = {
  name: string;
  description: string;
  durationMinutes: string;
  bufferBeforeMinutes: string;
  bufferAfterMinutes: string;
  priceAmount: number | null;
  active: boolean;
  staffMemberIds: string[];
  minBookingNoticeMinutes: string;
  bookingHorizonDays: string;
};

type ServiceFormProps = {
  mode: 'create' | 'edit';
  serviceId?: string;
};

function nullableSelectValue(raw: string): number | null {
  if (raw === 'null') return null;
  return Number(raw);
}

function toSelectString(value: number | null): string {
  return value === null ? 'null' : String(value);
}

/** Create or edit a service: duration/buffers, MoneyInput, staff checkboxes, custom fields. */
export function ServiceForm({ mode, serviceId }: ServiceFormProps) {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const { business } = useBusinessContext();
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const listHref = `/${locale}/business/${business.id}/services`;
  const activeId = useId();
  const staffGroupId = useId();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [customFields, setCustomFields] = useState<DraftCustomField[]>([]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const formSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t('services.errors.nameRequired') })
          .max(80, { error: t('services.errors.nameTooLong') }),
        description: z.string().superRefine((value, ctx) => {
          const trimmed = value.trim();
          if (trimmed === '') return;
          if (trimmed.length > 1000) {
            ctx.addIssue({ code: 'custom', message: t('services.errors.descriptionTooLong') });
          }
        }),
        durationMinutes: z.string().refine((v) => DURATION_MINUTE_OPTIONS.includes(Number(v)), {
          error: t('services.errors.durationInvalid'),
        }),
        bufferBeforeMinutes: z.string().refine((v) => BUFFER_MINUTE_OPTIONS.includes(Number(v)), {
          error: t('services.errors.bufferInvalid'),
        }),
        bufferAfterMinutes: z.string().refine((v) => BUFFER_MINUTE_OPTIONS.includes(Number(v)), {
          error: t('services.errors.bufferInvalid'),
        }),
        priceAmount: z
          .number({ error: t('services.errors.priceRequired') })
          .int()
          .min(0, { error: t('services.errors.priceInvalid') })
          .max(99_999_999, { error: t('services.errors.priceInvalid') })
          .nullable()
          .refine((v): v is number => v !== null, { error: t('services.errors.priceRequired') }),
        active: z.boolean(),
        staffMemberIds: z.array(z.string().uuid()),
        minBookingNoticeMinutes: z.string(),
        bookingHorizonDays: z.string(),
      }),
    [t],
  );

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      durationMinutes: '30',
      bufferBeforeMinutes: '0',
      bufferAfterMinutes: '0',
      priceAmount: 0,
      active: true,
      staffMemberIds: [],
      minBookingNoticeMinutes: 'null',
      bookingHorizonDays: 'null',
    },
  });

  const noticeCurrent = nullableSelectValue(form.watch('minBookingNoticeMinutes'));
  const horizonCurrent = nullableSelectValue(form.watch('bookingHorizonDays'));
  const noticeOptions = useMemo(
    () => optionsWithNullableCurrent(SERVICE_NOTICE_PRESETS, noticeCurrent),
    [noticeCurrent],
  );
  const horizonOptions = useMemo(
    () => optionsWithNullableCurrent(SERVICE_HORIZON_PRESETS, horizonCurrent),
    [horizonCurrent],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const staffRaw = await apiRequest<unknown>(`/businesses/${business.id}/staff`);
        const staffList = staffMembersResponseSchema.parse(staffRaw);
        if (cancelled) return;
        setStaff(staffList);

        if (mode === 'edit' && serviceId) {
          const raw = await apiRequest<unknown>(`/businesses/${business.id}/services/${serviceId}`);
          const service = serviceSchema.parse(raw);
          if (cancelled) return;
          form.reset({
            name: service.name,
            description: service.description ?? '',
            durationMinutes: String(service.durationMinutes),
            bufferBeforeMinutes: String(service.bufferBeforeMinutes),
            bufferAfterMinutes: String(service.bufferAfterMinutes),
            priceAmount: service.price.amount,
            active: service.active,
            staffMemberIds: service.staffMemberIds,
            minBookingNoticeMinutes: toSelectString(service.minBookingNoticeMinutes),
            bookingHorizonDays: toSelectString(service.bookingHorizonDays),
          });
          setCustomFields(draftFromResponse(service.customFields));
        }
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
  }, [business.id, form, mode, serviceId, tErrors]);

  function validateCustomFieldsLocally(): boolean {
    const errors: Partial<Record<string, string>> = {};
    const keys = new Set<string>();
    customFields.forEach((field, index) => {
      if (!field.label.trim()) {
        errors[`customFields.${index}.label`] = t('customFields.errors.labelRequired');
      }
      if (!isValidCustomFieldKey(field.key)) {
        errors[`customFields.${index}.key`] = t('customFields.errors.keyInvalid');
      } else if (keys.has(field.key)) {
        errors[`customFields.${index}.key`] = t('customFields.errors.keyDuplicate');
      } else {
        keys.add(field.key);
      }
      if (field.type === 'SELECT') {
        if (field.options.length < 1) {
          errors[`customFields.${index}.options`] = t('customFields.errors.optionsRequired');
        } else {
          const values = field.options.map((o) => o.value.trim());
          if (values.some((v) => !v) || field.options.some((o) => !o.label.trim())) {
            errors[`customFields.${index}.options`] = t('customFields.errors.optionIncomplete');
          } else if (new Set(values).size !== values.length) {
            errors[`customFields.${index}.options`] = t('customFields.errors.optionDuplicate');
          }
        }
      }
    });
    setCustomFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(values: ServiceFormValues): Promise<void> {
    if (!canEdit) return;
    if (!validateCustomFieldsLocally()) {
      toast.error(t('customFields.errors.fixInvalid'));
      return;
    }

    const payload = {
      name: values.name.trim(),
      description: values.description.trim() === '' ? null : values.description.trim(),
      durationMinutes: Number(values.durationMinutes),
      bufferBeforeMinutes: Number(values.bufferBeforeMinutes),
      bufferAfterMinutes: Number(values.bufferAfterMinutes),
      price: { amount: values.priceAmount as number, currency: 'EUR' as const },
      active: values.active,
      staffMemberIds: values.staffMemberIds,
      minBookingNoticeMinutes: nullableSelectValue(values.minBookingNoticeMinutes),
      bookingHorizonDays: nullableSelectValue(values.bookingHorizonDays),
      customFields: draftsToPayload(customFields),
    };

    try {
      if (mode === 'create') {
        const body = createServiceRequestSchema.parse(payload);
        const raw = await apiRequest<unknown>(`/businesses/${business.id}/services`, {
          method: 'POST',
          body,
        });
        const created = serviceSchema.parse(raw);
        toast.success(t('services.createdToast'));
        router.push(`/${locale}/business/${business.id}/services/${created.id}`);
        return;
      }
      if (!serviceId) return;
      const body = updateServiceRequestSchema.parse(payload);
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/services/${serviceId}`, {
        method: 'PATCH',
        body,
      });
      const updated = serviceSchema.parse(raw);
      form.reset({
        name: updated.name,
        description: updated.description ?? '',
        durationMinutes: String(updated.durationMinutes),
        bufferBeforeMinutes: String(updated.bufferBeforeMinutes),
        bufferAfterMinutes: String(updated.bufferAfterMinutes),
        priceAmount: updated.price.amount,
        active: updated.active,
        staffMemberIds: updated.staffMemberIds,
        minBookingNoticeMinutes: toSelectString(updated.minBookingNoticeMinutes),
        bookingHorizonDays: toSelectString(updated.bookingHorizonDays),
      });
      setCustomFields(draftFromResponse(updated.customFields));
      setCustomFieldErrors({});
      toast.success(t('services.savedToast'));
    } catch (err) {
      const mapped = mapServiceValidationErrors(err, form.setError, t('services.errors.invalid'));
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          const next: Partial<Record<string, string>> = {};
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            if (!Array.isArray(path) || path[0] !== 'customFields') continue;
            next[path.map(String).join('.')] = t('services.errors.invalid');
          }
          if (Object.keys(next).length > 0) {
            setCustomFieldErrors((prev) => ({ ...prev, ...next }));
          }
        }
      }
      if (!mapped) {
        // still show toast for field-mapped cases too
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    }
  }

  if (!canEdit && mode === 'create') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {t('services.forbidden')}
        </p>
        <Button asChild variant="secondary">
          <Link href={listHref}>{t('services.backToList')}</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('services.loading')}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
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
          <Link href={listHref}>{t('services.backToList')}</Link>
        </Button>
      </div>
    );
  }

  const readOnly = !canEdit;
  const staffError = form.formState.errors.staffMemberIds?.message;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-title font-bold text-foreground">
          {mode === 'create' ? t('services.createHeading') : t('services.editHeading')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {readOnly ? t('services.readOnlySubtitle') : t('services.formSubtitle')}
        </p>
      </div>

      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField label={t('services.name')} error={form.formState.errors.name?.message}>
          <Input
            {...form.register('name')}
            disabled={readOnly || form.formState.isSubmitting}
            autoComplete="off"
          />
        </FormField>

        <FormField
          label={t('services.description')}
          error={form.formState.errors.description?.message}
        >
          <Textarea
            {...form.register('description')}
            disabled={readOnly || form.formState.isSubmitting}
            rows={3}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label={t('services.duration')}
            error={form.formState.errors.durationMinutes?.message}
          >
            <Controller
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly || form.formState.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {DURATION_MINUTE_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {t('services.minutesOption', { count: minutes })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label={t('services.bufferBefore')}
            error={form.formState.errors.bufferBeforeMinutes?.message}
          >
            <Controller
              control={form.control}
              name="bufferBeforeMinutes"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly || form.formState.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {BUFFER_MINUTE_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {t('services.minutesOption', { count: minutes })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label={t('services.bufferAfter')}
            error={form.formState.errors.bufferAfterMinutes?.message}
          >
            <Controller
              control={form.control}
              name="bufferAfterMinutes"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly || form.formState.isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {BUFFER_MINUTE_OPTIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {t('services.minutesOption', { count: minutes })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>

        <FormField label={t('services.price')} error={form.formState.errors.priceAmount?.message}>
          <Controller
            control={form.control}
            name="priceAmount"
            render={({ field }) => (
              <MoneyInput
                value={field.value}
                onChange={field.onChange}
                currency="EUR"
                disabled={readOnly || form.formState.isSubmitting}
              />
            )}
          />
        </FormField>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <Label htmlFor={activeId} className="text-sm font-bold">
            {t('services.activeToggle')}
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

        <fieldset
          className="space-y-2"
          aria-describedby={staffError ? `${staffGroupId}-err` : undefined}
        >
          <legend className="text-sm font-bold text-foreground">
            {t('services.staffHeading')}
          </legend>
          <p className="text-xs text-muted-foreground">{t('services.staffHint')}</p>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('services.staffEmpty')}</p>
          ) : (
            <Controller
              control={form.control}
              name="staffMemberIds"
              render={({ field }) => (
                <ul className="space-y-2">
                  {staff.map((member) => {
                    const checked = field.value.includes(member.id);
                    const id = `${staffGroupId}-${member.id}`;
                    return (
                      <li key={member.id} className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          checked={checked}
                          disabled={readOnly || form.formState.isSubmitting || !member.active}
                          onCheckedChange={(next) => {
                            if (next === true) {
                              field.onChange([...field.value, member.id]);
                            } else {
                              field.onChange(field.value.filter((x) => x !== member.id));
                            }
                          }}
                        />
                        <Label htmlFor={id} className="font-normal">
                          {member.active
                            ? member.displayName
                            : t('services.staffInactiveName', { name: member.displayName })}
                        </Label>
                      </li>
                    );
                  })}
                </ul>
              )}
            />
          )}
          {staffError ? (
            <p
              id={`${staffGroupId}-err`}
              className="text-xs font-medium text-destructive"
              role="alert"
            >
              {staffError}
            </p>
          ) : null}
        </fieldset>

        <CustomFieldsEditor
          value={customFields}
          onChange={setCustomFields}
          disabled={readOnly || form.formState.isSubmitting}
          errors={customFieldErrors}
        />

        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-bold text-foreground">
            {t('services.advancedHeading')}
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('services.minNotice')}
              description={t('services.minNoticeHint')}
              error={form.formState.errors.minBookingNoticeMinutes?.message}
            >
              <Controller
                control={form.control}
                name="minBookingNoticeMinutes"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly || form.formState.isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {noticeOptions.map((value) => (
                        <SelectItem key={toSelectString(value)} value={toSelectString(value)}>
                          {value === null
                            ? t('services.inheritDefault')
                            : t('services.minutesOption', { count: value })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField
              label={t('services.horizon')}
              description={t('services.horizonHint')}
              error={form.formState.errors.bookingHorizonDays?.message}
            >
              <Controller
                control={form.control}
                name="bookingHorizonDays"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly || form.formState.isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {horizonOptions.map((value) => (
                        <SelectItem key={toSelectString(value)} value={toSelectString(value)}>
                          {value === null
                            ? t('services.inheritDefault')
                            : t('settings.durationDays', { count: value })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          {!readOnly ? (
            <Button type="submit" loading={form.formState.isSubmitting}>
              {mode === 'create' ? t('services.createSubmit') : t('services.save')}
            </Button>
          ) : null}
          <Button asChild type="button" variant="secondary">
            <Link href={listHref}>{t('services.backToList')}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
