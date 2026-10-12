import { zodResolver } from '@hookform/resolvers/zod';
import {
  createServiceRequestSchema,
  serviceSchema,
  staffMembersResponseSchema,
  updateServiceRequestSchema,
  type StaffMember,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import {
  Banner,
  Button,
  Chip,
  FormField,
  MoneyInput,
  Screen,
  Select,
  SwitchRow,
  Text,
} from '@/components/ui';
import { formatHorizonLabel, formatMinutesLabel } from '@/features/business/booking-presets';
import { useBusinessContext } from '@/features/business/business-provider';
import { businessHref } from '@/features/business/last-business';
import { ApiError, apiRequest } from '@/lib/api/client';

import {
  CustomFieldsEditor,
  draftFromResponse,
  draftsToPayload,
  type DraftCustomField,
} from './custom-fields-editor';
import { mapServiceValidationErrors, normalizeServiceIssuePath } from './map-service-validation';
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
  priceDraftInvalid: boolean;
  active: boolean;
  staffMemberIds: string[];
  minBookingNoticeMinutes: string;
  bookingHorizonDays: string;
};

type ServiceFormProps = {
  mode: 'create' | 'edit';
  serviceId?: string;
  /** Show the created success banner once after navigate-from-create (`?created=1`). */
  showCreatedBanner?: boolean;
};

function nullableSelectValue(raw: string): number | null {
  if (raw === 'null') return null;
  return Number(raw);
}

function toSelectString(value: number | null): string {
  return value === null ? 'null' : String(value);
}

