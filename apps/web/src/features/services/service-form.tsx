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
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { formatMinutesLabel } from '@/features/business/booking-presets';
import { useBusinessContext } from '@/features/business/business-shell';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import {
  CustomFieldsEditor,
  draftFromResponse,
  draftsToPayload,
  type DraftCustomField,
} from './custom-fields-editor';
import { mapServiceValidationErrors, normalizeServiceIssuePath } from './map-service-validation';
import { MinutesSelect } from './minutes-select';
import {
  SERVICE_HORIZON_PRESETS,
  SERVICE_NOTICE_PRESETS,
  bufferOptionsWithCurrent,
  durationOptionsWithCurrent,
  isValidBufferMinutes,
  isValidDurationMinutes,
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
  /** True while MoneyInput holds a non-empty draft that does not parse for the UI locale. */
  priceDraftInvalid: boolean;
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
  const durationId = useId();
  const bufferBeforeId = useId();
  const bufferAfterId = useId();
  const priceId = useId();
  const noticeId = useId();
  const horizonId = useId();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [customFields, setCustomFields] = useState<DraftCustomField[]>([]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadNonce, setLoadNonce] = useState(0);
  /** Mount notice/horizon Selects only when opened — closed details still keep children in the DOM. */
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const formSchema = useMemo(
    () =>
      z
        .object({
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
          durationMinutes: z.string().refine((v) => isValidDurationMinutes(Number(v)), {
            error: t('services.errors.durationInvalid'),
          }),
          bufferBeforeMinutes: z.string().refine((v) => isValidBufferMinutes(Number(v)), {
            error: t('services.errors.bufferInvalid'),
          }),
          bufferAfterMinutes: z.string().refine((v) => isValidBufferMinutes(Number(v)), {
            error: t('services.errors.bufferInvalid'),
          }),
          priceAmount: z
            .number({ error: t('services.errors.priceRequired') })
            .int()
            .min(0, { error: t('services.errors.priceInvalid') })
            .max(99_999_999, { error: t('services.errors.priceInvalid') })
            .nullable(),
          priceDraftInvalid: z.boolean(),
          active: z.boolean(),
          staffMemberIds: z.array(z.string().uuid()),
          minBookingNoticeMinutes: z.string(),
          bookingHorizonDays: z.string(),
        })
        .superRefine((data, ctx) => {
          if (data.priceDraftInvalid) {
            ctx.addIssue({
              code: 'custom',
              path: ['priceAmount'],
              message: t('services.errors.priceInvalid'),
            });
            return;
          }
          if (data.priceAmount === null) {
            ctx.addIssue({
              code: 'custom',
              path: ['priceAmount'],
              message: t('services.errors.priceRequired'),
            });
          }
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
      priceAmount: null,
      priceDraftInvalid: false,
      active: true,
      staffMemberIds: [],
      minBookingNoticeMinutes: 'null',
      bookingHorizonDays: 'null',
    },
  });

  const durationCurrent = Number(
    useWatch({ control: form.control, name: 'durationMinutes' }) ?? '30',
  );
  const bufferBeforeCurrent = Number(
    useWatch({ control: form.control, name: 'bufferBeforeMinutes' }) ?? '0',
  );
  const bufferAfterCurrent = Number(
    useWatch({ control: form.control, name: 'bufferAfterMinutes' }) ?? '0',
  );
  const noticeCurrent = nullableSelectValue(
    useWatch({ control: form.control, name: 'minBookingNoticeMinutes' }) ?? 'null',
  );
  const horizonCurrent = nullableSelectValue(
    useWatch({ control: form.control, name: 'bookingHorizonDays' }) ?? 'null',
  );

  const durationOptions = useMemo(
    () => durationOptionsWithCurrent(durationCurrent),
    [durationCurrent],
  );
  const bufferBeforeOptions = useMemo(
    () => bufferOptionsWithCurrent(bufferBeforeCurrent),
    [bufferBeforeCurrent],
  );
  const bufferAfterOptions = useMemo(
    () => bufferOptionsWithCurrent(bufferAfterCurrent),
    [bufferAfterCurrent],
  );
  const noticeOptions = useMemo(
    () => optionsWithNullableCurrent(SERVICE_NOTICE_PRESETS, noticeCurrent),
    [noticeCurrent],
  );
  const horizonOptions = useMemo(
    () => optionsWithNullableCurrent(SERVICE_HORIZON_PRESETS, horizonCurrent),
    [horizonCurrent],
  );

  const formatDurationOption = useCallback(
    (minutes: number) => t('services.minutesOption', { count: minutes }),
    [t],
  );

  const reload = useCallback(() => {
    setLoadNonce((n) => n + 1);
  }, []);

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
            priceDraftInvalid: false,
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
  }, [business.id, form, mode, serviceId, tErrors, loadNonce]);

  function validateCustomFieldsLocally(): boolean {
    const errors: Partial<Record<string, string>> = {};
    const keys = new Set<string>();
    customFields.forEach((field) => {
      const label = field.label.trim();
      if (!label) {
        errors[`${field.clientId}.label`] = t('customFields.errors.labelRequired');
      } else if (label.length > 80) {
        errors[`${field.clientId}.label`] = t('customFields.errors.labelTooLong');
      }
      if (!isValidCustomFieldKey(field.key)) {
        errors[`${field.clientId}.key`] = t('customFields.errors.keyInvalid');
      } else if (keys.has(field.key)) {
        errors[`${field.clientId}.key`] = t('customFields.errors.keyDuplicate');
      } else {
        keys.add(field.key);
      }
      if (field.type === 'SELECT') {
        if (field.options.length < 1) {
          errors[`${field.clientId}.options`] = t('customFields.errors.optionsRequired');
        } else {
          const values = field.options.map((o) => o.value.trim());
          if (values.some((v) => !v) || field.options.some((o) => !o.label.trim())) {
            errors[`${field.clientId}.options`] = t('customFields.errors.optionIncomplete');
          } else if (
            values.some((v) => v.length > 80) ||
            field.options.some((o) => o.label.trim().length > 80)
          ) {
            errors[`${field.clientId}.options`] = t('customFields.errors.optionTooLong');
          } else if (new Set(values).size !== values.length) {
            errors[`${field.clientId}.options`] = t('customFields.errors.optionDuplicate');
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
      toast.error(t('customFields.errors.formInvalid'));
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
        priceDraftInvalid: false,
        active: updated.active,
        staffMemberIds: updated.staffMemberIds,
        minBookingNoticeMinutes: toSelectString(updated.minBookingNoticeMinutes),
        bookingHorizonDays: toSelectString(updated.bookingHorizonDays),
      });
      setCustomFields(draftFromResponse(updated.customFields));
      setCustomFieldErrors({});
      toast.success(t('services.savedToast'));
    } catch (err) {
      mapServiceValidationErrors(err, form.setError, t('services.errors.invalid'));
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          const next: Partial<Record<string, string>> = {};
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            if (!Array.isArray(path) || path[0] !== 'customFields') continue;
            const normalized = normalizeServiceIssuePath(path);
            if (!normalized || !normalized.startsWith('customFields.')) continue;
            const parts = normalized.split('.');
            const index = Number(parts[1]);
            const prop = parts[2] ?? 'label';
            const field = customFields[index];
            if (!field || Number.isNaN(index)) continue;
            next[`${field.clientId}.${prop}`] = t('services.errors.invalid');
          }
          if (Object.keys(next).length > 0) {
            setCustomFieldErrors((prev) => ({ ...prev, ...next }));
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
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" onClick={reload}>
            {t('services.retry')}
          </Button>
          <Button asChild variant="secondary">
            <Link href={listHref}>{t('services.backToList')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const readOnly = !canEdit;
  const staffError = form.formState.errors.staffMemberIds?.message;
  const durationError = form.formState.errors.durationMinutes?.message;
  const bufferBeforeError = form.formState.errors.bufferBeforeMinutes?.message;
  const bufferAfterError = form.formState.errors.bufferAfterMinutes?.message;
  const priceError = form.formState.errors.priceAmount?.message;
  const noticeError = form.formState.errors.minBookingNoticeMinutes?.message;
  const horizonError = form.formState.errors.bookingHorizonDays?.message;

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
          <div className="grid gap-2">
            <Label htmlFor={durationId}>{t('services.duration')}</Label>
            <Controller
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <MinutesSelect
                  id={durationId}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly || form.formState.isSubmitting}
                  options={durationOptions}
                  formatOption={formatDurationOption}
                  aria-invalid={durationError ? true : undefined}
                  aria-describedby={durationError ? `${durationId}-error` : undefined}
                />
              )}
            />
            {durationError ? (
              <p
                id={`${durationId}-error`}
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                {durationError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={bufferBeforeId}>{t('services.bufferBefore')}</Label>
            <Controller
              control={form.control}
              name="bufferBeforeMinutes"
              render={({ field }) => (
                <MinutesSelect
                  id={bufferBeforeId}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly || form.formState.isSubmitting}
                  options={bufferBeforeOptions}
                  formatOption={formatDurationOption}
                  aria-invalid={bufferBeforeError ? true : undefined}
                  aria-describedby={bufferBeforeError ? `${bufferBeforeId}-error` : undefined}
                />
              )}
            />
            {bufferBeforeError ? (
              <p
                id={`${bufferBeforeId}-error`}
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                {bufferBeforeError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={bufferAfterId}>{t('services.bufferAfter')}</Label>
            <Controller
              control={form.control}
              name="bufferAfterMinutes"
              render={({ field }) => (
                <MinutesSelect
                  id={bufferAfterId}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly || form.formState.isSubmitting}
                  options={bufferAfterOptions}
                  formatOption={formatDurationOption}
                  aria-invalid={bufferAfterError ? true : undefined}
                  aria-describedby={bufferAfterError ? `${bufferAfterId}-error` : undefined}
                />
              )}
            />
            {bufferAfterError ? (
              <p
                id={`${bufferAfterId}-error`}
                role="alert"
                className="text-xs font-medium text-destructive"
              >
                {bufferAfterError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={priceId}>{t('services.price')}</Label>
          <Controller
            control={form.control}
            name="priceAmount"
            render={({ field }) => (
              <MoneyInput
                id={priceId}
                value={field.value}
                onChange={field.onChange}
                onDraftInvalidChange={(invalid) => {
                  form.setValue('priceDraftInvalid', invalid, {
                    shouldDirty: true,
                    shouldValidate: false,
                  });
                }}
                currency="EUR"
                disabled={readOnly || form.formState.isSubmitting}
                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? `${priceId}-error` : undefined}
              />
            )}
          />
          {priceError ? (
            <p
              id={`${priceId}-error`}
              role="alert"
              className="text-xs font-medium text-destructive"
            >
              {priceError}
            </p>
          ) : null}
        </div>

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
                          disabled={
                            readOnly || form.formState.isSubmitting || (!member.active && !checked)
                          }
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
          readOnly={readOnly}
          disabled={form.formState.isSubmitting}
          errors={customFieldErrors}
        />

        <details
          className="rounded-md border border-border p-3"
          onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer text-sm font-bold text-foreground">
            {t('services.advancedHeading')}
          </summary>
          {advancedOpen ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={noticeId}>{t('services.minNotice')}</Label>
                <Controller
                  control={form.control}
                  name="minBookingNoticeMinutes"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={readOnly || form.formState.isSubmitting}
                    >
                      <SelectTrigger
                        id={noticeId}
                        aria-invalid={noticeError ? true : undefined}
                        aria-describedby={noticeError ? `${noticeId}-error` : `${noticeId}-hint`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {noticeOptions.map((value) => (
                          <SelectItem key={toSelectString(value)} value={toSelectString(value)}>
                            {value === null
                              ? t('services.inheritDefault')
                              : formatMinutesLabel(value, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {noticeError ? (
                  <p
                    id={`${noticeId}-error`}
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
                    {noticeError}
                  </p>
                ) : (
                  <p id={`${noticeId}-hint`} className="text-xs text-muted-foreground">
                    {t('services.minNoticeHint')}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={horizonId}>{t('services.horizon')}</Label>
                <Controller
                  control={form.control}
                  name="bookingHorizonDays"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={readOnly || form.formState.isSubmitting}
                    >
                      <SelectTrigger
                        id={horizonId}
                        aria-invalid={horizonError ? true : undefined}
                        aria-describedby={horizonError ? `${horizonId}-error` : `${horizonId}-hint`}
                      >
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
                {horizonError ? (
                  <p
                    id={`${horizonId}-error`}
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
                    {horizonError}
                  </p>
                ) : (
                  <p id={`${horizonId}-hint`} className="text-xs text-muted-foreground">
                    {t('services.horizonHint')}
                  </p>
                )}
              </div>
            </div>
          ) : null}
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
