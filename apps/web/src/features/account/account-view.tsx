'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  changePasswordRequestSchema,
  displayNameSchema,
  meSchema,
  passwordSchema,
  type Me,
} from '@najme/contracts';
import { isLocale, LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@najme/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/session-context';
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from '@/i18n/routing';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import { changePasswordWithLock } from './change-password';
import { getInitials } from './get-initials';

function setLocaleCookie(localeValue: string): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${localeValue}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type LanguageFormValues = {
  locale: Locale;
};

/**
 * Protected account / settings page: profile header, display name, language, password, sign out.
 */
export function AccountView() {
  const t = useTranslations('account');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.state === 'anonymous') {
      router.replace(`/${locale}/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [locale, pathname, router, session.state]);

  if (session.state === 'loading' || session.state === 'anonymous') {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mt-10 w-full max-w-lg space-y-6" aria-busy="true">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="mx-auto mt-10 mb-16 w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-title font-bold">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>

        <ProfileHeaderCard me={session.me} />
        <ProfileNameForm me={session.me} />
        <LanguageForm me={session.me} />
        {session.me.hasPassword ? (
          <ChangePasswordForm onSuccess={session.updateMe} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('passwordSection.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('passwordSection.googleOnly')}</p>
            </CardContent>
          </Card>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={async () => {
            await session.signOut();
            router.replace(`/${locale}`);
          }}
        >
          {t('signOut')}
        </Button>
      </div>
    </div>
  );
}

function ProfileHeaderCard({ me }: { me: Me }) {
  const t = useTranslations('account');
  const tErrors = useTranslations('errors');
  const [busy, setBusy] = useState(false);
  const initials = getInitials(me.displayName, me.email);
  const name = me.displayName ?? me.email;

  async function onResend() {
    setBusy(true);
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST', body: {} });
      toast.success(t('resent'));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(errorMessage(tErrors, error.code));
      } else {
        toast.error(tErrors('HTTP_ERROR'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-2">
        <Avatar className="size-14">
          {me.avatarUrl ? <AvatarImage src={me.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-subtitle font-bold">{name}</p>
          {me.displayName ? (
            <p className="truncate text-sm text-muted-foreground">{me.email}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {me.emailVerified ? (
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {t('verified')}
              </span>
            ) : (
              <>
                <span className="rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-text01">
                  {t('unverified')}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={busy}
                  onClick={() => void onResend()}
                >
                  {busy ? t('resending') : t('resend')}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileNameForm({ me }: { me: Me }) {
  const t = useTranslations('account');
  const tErrors = useTranslations('errors');
  const { updateMe } = useSession();

  const profileSchema = useMemo(() => z.object({ displayName: displayNameSchema }), []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ displayName: string }>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: me.displayName ?? '' },
  });

  async function onSubmit(data: { displayName: string }) {
    try {
      const raw = await apiRequest<unknown>('/me', {
        method: 'PATCH',
        body: { displayName: data.displayName },
      });
      const parsed = meSchema.safeParse(raw);
      if (!parsed.success) {
        toast.error(tErrors('HTTP_ERROR'));
        return;
      }
      updateMe(parsed.data);
      toast.success(t('profileSection.saved'));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(errorMessage(tErrors, error.code));
      } else {
        toast.error(tErrors('HTTP_ERROR'));
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profileSection.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <FormField
            label={t('profileSection.displayNameLabel')}
            error={errors.displayName?.message}
          >
            <Input {...register('displayName')} autoComplete="name" />
          </FormField>
          <Button type="submit" size="md" loading={isSubmitting}>
            {t('profileSection.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LanguageForm({ me }: { me: Me }) {
  const t = useTranslations('account');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { updateMe } = useSession();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LanguageFormValues>({
    defaultValues: { locale: isLocale(me.locale) ? me.locale : (locale as Locale) },
  });

  async function onSubmit(data: LanguageFormValues) {
    if (!isLocale(data.locale)) {
      return;
    }
    try {
      const raw = await apiRequest<unknown>('/me', {
        method: 'PATCH',
        body: { locale: data.locale },
      });
      const parsed = meSchema.safeParse(raw);
      if (!parsed.success) {
        toast.error(tErrors('HTTP_ERROR'));
        return;
      }
      updateMe(parsed.data);
      toast.success(t('languageSection.saved'));

      setLocaleCookie(data.locale);
      if (data.locale !== locale) {
        const segments = pathname.split('/');
        segments[1] = data.locale;
        router.replace(segments.join('/') || `/${data.locale}`);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(errorMessage(tErrors, error.code));
      } else {
        toast.error(tErrors('HTTP_ERROR'));
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('languageSection.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="account-locale">{t('languageSection.label')}</Label>
            <select
              id="account-locale"
              {...register('locale')}
              className="flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {SUPPORTED_LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_META[code].label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="md" loading={isSubmitting}>
            {t('languageSection.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordForm({ onSuccess }: { onSuccess: (me: Me) => void }) {
  const t = useTranslations('account');
  const tErrors = useTranslations('errors');

  const passwordFormSchema = useMemo(
    () =>
      changePasswordRequestSchema
        .extend({
          confirmPassword: z.string().min(1),
          newPassword: passwordSchema,
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          path: ['confirmPassword'],
          message: t('passwordSection.mismatch'),
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit(data: PasswordFormValues) {
    try {
      const session = await changePasswordWithLock({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      onSuccess(session.user);
      reset();
      toast.success(t('passwordSection.saved'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setError('currentPassword', {
          message: tErrors('INVALID_CREDENTIALS'),
        });
        return;
      }
      if (error instanceof ApiError) {
        toast.error(errorMessage(tErrors, error.code));
      } else {
        toast.error(tErrors('HTTP_ERROR'));
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('passwordSection.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <FormField
            label={t('passwordSection.currentLabel')}
            error={errors.currentPassword?.message}
          >
            <Input
              {...register('currentPassword')}
              type="password"
              autoComplete="current-password"
            />
          </FormField>
          <FormField label={t('passwordSection.newLabel')} error={errors.newPassword?.message}>
            <Input {...register('newPassword')} type="password" autoComplete="new-password" />
          </FormField>
          <FormField
            label={t('passwordSection.confirmLabel')}
            error={errors.confirmPassword?.message}
          >
            <Input {...register('confirmPassword')} type="password" autoComplete="new-password" />
          </FormField>
          <Button type="submit" size="md" loading={isSubmitting}>
            {t('passwordSection.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