/** Create or edit a service: duration/buffers, MoneyInput, staff chips, custom fields. */
export function ServiceForm({
  mode,
  serviceId,
  showCreatedBanner = false,
}: ServiceFormProps): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
  const router = useRouter();
  const { business } = useBusinessContext();
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const listHref = businessHref(business.id, '/services');

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [customFields, setCustomFields] = useState<DraftCustomField[]>([]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadNonce, setLoadNonce] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [createdBanner, setCreatedBanner] = useState(showCreatedBanner);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const formSchema = useMemo(
    () =>
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1, { error: t('business:services.errors.nameRequired') })
            .max(80, { error: t('business:services.errors.nameTooLong') }),
          description: z.string().superRefine((value, ctx) => {
            const trimmed = value.trim();
            if (trimmed === '') return;
            if (trimmed.length > 1000) {
              ctx.addIssue({
                code: 'custom',
                message: t('business:services.errors.descriptionTooLong'),
              });
            }
          }),
          durationMinutes: z.string().refine((v) => isValidDurationMinutes(Number(v)), {
            error: t('business:services.errors.durationInvalid'),
          }),
          bufferBeforeMinutes: z.string().refine((v) => isValidBufferMinutes(Number(v)), {
            error: t('business:services.errors.bufferInvalid'),
          }),
          bufferAfterMinutes: z.string().refine((v) => isValidBufferMinutes(Number(v)), {
            error: t('business:services.errors.bufferInvalid'),
          }),
          priceAmount: z
            .number({ error: t('business:services.errors.priceRequired') })
            .int()
            .min(0, { error: t('business:services.errors.priceInvalid') })
            .max(99_999_999, { error: t('business:services.errors.priceInvalid') })
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
              message: t('business:services.errors.priceInvalid'),
            });
            return;
          }
          if (data.priceAmount === null) {
            ctx.addIssue({
              code: 'custom',
              path: ['priceAmount'],
              message: t('business:services.errors.priceRequired'),
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
  const staffMemberIds = useWatch({ control: form.control, name: 'staffMemberIds' }) ?? [];
  const priceAmount = useWatch({ control: form.control, name: 'priceAmount' });

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

  const durationT = useMemo(
    () =>
      ((key: string, values?: { count: number }) =>
        values ? t(`business:${key}`, values) : t(`business:${key}`)) as Parameters<
        typeof formatMinutesLabel
      >[1],
    [t],
  );

  const reload = useCallback(() => {
    setLoadNonce((n) => n + 1);
  }, []);

  function goBackToList(): void {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(listHref);
    }
  }

  const noticeError = form.formState.errors.minBookingNoticeMinutes?.message;
  const horizonError = form.formState.errors.bookingHorizonDays?.message;
  // Keep Advanced expanded while notice/horizon have form errors (no setState-in-effect).
  const advancedExpanded = advancedOpen || Boolean(noticeError) || Boolean(horizonError);

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
        setLoadError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // form.reset is stable; listing `form` retriggers load every render under React 19.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [business.id, mode, serviceId, t, loadNonce]);

  function validateCustomFieldsLocally(): boolean {
    const errors: Partial<Record<string, string>> = {};
    const keys = new Set<string>();
    customFields.forEach((field) => {
      const label = field.label.trim();
      if (!label) {
        errors[`${field.clientId}.label`] = t('business:customFields.errors.labelRequired');
      } else if (label.length > 80) {
        errors[`${field.clientId}.label`] = t('business:customFields.errors.labelTooLong');
      }
      if (!isValidCustomFieldKey(field.key)) {
        errors[`${field.clientId}.key`] = t('business:customFields.errors.keyInvalid');
      } else if (keys.has(field.key)) {
        errors[`${field.clientId}.key`] = t('business:customFields.errors.keyDuplicate');
      } else {
        keys.add(field.key);
      }
      if (field.type === 'SELECT') {
        if (field.options.length < 1) {
          errors[`${field.clientId}.options`] = t('business:customFields.errors.optionsRequired');
        } else {
          const values = field.options.map((o) => o.value.trim());
          if (values.some((v) => !v) || field.options.some((o) => !o.label.trim())) {
            errors[`${field.clientId}.options`] = t(
              'business:customFields.errors.optionIncomplete',
            );
          } else if (
            values.some((v) => v.length > 80) ||
            field.options.some((o) => o.label.trim().length > 80)
          ) {
            errors[`${field.clientId}.options`] = t('business:customFields.errors.optionTooLong');
          } else if (new Set(values).size !== values.length) {
            errors[`${field.clientId}.options`] = t('business:customFields.errors.optionDuplicate');
          }
        }
      }
    });
    setCustomFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(values: ServiceFormValues): Promise<void> {
    if (!canEdit) return;
    setApiError(null);
    setSaved(false);
    setCreatedBanner(false);
    if (!validateCustomFieldsLocally()) {
      setApiError(t('business:customFields.errors.formInvalid'));
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
        router.replace(`${businessHref(business.id, `/services/${created.id}`)}?created=1`);
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
      setSaved(true);
    } catch (err) {
      mapServiceValidationErrors(err, form.setError, t('business:services.errors.invalid'));
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
            next[`${field.clientId}.${prop}`] = t('business:services.errors.invalid');
          }
          if (Object.keys(next).length > 0) {
            setCustomFieldErrors((prev) => ({ ...prev, ...next }));
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setApiError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    }
  }

  if (!canEdit && mode === 'create') {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <View style={styles.root}>
          <Banner tone="error" message={t('business:services.forbidden')} />
          <Button
            label={t('business:services.backToList')}
            variant="secondary"
            onPress={goBackToList}
          />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <View
          style={styles.centered}
          accessibilityLabel={t('business:services.loading')}
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator color={tokens.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <View style={styles.root}>
          <Banner tone="error" message={loadError} />
          <Button label={t('business:services.retry')} variant="secondary" onPress={reload} />
          <Button
            label={t('business:services.backToList')}
            variant="secondary"
            onPress={goBackToList}
          />
        </View>
      </Screen>
    );
  }

  const readOnly = !canEdit;
  const staffError = form.formState.errors.staffMemberIds?.message;

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.headerText}>
          <Text variant="title">
            {mode === 'create'
              ? t('business:services.createHeading')
              : t('business:services.editHeading')}
          </Text>
          <Text variant="caption" color="text03">
            {readOnly
              ? t('business:services.readOnlySubtitle')
              : t('business:services.formSubtitle')}
          </Text>
        </View>

        {createdBanner ? (
          <Banner tone="success" message={t('business:services.createdToast')} />
        ) : null}
        {saved ? <Banner tone="success" message={t('business:services.savedToast')} /> : null}
        {apiError ? <Banner tone="error" message={apiError} /> : null}

        <FormField
          control={form.control}
          name="name"
          label={t('business:services.name')}
          editable={!readOnly && !form.formState.isSubmitting}
          autoComplete="off"
          testID="service-name"
        />
        <FormField
          control={form.control}
          name="description"
          label={t('business:services.description')}
          editable={!readOnly && !form.formState.isSubmitting}
          multiline
          numberOfLines={3}
          testID="service-description"
        />

        <Controller
          control={form.control}
          name="durationMinutes"
          render={({ field, fieldState }) => (
            <Select
              label={t('business:services.duration')}
              value={field.value}
              options={durationOptions.map((minutes) => ({
                value: String(minutes),
                label: t('business:services.minutesOption', { count: minutes }),
              }))}
              onChange={field.onChange}
              disabled={readOnly || form.formState.isSubmitting}
              error={fieldState.error?.message}
              testID="service-duration"
            />
          )}
        />
        <Controller
          control={form.control}
          name="bufferBeforeMinutes"
          render={({ field, fieldState }) => (
            <Select
              label={t('business:services.bufferBefore')}
              value={field.value}
              options={bufferBeforeOptions.map((minutes) => ({
                value: String(minutes),
                label: t('business:services.minutesOption', { count: minutes }),
              }))}
              onChange={field.onChange}
              disabled={readOnly || form.formState.isSubmitting}
              error={fieldState.error?.message}
              testID="service-buffer-before"
            />
          )}
        />
        <Controller
          control={form.control}
          name="bufferAfterMinutes"
          render={({ field, fieldState }) => (
            <Select
              label={t('business:services.bufferAfter')}
              value={field.value}
              options={bufferAfterOptions.map((minutes) => ({
                value: String(minutes),
                label: t('business:services.minutesOption', { count: minutes }),
              }))}
              onChange={field.onChange}
              disabled={readOnly || form.formState.isSubmitting}
              error={fieldState.error?.message}
              testID="service-buffer-after"
            />
          )}
        />

        <MoneyInput
          label={t('business:services.price')}
          value={priceAmount}
          onChange={(minor) =>
            form.setValue('priceAmount', minor, { shouldDirty: true, shouldValidate: true })
          }
          onDraftInvalidChange={(invalid) => {
            form.setValue('priceDraftInvalid', invalid, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
          currency="EUR"
          // Do not toggle `disabled` on isSubmitting — that blurs the focused price field
          // and lets onBlur commit a partial draft (e.g. "12" → 1200) after a blocked Save.
          disabled={readOnly}
          error={form.formState.errors.priceAmount?.message}
          testID="service-price"
        />

        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <SwitchRow
              label={t('business:services.activeToggle')}
              value={field.value}
              onValueChange={field.onChange}
              disabled={readOnly || form.formState.isSubmitting}
              testID="service-active"
            />
          )}
        />

        <View style={styles.staffSection}>
          <Text variant="body">{t('business:services.staffHeading')}</Text>
          <Text variant="caption" color="text03">
            {t('business:services.staffHint')}
          </Text>
          {staff.length === 0 ? (
            <Text variant="body" color="text03">
              {t('business:services.staffEmpty')}
            </Text>
          ) : (
            <View style={styles.chips}>
              {staff.map((member) => {
                const selected = staffMemberIds.includes(member.id);
                const disabled =
                  readOnly || form.formState.isSubmitting || (!member.active && !selected);
                return (
                  <Chip
                    key={member.id}
                    label={
                      member.active
                        ? member.displayName
                        : t('business:services.staffInactiveName', {
                            name: member.displayName,
                          })
                    }
                    selected={selected}
                    disabled={disabled}
                    onPress={
                      disabled
                        ? undefined
                        : () => {
                            const next = selected
                              ? staffMemberIds.filter((id) => id !== member.id)
                              : [...staffMemberIds, member.id];
                            form.setValue('staffMemberIds', next, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                    }
                    testID={`service-staff-${member.id}`}
                  />
                );
              })}
            </View>
          )}
          {staffError ? (
            <Text variant="caption" color="danger" accessibilityRole="alert">
              {staffError}
            </Text>
          ) : null}
        </View>

        <CustomFieldsEditor
          value={customFields}
          onChange={setCustomFields}
          readOnly={readOnly}
          disabled={form.formState.isSubmitting}
          errors={customFieldErrors}
        />

        <View style={styles.advanced}>
          <Button
            label={t('business:services.advancedHeading')}
            variant="ghost"
            accessibilityState={{ expanded: advancedExpanded }}
            onPress={() => setAdvancedOpen((open) => !open)}
            testID="service-advanced-toggle"
          />
          {advancedExpanded ? (
            <View style={styles.advancedBody}>
              <Controller
                control={form.control}
                name="minBookingNoticeMinutes"
                render={({ field, fieldState }) => (
                  <Select
                    label={t('business:services.minNotice')}
                    value={field.value}
                    options={noticeOptions.map((value) => ({
                      value: toSelectString(value),
                      label:
                        value === null
                          ? t('business:services.inheritDefault')
                          : formatMinutesLabel(value, durationT),
                    }))}
                    onChange={field.onChange}
                    disabled={readOnly || form.formState.isSubmitting}
                    error={fieldState.error?.message}
                    testID="service-notice"
                  />
                )}
              />
              {!form.formState.errors.minBookingNoticeMinutes ? (
                <Text variant="caption" color="text03">
                  {t('business:services.minNoticeHint')}
                </Text>
              ) : null}
              <Controller
                control={form.control}
                name="bookingHorizonDays"
                render={({ field, fieldState }) => (
                  <Select
                    label={t('business:services.horizon')}
                    value={field.value}
                    options={horizonOptions.map((value) => ({
                      value: toSelectString(value),
                      label:
                        value === null
                          ? t('business:services.inheritDefault')
                          : formatHorizonLabel(value, durationT),
                    }))}
                    onChange={field.onChange}
                    disabled={readOnly || form.formState.isSubmitting}
                    error={fieldState.error?.message}
                    testID="service-horizon"
                  />
                )}
              />
              {!form.formState.errors.bookingHorizonDays ? (
                <Text variant="caption" color="text03">
                  {t('business:services.horizonHint')}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {!readOnly ? (
            <Button
              label={
                mode === 'create'
                  ? t('business:services.createSubmit')
                  : t('business:services.save')
              }
              loading={form.formState.isSubmitting}
              onPress={form.handleSubmit(onSubmit)}
              testID="service-submit"
            />
          ) : null}
          <Button
            label={t('business:services.backToList')}
            variant="secondary"
            onPress={goBackToList}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.lg, padding: tokens.spacing.lg },
  headerText: { gap: tokens.spacing.xs },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  staffSection: { gap: tokens.spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  advanced: { gap: tokens.spacing.sm },
  advancedBody: { gap: tokens.spacing.md },
  actions: { gap: tokens.spacing.sm },
});
