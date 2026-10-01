'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  businessSchema,
  confirmationModeSchema,
  updateBusinessRequestSchema,
  type ConfirmationMode,
  type UpdateBusinessRequest,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clearLastBusinessId } from './last-business';
import { useInvalidateMyBusinesses } from './use-my-businesses';
import { useBusinessContext } from './business-shell';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import {
  BOOKING_HORIZON_DAY_PRESETS,
  CANCELLATION_WINDOW_PRESETS,
  MIN_BOOKING_NOTICE_PRESETS,
  nearestPreset,
} from './booking-presets';

type SettingsFormValues = {
  confirmationMode: ConfirmationMode;
  cancellationWindowMinutes: string;
  minBookingNoticeMinutes: string;
  bookingHorizonDays: string;
};

function formatMinutesLabel(
  minutes: number,
  t: ReturnType<typeof useTranslations<'business'>>,
): string {
  if (minutes === 0) return t('settings.durationNone');
  if (minutes < 60) return t('settings.durationMinutes', { count: minutes });
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return t('settings.durationDays', { count: days });
  }
  if (minutes % 60 === 0) {
    return t('settings.durationHours', { count: minutes / 60 });
  }
  return t('settings.durationMinutes', { count: minutes });
}

/** Booking policy settings + OWNER danger zone. STAFF should not reach this view. */
export function BusinessSettingsForm() {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const { business, setBusiness } = useBusinessContext();
  const invalidateMyBusinesses = useInvalidateMyBusinesses();
  const isOwner = business.myRole === 'OWNER';
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const formSchema = useMemo(
    () =>
      z.object({
        confirmationMode: confirmationModeSchema,
        cancellationWindowMinutes: z.enum(
          CANCELLATION_WINDOW_PRESETS.map(String) as [string, ...string[]],
        ),
        minBookingNoticeMinutes: z.enum(
          MIN_BOOKING_NOTICE_PRESETS.map(String) as [string, ...string[]],
        ),
        bookingHorizonDays: z.enum(
          BOOKING_HORIZON_DAY_PRESETS.map(String) as [string, ...string[]],
        ),
      }),
    [],
  );

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    values: {
      confirmationMode: business.confirmationMode,
      cancellationWindowMinutes: String(
        nearestPreset(business.cancellationWindowMinutes, CANCELLATION_WINDOW_PRESETS),
      ),
      minBookingNoticeMinutes: String(
        nearestPreset(business.minBookingNoticeMinutes, MIN_BOOKING_NOTICE_PRESETS),
      ),
      bookingHorizonDays: String(
        nearestPreset(business.bookingHorizonDays, BOOKING_HORIZON_DAY_PRESETS),
      ),
    },
    resetOptions: { keepDirtyValues: true },
  });

  async function onSubmit(values: SettingsFormValues): Promise<void> {
    if (!canEdit) return;
    const body: UpdateBusinessRequest = {
      confirmationMode: values.confirmationMode,
      cancellationWindowMinutes: Number(values.cancellationWindowMinutes),
      minBookingNoticeMinutes: Number(values.minBookingNoticeMinutes),
      bookingHorizonDays: Number(values.bookingHorizonDays),
    };
    const parsed = updateBusinessRequestSchema.safeParse(body);
    if (!parsed.success) {
      toast.error(errorMessage(tErrors, 'VALIDATION_FAILED'));
      return;
    }
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}`, {
        method: 'PATCH',
        body: parsed.data,
      });
      setBusiness(businessSchema.parse(raw));
      toast.success(t('settings.saved'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    }
  }

  async function deleteBusiness(): Promise<void> {
    if (!isOwner || confirmName !== business.name) return;
    setDeleting(true);
    try {
      await apiRequest(`/businesses/${business.id}`, { method: 'DELETE' });
      clearLastBusinessId();
      await invalidateMyBusinesses();
      toast.success(t('settings.deletedToast'));
      router.replace(`/${locale}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
      setDeleting(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <h1 className="text-title font-bold text-foreground">{t('settings.heading')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.forbidden')}</p>
        <Button
          variant="outline"
          onClick={() => router.replace(`/${locale}/business/${business.id}`)}
        >
          {t('settings.backToOverview')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-title font-bold text-foreground">{t('settings.heading')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <fieldset className="space-y-3">
          <legend className="text-sm font-bold text-foreground">
            {t('settings.confirmationMode')}
          </legend>
          <Controller
            control={form.control}
            name="confirmationMode"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(value) => field.onChange(value as ConfirmationMode)}
                className="gap-4"
              >
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                  <RadioGroupItem value="AUTO" id="confirmation-auto" className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium">
                      {t('settings.confirmationAuto')}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t('settings.confirmationAutoHint')}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                  <RadioGroupItem value="MANUAL" id="confirmation-manual" className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium">
                      {t('settings.confirmationManual')}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t('settings.confirmationManualHint')}
                    </span>
                  </span>
                </label>
              </RadioGroup>
            )}
          />
        </fieldset>

        <div className="grid gap-2">
          <Label htmlFor="cancellation-window">{t('settings.cancellationWindow')}</Label>
          <Controller
            control={form.control}
            name="cancellationWindowMinutes"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="cancellation-window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANCELLATION_WINDOW_PRESETS.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {formatMinutesLabel(value, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">{t('settings.cancellationWindowHint')}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="min-notice">{t('settings.minNotice')}</Label>
          <Controller
            control={form.control}
            name="minBookingNoticeMinutes"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="min-notice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MIN_BOOKING_NOTICE_PRESETS.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {formatMinutesLabel(value, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">{t('settings.minNoticeHint')}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="horizon">{t('settings.horizon')}</Label>
          <Controller
            control={form.control}
            name="bookingHorizonDays"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="horizon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_HORIZON_DAY_PRESETS.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {t('settings.durationDays', { count: value })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">{t('settings.horizonHint')}</p>
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('settings.saving') : t('settings.save')}
        </Button>
      </form>

      {isOwner ? (
        <section className="space-y-3 rounded-md border border-destructive/40 p-4">
          <h2 className="text-sm font-bold text-destructive">{t('settings.dangerHeading')}</h2>
          <p className="text-sm text-muted-foreground">{t('settings.dangerBody')}</p>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setConfirmName('');
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t('settings.delete')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.deleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.deleteDescription', { name: business.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="confirm-delete-name">{t('settings.deleteConfirmLabel')}</Label>
                <Input
                  id="confirm-delete-name"
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>
                  {t('settings.deleteCancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting || confirmName !== business.name}
                  onClick={(event) => {
                    event.preventDefault();
                    void deleteBusiness();
                  }}
                >
                  {deleting ? t('settings.deleting') : t('settings.deleteConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      ) : null}
    </div>
  );
}
