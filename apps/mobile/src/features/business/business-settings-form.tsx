import { zodResolver } from '@hookform/resolvers/zod';
import {
  businessSchema,
  confirmationModeSchema,
  updateBusinessRequestSchema,
  type ConfirmationMode,
  type UpdateBusinessRequest,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner, Button, SegmentedControl, Select, Text } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api/client';

import {
  BOOKING_HORIZON_DAY_PRESETS,
  CANCELLATION_WINDOW_PRESETS,
  formatHorizonLabel,
  formatMinutesLabel,
  MIN_BOOKING_NOTICE_PRESETS,
  optionsWithCurrentValue,
} from './booking-presets';
import { useBusinessContext } from './business-provider';
import { businessHref } from './last-business';

type SettingsFormValues = {
  confirmationMode: ConfirmationMode;
  cancellationWindowMinutes: string;
  minBookingNoticeMinutes: string;
  bookingHorizonDays: string;
};

function toSettingsFormValues(business: {
  confirmationMode: ConfirmationMode;
  cancellationWindowMinutes: number;
  minBookingNoticeMinutes: number;
  bookingHorizonDays: number;
}): SettingsFormValues {
  return {
    confirmationMode: business.confirmationMode,
    cancellationWindowMinutes: String(business.cancellationWindowMinutes),
    minBookingNoticeMinutes: String(business.minBookingNoticeMinutes),
    bookingHorizonDays: String(business.bookingHorizonDays),
  };
}

