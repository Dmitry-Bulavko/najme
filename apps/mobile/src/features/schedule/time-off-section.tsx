import {
  createTimeOffRequestSchema,
  type CreateTimeOffRequest,
  type TimeOff,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Banner,
  Button,
  DatePicker,
  SwitchRow,
  Text,
  TextField,
  TimePicker,
  confirm,
} from '@/components/ui';
import { fontFamilies } from '@/components/ui/theme';
import { ApiError } from '@/lib/api/client';

import { isValidationFailedCode, mapTimeOffValidationErrors } from './map-schedule-validation';
import { formatBusinessDateTime } from './schedule-format';
import { buildCreateBody, type TimeOffFormValues } from './time-off-body';

type TimeOffSectionProps = {
  upcoming: TimeOff[];
  past: TimeOff[];
  timeZone: string;
  disabled?: boolean;
  onCreate: (body: CreateTimeOffRequest) => Promise<TimeOff>;
  onDelete: (timeOffId: string) => Promise<void>;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Time-off list, create dialog, and delete confirm. */
export function TimeOffSection({
  upcoming,
  past,
  timeZone,
  disabled = false,
  onCreate,
  onDelete,
}: TimeOffSectionProps): ReactElement {
  const { t } = useTranslation('business');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<TimeOff | null>(null);

  async function handleCreate(body: CreateTimeOffRequest): Promise<void> {
    setCreating(true);
    try {
      const created = await onCreate(body);
      setDialogOpen(false);
      setConflictWarning(created);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    const ok = await confirm({
      title: t('schedule.timeOff.deleteTitle'),
      message: t('schedule.timeOff.deleteDescription'),
      confirmLabel: t('schedule.timeOff.deleteConfirm'),
      cancelLabel: t('schedule.timeOff.deleteCancel'),
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(id);
    try {
      await onDelete(id);
      setConflictWarning((prev) => (prev?.id === id ? null : prev));
    } catch {
      // Parent shows action banner; keep the row visible.
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={styles.section} testID="time-off-section">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title" style={styles.heading}>
            {t('schedule.timeOff.heading')}
          </Text>
          <Text variant="caption" color="text03">
            {t('schedule.timeOff.subtitle')}
          </Text>
        </View>
        <Button
          label={t('schedule.timeOff.add')}
          disabled={disabled}
          onPress={() => setDialogOpen(true)}
          testID="add-time-off"
        />
      </View>

      {conflictWarning ? (
        <Banner
          tone="warning"
          message={
            conflictWarning.conflictingBookings.length === 0
              ? t('schedule.timeOff.conflictsEmpty')
              : t('schedule.timeOff.conflictsCount', {
                  count: conflictWarning.conflictingBookings.length,
                })
          }
        />
      ) : null}

      <TimeOffList
        title={t('schedule.timeOff.upcoming')}
        empty={t('schedule.timeOff.upcomingEmpty')}
        items={upcoming}
        timeZone={timeZone}
        deletingId={deletingId}
        disabled={disabled}
        onDelete={handleDelete}
      />

      <TimeOffList
        title={t('schedule.timeOff.past')}
        empty={t('schedule.timeOff.pastEmpty')}
        items={past}
        timeZone={timeZone}
        deletingId={deletingId}
        disabled={disabled}
        onDelete={handleDelete}
        hideDelete
      />

      <TimeOffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        submitting={creating}
        onSubmit={handleCreate}
      />
    </View>
  );
}

type TimeOffListProps = {
  title: string;
  empty: string;
  items: TimeOff[];
  timeZone: string;
  deletingId: string | null;
  disabled: boolean;
  hideDelete?: boolean;
  onDelete: (id: string) => Promise<void>;
};

function TimeOffList({
  title,
  empty,
  items,
  timeZone,
  deletingId,
  disabled,
  hideDelete,
  onDelete,
}: TimeOffListProps): ReactElement {
  const { t, i18n } = useTranslation('business');
  const locale = i18n.language;

  return (
    <View style={styles.listBlock}>
      <Text variant="body" style={styles.listTitle}>
        {title}
      </Text>
      {items.length === 0 ? (
        <Text variant="caption" color="text03">
          {empty}
        </Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const range = `${formatBusinessDateTime(item.startsAt, locale, timeZone)} → ${formatBusinessDateTime(item.endsAt, locale, timeZone)}`;
            return (
              <View key={item.id} style={styles.row} testID={`time-off-row-${item.id}`}>
                <View style={styles.rowBody}>
                  <Text variant="body">{range}</Text>
                  {item.reason ? (
                    <Text variant="caption" color="text03" numberOfLines={2}>
                      {item.reason}
                    </Text>
                  ) : null}
                </View>
                {!hideDelete ? (
                  <Button
                    label={
                      deletingId === item.id
                        ? t('schedule.timeOff.deleting')
                        : t('schedule.timeOff.delete')
                    }
                    accessibilityLabel={t('schedule.timeOff.deleteNamed', { range })}
                    variant="destructive"
                    size="sm"
                    disabled={disabled || deletingId === item.id}
                    onPress={() => void onDelete(item.id)}
                    testID={`delete-time-off-${item.id}`}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

type TimeOffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (body: CreateTimeOffRequest) => Promise<void>;
};

function TimeOffDialog({
  open,
  onOpenChange,
  submitting,
  onSubmit,
}: TimeOffDialogProps): ReactElement {
  const { t } = useTranslation(['business', 'mobile', 'errors']);
  const [formLevelError, setFormLevelError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formSchema = useMemo(
    () =>
      z
        .object({
          allDay: z.boolean(),
          startDate: z.string().regex(ISO_DATE_RE, t('business:schedule.timeOff.errors.date')),
          endDate: z.string().regex(ISO_DATE_RE, t('business:schedule.timeOff.errors.date')),
          startTime: z.string().min(1, t('business:schedule.timeOff.errors.timeRequired')),
          endTime: z.string().min(1, t('business:schedule.timeOff.errors.timeRequired')),
          reason: z.string().max(500, t('business:schedule.timeOff.errors.reasonMax')),
        })
        .superRefine((values, ctx) => {
          if (!ISO_DATE_RE.test(values.startDate) || !ISO_DATE_RE.test(values.endDate)) {
            return;
          }
          const body = buildCreateBody(values);
          if (!body) return;
          const parsed = createTimeOffRequestSchema.safeParse(body);
          if (!parsed.success) {
            ctx.addIssue({
              code: 'custom',
              message: t('business:schedule.timeOff.errors.range'),
              path: ['endDate'],
            });
          }
        }),
    [t],
  );

  const form = useForm<TimeOffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      allDay: true,
      startDate: '',
      endDate: '',
      startTime: '09:00',
      endTime: '17:00',
      reason: '',
    },
  });

  const allDay = useWatch({ control: form.control, name: 'allDay' });
  const startDate = useWatch({ control: form.control, name: 'startDate' });
  const endDate = useWatch({ control: form.control, name: 'endDate' });

  // Prefill end date from start when end is still empty.
  useEffect(() => {
    if (ISO_DATE_RE.test(startDate) && !endDate) {
      form.setValue('endDate', startDate);
    }
  }, [endDate, form, startDate]);

  async function submit(values: TimeOffFormValues): Promise<void> {
    setFormLevelError(null);
    setSubmitError(null);
    const body = buildCreateBody(values);
    if (!body) {
      form.setError('endDate', { message: t('business:schedule.timeOff.errors.date') });
      return;
    }
    const parsed = createTimeOffRequestSchema.safeParse(body);
    if (!parsed.success) {
      form.setError('endDate', { message: t('business:schedule.timeOff.errors.range') });
      return;
    }
    try {
      await onSubmit(parsed.data);
      form.reset({
        allDay: true,
        startDate: '',
        endDate: '',
        startTime: '09:00',
        endTime: '17:00',
        reason: '',
      });
    } catch (err) {
      const mapped = mapTimeOffValidationErrors(
        err,
        form.setError,
        t('business:schedule.timeOff.errors.invalid'),
      );
      if (mapped) return;
      if (isValidationFailedCode(err)) {
        // e.g. >366 days with no field-level details — keep dialog open.
        setFormLevelError(t('business:schedule.timeOff.errors.invalid'));
        return;
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setSubmitError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    }
  }

  function requestClose(): void {
    if (submitting) return;
    onOpenChange(false);
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={requestClose}
      accessibilityViewIsModal
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mobile:ui.close')}
        style={styles.modalBackdrop}
        onPress={requestClose}
        disabled={submitting}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalAvoid}
      >
        <View style={styles.modalCard} testID="time-off-dialog">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScroll}
          >
            <Text variant="title">{t('business:schedule.timeOff.dialogTitle')}</Text>
            <Text variant="caption" color="text03">
              {t('business:schedule.timeOff.dialogSubtitle')}
            </Text>

            {formLevelError || submitError ? (
              <Banner tone="error" message={formLevelError ?? submitError ?? ''} />
            ) : null}

            <Controller
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <SwitchRow
                  label={t('business:schedule.timeOff.allDay')}
                  description={t('business:schedule.timeOff.allDayHint')}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={submitting}
                  testID="time-off-all-day"
                />
              )}
            />

            <Controller
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <DatePicker
                  label={t('business:schedule.timeOff.startDate')}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  error={form.formState.errors.startDate?.message}
                  testID="time-off-start-date"
                />
              )}
            />

            <Controller
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <DatePicker
                  label={t('business:schedule.timeOff.endDate')}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={submitting}
                  error={form.formState.errors.endDate?.message}
                  testID="time-off-end-date"
                />
              )}
            />

            {!allDay ? (
              <>
                <Controller
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <TimePicker
                      label={t('business:schedule.timeOff.startTime')}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={submitting}
                      error={form.formState.errors.startTime?.message}
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <TimePicker
                      label={t('business:schedule.timeOff.endTime')}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={submitting}
                      error={form.formState.errors.endTime?.message}
                    />
                  )}
                />
              </>
            ) : null}

            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => (
                <TextField
                  label={t('business:schedule.timeOff.reason')}
                  value={field.value}
                  onChangeText={field.onChange}
                  editable={!submitting}
                  error={form.formState.errors.reason?.message}
                  helperText={t('business:schedule.timeOff.reasonHint')}
                  maxLength={500}
                  testID="time-off-reason"
                />
              )}
            />

            <View style={styles.dialogActions}>
              <Button
                label={t('business:schedule.timeOff.cancel')}
                variant="secondary"
                disabled={submitting}
                onPress={requestClose}
              />
              <Button
                label={
                  submitting
                    ? t('business:schedule.timeOff.creating')
                    : t('business:schedule.timeOff.create')
                }
                loading={submitting}
                onPress={() => void form.handleSubmit(submit)()}
                testID="time-off-create"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.lg },
  header: { gap: tokens.spacing.md },
  headerText: { gap: tokens.spacing.xs },
  heading: { fontFamily: fontFamilies.bold },
  listBlock: { gap: tokens.spacing.sm },
  listTitle: { fontFamily: fontFamilies.bold },
  list: { gap: tokens.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    backgroundColor: tokens.colors.base01,
  },
  rowBody: { flex: 1, gap: tokens.spacing.xs },
  modalBackdrop: {
    flex: 1,
    backgroundColor: `${tokens.colors.text01}66`,
  },
  modalAvoid: {
    maxHeight: '90%',
  },
  modalCard: {
    backgroundColor: tokens.colors.base01,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    maxHeight: '90%',
  },
  modalScroll: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
    paddingBottom: tokens.spacing['2xl'],
  },
  dialogActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
});
