import {
  createTimeOffRequestSchema,
  type CreateTimeOffRequest,
  type TimeOff,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Banner,
  Button,
  DatePicker,
  ListGroup,
  ListItem,
  SwitchRow,
  Text,
  TextField,
  TimePicker,
  confirm,
} from '@/components/ui';
import { fontFamilies } from '@/components/ui/theme';

import { mapTimeOffValidationErrors } from './map-schedule-validation';
import { addCalendarDays, formatBusinessDateTime } from './schedule-format';
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
      // Parent toasts; avoid unhandled rejection.
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
        <ListGroup>
          {items.map((item) => (
            <ListItem
              key={item.id}
              title={`${formatBusinessDateTime(item.startsAt, locale, timeZone)} → ${formatBusinessDateTime(item.endsAt, locale, timeZone)}`}
              subtitle={item.reason ?? undefined}
              trailing={
                hideDelete ? undefined : (
                  <Button
                    label={
                      deletingId === item.id
                        ? t('schedule.timeOff.deleting')
                        : t('schedule.timeOff.delete')
                    }
                    variant="destructive"
                    size="sm"
                    disabled={disabled || deletingId === item.id}
                    onPress={() => void onDelete(item.id)}
                    testID={`delete-time-off-${item.id}`}
                  />
                )
              }
            />
          ))}
        </ListGroup>
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
  const { t } = useTranslation('business');

  const formSchema = useMemo(
    () =>
      z
        .object({
          allDay: z.boolean(),
          startDate: z.string().regex(ISO_DATE_RE, t('schedule.timeOff.errors.date')),
          endDate: z.string().regex(ISO_DATE_RE, t('schedule.timeOff.errors.date')),
          startTime: z.string().min(1),
          endTime: z.string().min(1),
          reason: z.string().max(500, t('schedule.timeOff.errors.reasonMax')),
        })
        .superRefine((values, ctx) => {
          if (!ISO_DATE_RE.test(values.startDate) || !ISO_DATE_RE.test(values.endDate)) {
            return;
          }
          if (values.allDay) {
            const nextDay = addCalendarDays(values.endDate, 1);
            if (!nextDay) return;
          }
          const body = buildCreateBody(values);
          if (!body) return;
          const parsed = createTimeOffRequestSchema.safeParse(body);
          if (!parsed.success) {
            ctx.addIssue({
              code: 'custom',
              message: t('schedule.timeOff.errors.range'),
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

  async function submit(values: TimeOffFormValues): Promise<void> {
    const body = buildCreateBody(values);
    if (!body) {
      form.setError('endDate', { message: t('schedule.timeOff.errors.date') });
      return;
    }
    const parsed = createTimeOffRequestSchema.safeParse(body);
    if (!parsed.success) {
      form.setError('endDate', { message: t('schedule.timeOff.errors.range') });
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
      mapTimeOffValidationErrors(err, form.setError, t('schedule.timeOff.errors.invalid'));
    }
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
      accessibilityViewIsModal
    >
      <Pressable style={styles.modalBackdrop} onPress={() => onOpenChange(false)}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text variant="title">{t('schedule.timeOff.dialogTitle')}</Text>
          <Text variant="caption" color="text03">
            {t('schedule.timeOff.dialogSubtitle')}
          </Text>

          <Controller
            control={form.control}
            name="allDay"
            render={({ field }) => (
              <SwitchRow
                label={t('schedule.timeOff.allDay')}
                description={t('schedule.timeOff.allDayHint')}
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
                label={t('schedule.timeOff.startDate')}
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
                label={t('schedule.timeOff.endDate')}
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
                    label={t('schedule.timeOff.startTime')}
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
                    label={t('schedule.timeOff.endTime')}
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
                label={t('schedule.timeOff.reason')}
                value={field.value}
                onChangeText={field.onChange}
                editable={!submitting}
                error={form.formState.errors.reason?.message}
                helperText={t('schedule.timeOff.reasonHint')}
                maxLength={500}
                testID="time-off-reason"
              />
            )}
          />

          <View style={styles.dialogActions}>
            <Button
              label={t('schedule.timeOff.cancel')}
              variant="secondary"
              disabled={submitting}
              onPress={() => onOpenChange(false)}
            />
            <Button
              label={submitting ? t('schedule.timeOff.creating') : t('schedule.timeOff.create')}
              loading={submitting}
              onPress={() => void form.handleSubmit(submit)()}
              testID="time-off-create"
            />
          </View>
        </Pressable>
      </Pressable>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
    paddingBottom: tokens.spacing['2xl'],
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.base01,
    maxHeight: '90%',
  },
  dialogActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
});