/** Booking policy settings. STAFF should not reach this view (hidden in More). */
export function BusinessSettingsForm(): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
  const router = useRouter();
  const { business, setBusiness } = useBusinessContext();
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cancellationOptions = useMemo(
    () => optionsWithCurrentValue(CANCELLATION_WINDOW_PRESETS, business.cancellationWindowMinutes),
    [business.cancellationWindowMinutes],
  );
  const noticeOptions = useMemo(
    () => optionsWithCurrentValue(MIN_BOOKING_NOTICE_PRESETS, business.minBookingNoticeMinutes),
    [business.minBookingNoticeMinutes],
  );
  const horizonOptions = useMemo(
    () => optionsWithCurrentValue(BOOKING_HORIZON_DAY_PRESETS, business.bookingHorizonDays),
    [business.bookingHorizonDays],
  );

  const durationT = useMemo(
    () =>
      ((key: string, values?: { count: number }) =>
        values ? t(`business:${key}`, values) : t(`business:${key}`)) as Parameters<
        typeof formatMinutesLabel
      >[1],
    [t],
  );

  const formSchema = useMemo(
    () =>
      z.object({
        confirmationMode: confirmationModeSchema,
        cancellationWindowMinutes: z
          .string()
          .refine((value) => cancellationOptions.includes(Number(value))),
        minBookingNoticeMinutes: z
          .string()
          .refine((value) => noticeOptions.includes(Number(value))),
        bookingHorizonDays: z.string().refine((value) => horizonOptions.includes(Number(value))),
      }),
    [cancellationOptions, horizonOptions, noticeOptions],
  );

  const formValues = useMemo(() => toSettingsFormValues(business), [business]);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    values: formValues,
    resetOptions: { keepDirtyValues: true },
  });

  const confirmationMode = useWatch({
    control: form.control,
    name: 'confirmationMode',
  });

  async function onSubmit(values: SettingsFormValues): Promise<void> {
    if (!canEdit) return;
    setApiError(null);
    setSaved(false);
    const dirty = form.formState.dirtyFields;
    const body: UpdateBusinessRequest = {};
    if (dirty.confirmationMode) {
      body.confirmationMode = values.confirmationMode;
    }
    if (dirty.cancellationWindowMinutes) {
      body.cancellationWindowMinutes = Number(values.cancellationWindowMinutes);
    }
    if (dirty.minBookingNoticeMinutes) {
      body.minBookingNoticeMinutes = Number(values.minBookingNoticeMinutes);
    }
    if (dirty.bookingHorizonDays) {
      body.bookingHorizonDays = Number(values.bookingHorizonDays);
    }
    if (Object.keys(body).length === 0) {
      setSaved(true);
      return;
    }
    const parsed = updateBusinessRequestSchema.safeParse(body);
    if (!parsed.success) {
      setApiError(t('errors:VALIDATION_FAILED'));
      return;
    }
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}`, {
        method: 'PATCH',
        body: parsed.data,
      });
      const updated = businessSchema.parse(raw);
      const nextValues = toSettingsFormValues(updated);
      if (parsed.data.confirmationMode !== undefined) {
        form.resetField('confirmationMode', { defaultValue: nextValues.confirmationMode });
      }
      if (parsed.data.cancellationWindowMinutes !== undefined) {
        form.resetField('cancellationWindowMinutes', {
          defaultValue: nextValues.cancellationWindowMinutes,
        });
      }
      if (parsed.data.minBookingNoticeMinutes !== undefined) {
        form.resetField('minBookingNoticeMinutes', {
          defaultValue: nextValues.minBookingNoticeMinutes,
        });
      }
      if (parsed.data.bookingHorizonDays !== undefined) {
        form.resetField('bookingHorizonDays', { defaultValue: nextValues.bookingHorizonDays });
      }
      setBusiness((prev) => ({
        ...updated,
        logoUrl: prev.logoUrl,
        coverUrl: prev.coverUrl,
      }));
      setSaved(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setApiError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    }
  }

  if (!canEdit) {
    return (
      <View style={styles.form} testID="business-settings-forbidden">
        <Text variant="title">{t('business:settings.heading')}</Text>
        <Text variant="body" color="text03">
          {t('business:settings.forbidden')}
        </Text>
        <Button
          label={t('business:settings.backToOverview')}
          variant="secondary"
          onPress={() => router.replace(businessHref(business.id))}
        />
      </View>
    );
  }

  return (
    <View style={styles.form} testID="business-settings-form">
      <View>
        <Text variant="title">{t('business:settings.heading')}</Text>
        <Text variant="body" color="text03" style={styles.subtitle}>
          {t('business:settings.subtitle')}
        </Text>
      </View>

      {saved ? <Banner tone="success" message={t('business:settings.saved')} /> : null}
      {apiError ? <Banner tone="error" message={apiError} /> : null}

      <View style={styles.field}>
        <Text variant="caption" color="text02">
          {t('business:settings.confirmationMode')}
        </Text>
        <Controller
          control={form.control}
          name="confirmationMode"
          render={({ field }) => (
            <SegmentedControl
              accessibilityLabel={t('business:settings.confirmationMode')}
              value={field.value}
              onChange={(value) => field.onChange(value as ConfirmationMode)}
              options={[
                { value: 'AUTO', label: t('business:settings.confirmationAuto') },
                { value: 'MANUAL', label: t('business:settings.confirmationManual') },
              ]}
              testID="settings-confirmation-mode"
            />
          )}
        />
        <Text variant="caption" color="text03">
          {confirmationMode === 'AUTO'
            ? t('business:settings.confirmationAutoHint')
            : t('business:settings.confirmationManualHint')}
        </Text>
      </View>

      <Controller
        control={form.control}
        name="cancellationWindowMinutes"
        render={({ field }) => (
          <Select
            label={t('business:settings.cancellationWindow')}
            value={field.value}
            options={cancellationOptions.map((value) => ({
              value: String(value),
              label: formatMinutesLabel(value, durationT),
            }))}
            onChange={field.onChange}
            testID="settings-cancellation"
          />
        )}
      />
      <Text variant="caption" color="text03">
        {t('business:settings.cancellationWindowHint')}
      </Text>

      <Controller
        control={form.control}
        name="minBookingNoticeMinutes"
        render={({ field }) => (
          <Select
            label={t('business:settings.minNotice')}
            value={field.value}
            options={noticeOptions.map((value) => ({
              value: String(value),
              label: formatMinutesLabel(value, durationT),
            }))}
            onChange={field.onChange}
            testID="settings-notice"
          />
        )}
      />
      <Text variant="caption" color="text03">
        {t('business:settings.minNoticeHint')}
      </Text>

      <Controller
        control={form.control}
        name="bookingHorizonDays"
        render={({ field }) => (
          <Select
            label={t('business:settings.horizon')}
            value={field.value}
            options={horizonOptions.map((value) => ({
              value: String(value),
              label: formatHorizonLabel(value, durationT),
            }))}
            onChange={field.onChange}
            testID="settings-horizon"
          />
        )}
      />
      <Text variant="caption" color="text03">
        {t('business:settings.horizonHint')}
      </Text>

      <Button
        label={
          form.formState.isSubmitting ? t('business:settings.saving') : t('business:settings.save')
        }
        fullWidth
        loading={form.formState.isSubmitting}
        onPress={() => void form.handleSubmit(onSubmit)()}
        testID="settings-save"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
  subtitle: { marginTop: tokens.spacing.xs },
  field: { gap: tokens.spacing.sm },
});
