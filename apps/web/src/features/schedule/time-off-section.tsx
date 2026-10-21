'use client';

import {
  createTimeOffRequestSchema,
  type CreateTimeOffRequest,
  type TimeOff,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-input';

import { mapTimeOffValidationErrors } from './map-schedule-validation';
import {
  addCalendarDays,
  formatBusinessDateTime,
  toBusinessLocalDateTime,
} from './schedule-format';

type TimeOffSectionProps = {
  upcoming: TimeOff[];
  past: TimeOff[];
  timeZone: string;
  disabled?: boolean;
  onCreate: (body: CreateTimeOffRequest) => Promise<TimeOff>;
  onDelete: (timeOffId: string) => Promise<void>;
};

type TimeOffFormValues = {
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function TimeOffSection({
  upcoming,
  past,
  timeZone,
  disabled = false,
  onCreate,
  onDelete,
}: TimeOffSectionProps) {
  const t = useTranslations('business');
  const locale = useLocale();
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
    setDeletingId(id);
    try {
      await onDelete(id);
      setConflictWarning((prev) => (prev?.id === id ? null : prev));
    } catch {
      // Parent toasts; avoid unhandled rejection from the confirm click.
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-subtitle font-bold text-foreground">
            {t('schedule.timeOff.heading')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('schedule.timeOff.subtitle')}</p>
        </div>
        <Button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDialogOpen(true);
          }}
        >
          {t('schedule.timeOff.add')}
        </Button>
      </div>

      {conflictWarning ? (
        <Alert variant="warning">
          <AlertTitle>{t('schedule.timeOff.conflictsTitle')}</AlertTitle>
          <AlertDescription>
            {conflictWarning.conflictingBookings.length === 0
              ? t('schedule.timeOff.conflictsEmpty')
              : t('schedule.timeOff.conflictsCount', {
                  count: conflictWarning.conflictingBookings.length,
                })}
          </AlertDescription>
        </Alert>
      ) : null}

      <TimeOffList
        title={t('schedule.timeOff.upcoming')}
        empty={t('schedule.timeOff.upcomingEmpty')}
        items={upcoming}
        locale={locale}
        timeZone={timeZone}
        deletingId={deletingId}
        disabled={disabled}
        onDelete={handleDelete}
      />

      <TimeOffList
        title={t('schedule.timeOff.past')}
        empty={t('schedule.timeOff.pastEmpty')}
        items={past}
        locale={locale}
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
    </section>
  );
}

type TimeOffListProps = {
  title: string;
  empty: string;
  items: TimeOff[];
  locale: string;
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
  locale,
  timeZone,
  deletingId,
  disabled,
  hideDelete,
  onDelete,
}: TimeOffListProps) {
  const t = useTranslations('business');

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {formatBusinessDateTime(item.startsAt, locale, timeZone)}
                  {' → '}
                  {formatBusinessDateTime(item.endsAt, locale, timeZone)}
                </p>
                {item.reason ? (
                  <p className="truncate text-xs text-muted-foreground">{item.reason}</p>
                ) : null}
              </div>
              {!hideDelete ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={disabled || deletingId === item.id}
                    >
                      {t('schedule.timeOff.delete')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('schedule.timeOff.deleteTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('schedule.timeOff.deleteDescription')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('schedule.timeOff.deleteCancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deletingId === item.id}
                        onClick={(event) => {
                          event.preventDefault();
                          void onDelete(item.id);
                        }}
                      >
                        {deletingId === item.id
                          ? t('schedule.timeOff.deleting')
                          : t('schedule.timeOff.deleteConfirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type TimeOffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (body: CreateTimeOffRequest) => Promise<void>;
};

function TimeOffDialog({ open, onOpenChange, submitting, onSubmit }: TimeOffDialogProps) {
  const t = useTranslations('business');
  const tShell = useTranslations('shell');
  const allDayId = useId();

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
          // Skip body build when dates are incomplete — field regex already reported errors.
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
      // Parent toasts non-validation failures; do not rethrow.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tShell('close')}>
        <DialogHeader>
          <DialogTitle>{t('schedule.timeOff.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('schedule.timeOff.dialogSubtitle')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <Label htmlFor={allDayId} className="text-sm font-bold">
              {t('schedule.timeOff.allDay')}
            </Label>
            <Controller
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <Switch
                  id={allDayId}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={submitting}
                />
              )}
            />
          </div>

          <FormField
            label={t('schedule.timeOff.startDate')}
            error={form.formState.errors.startDate?.message}
          >
            <Input type="date" {...form.register('startDate')} disabled={submitting} />
          </FormField>

          <FormField
            label={t('schedule.timeOff.endDate')}
            error={form.formState.errors.endDate?.message}
            description={allDay ? t('schedule.timeOff.allDayHint') : undefined}
          >
            <Input type="date" {...form.register('endDate')} disabled={submitting} />
          </FormField>

          {!allDay ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormField
                    label={t('schedule.timeOff.startTime')}
                    error={form.formState.errors.startTime?.message}
                  >
                    <TimeInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={submitting}
                    />
                  </FormField>
                )}
              />
              <Controller
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormField
                    label={t('schedule.timeOff.endTime')}
                    error={form.formState.errors.endTime?.message}
                  >
                    <TimeInput
                      value={field.value}
                      onChange={field.onChange}
                      disabled={submitting}
                    />
                  </FormField>
                )}
              />
            </div>
          ) : null}

          <FormField
            label={t('schedule.timeOff.reason')}
            error={form.formState.errors.reason?.message}
            description={t('schedule.timeOff.reasonHint')}
          >
            <Input
              {...form.register('reason')}
              disabled={submitting}
              autoComplete="off"
              maxLength={500}
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              {t('schedule.timeOff.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? t('schedule.timeOff.creating') : t('schedule.timeOff.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Map form values to the API body (all-day → next-day 00:00, never T24:00). */
export function buildCreateBody(values: TimeOffFormValues): CreateTimeOffRequest | null {
  const reason = values.reason.trim();
  if (values.allDay) {
    const endDate = addCalendarDays(values.endDate, 1);
    if (!endDate) return null;
    return {
      start: toBusinessLocalDateTime(values.startDate, '00:00'),
      end: toBusinessLocalDateTime(endDate, '00:00'),
      ...(reason ? { reason } : {}),
    };
  }
  return {
    start: toBusinessLocalDateTime(values.startDate, values.startTime),
    end: toBusinessLocalDateTime(values.endDate, values.endTime),
    ...(reason ? { reason } : {}),
  };
}
