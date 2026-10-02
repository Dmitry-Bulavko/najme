import { zodResolver } from '@hookform/resolvers/zod';
import {
  CITY_CODES,
  FEATURED_CITIES,
  businessSchema,
  categoriesResponseSchema,
  createBusinessRequestSchema,
  emailSchema,
  type Category,
  type City,
  type CreateBusinessRequest,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner, Button, FormField, Select, SwitchRow, Text } from '@/components/ui';
import { useSession } from '@/features/auth/auth-provider';
import { ApiError, apiRequest } from '@/lib/api/client';
import i18next from 'i18next';

import { writeAppMode, writeLastBusinessId } from './last-business';
import { useInvalidateMyBusinesses } from './use-my-businesses';

type CreateFormValues = {
  name: string;
  categoryId: string;
  city: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  ownerIsStaff: boolean;
};

const FORM_FIELDS = [
  'name',
  'categoryId',
  'city',
  'address',
  'contactPhone',
  'contactEmail',
  'ownerIsStaff',
] as const;

type FormFieldName = (typeof FORM_FIELDS)[number];

function isFormFieldName(value: unknown): value is FormFieldName {
  return typeof value === 'string' && (FORM_FIELDS as readonly string[]).includes(value);
}

function buildCreateBusinessFormSchema(t: (key: string) => string) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: t('create.errors.nameRequired') })
      .max(120, { error: t('create.errors.nameTooLong') }),
    categoryId: z
      .string()
      .min(1, { error: t('create.errors.categoryRequired') })
      .uuid({ error: t('create.errors.categoryRequired') }),
    city: z
      .string()
      .min(1, { error: t('create.errors.cityRequired') })
      .refine((value): value is City => (CITY_CODES as readonly string[]).includes(value), {
        error: t('create.errors.cityRequired'),
      }),
    address: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      if (trimmed.length > 300) {
        ctx.addIssue({ code: 'custom', message: t('create.errors.addressTooLong') });
      }
    }),
    contactPhone: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      if (trimmed.length < 3 || trimmed.length > 40) {
        ctx.addIssue({ code: 'custom', message: t('create.errors.phoneInvalid') });
      }
    }),
    contactEmail: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      if (!emailSchema.safeParse(trimmed).success) {
        ctx.addIssue({ code: 'custom', message: t('create.errors.emailInvalid') });
      }
    }),
    ownerIsStaff: z.boolean(),
  });
}

/** Create-business form: name, category, city, optional contacts, ownerIsStaff. */
export function CreateBusinessForm(): ReactElement {
  const { t } = useTranslation(['business', 'common', 'errors']);
  const router = useRouter();
  const session = useSession();
  const invalidateMyBusinesses = useInvalidateMyBusinesses();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesNonce, setCategoriesNonce] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const locale = i18next.language;
  const formSchema = useMemo(
    () => buildCreateBusinessFormSchema((key) => t(`business:${key}`)),
    [t],
  );

  useEffect(() => {
    if (session.state === 'anonymous') {
      router.replace('/(auth)/sign-in');
    }
  }, [router, session.state]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await apiRequest<unknown>(`/categories?locale=${encodeURIComponent(locale)}`);
        const parsed = categoriesResponseSchema.parse(raw);
        if (!cancelled) {
          setCategories(parsed);
          setCategoriesError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
          setCategoriesError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
          setCategories(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, t, categoriesNonce]);

  const cityOptions = useMemo(() => {
    const featured = FEATURED_CITIES as readonly City[];
    const rest = CITY_CODES.filter((c) => !featured.includes(c));
    return [...featured, ...rest].map((code) => ({
      value: code,
      label: t(`common:cities.${code}`),
    }));
  }, [t]);

  const categoryOptions = useMemo(
    () => (categories ?? []).map((cat) => ({ value: cat.id, label: cat.name })),
    [categories],
  );

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      city: '',
      address: '',
      contactPhone: '',
      contactEmail: '',
      ownerIsStaff: false,
    },
  });

  async function onSubmit(values: CreateFormValues): Promise<void> {
    setApiError(null);
    setSaved(false);
    const body: CreateBusinessRequest = {
      name: values.name,
      categoryId: values.categoryId,
      city: values.city as City,
      ...(values.ownerIsStaff ? { ownerIsStaff: true } : {}),
      ...(values.address.trim() ? { address: values.address.trim() } : {}),
      ...(values.contactPhone.trim() ? { contactPhone: values.contactPhone.trim() } : {}),
      ...(values.contactEmail.trim() ? { contactEmail: values.contactEmail.trim() } : {}),
    };
    const parsedBody = createBusinessRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      setApiError(t('errors:VALIDATION_FAILED'));
      return;
    }
    try {
      const raw = await apiRequest<unknown>('/businesses', {
        method: 'POST',
        body: parsedBody.data,
      });
      const created = businessSchema.parse(raw);
      await writeLastBusinessId(created.id);
      await writeAppMode('business');
      await invalidateMyBusinesses();
      setSaved(true);
      router.replace(`/(business)/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            const field = Array.isArray(path) ? path[0] : undefined;
            if (isFormFieldName(field)) {
              form.setError(field, { message: t('business:create.errors.invalid') });
            }
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setApiError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    }
  }

  if (session.state === 'loading' || session.state === 'anonymous') {
    return <View style={styles.form} />;
  }

  return (
    <View style={styles.form} testID="create-business-form">
      <View>
        <Text variant="title">{t('business:create.heading')}</Text>
        <Text variant="body" color="text03" style={styles.subtitle}>
          {t('business:create.subtitle')}
        </Text>
      </View>

      {saved ? <Banner tone="success" message={t('business:create.successToast')} /> : null}
      {apiError ? <Banner tone="error" message={apiError} /> : null}

      {categoriesError ? (
        <View style={styles.errorBlock}>
          <Banner tone="error" message={categoriesError} />
          <Button
            label={t('business:create.retryCategories')}
            variant="secondary"
            onPress={() => setCategoriesNonce((n) => n + 1)}
          />
        </View>
      ) : null}

      <FormField
        control={form.control}
        name="name"
        label={t('business:create.name')}
        autoComplete="organization"
        textContentType="organizationName"
      />

      <Controller
        control={form.control}
        name="categoryId"
        render={({ field, fieldState }) => (
          <Select
            label={t('business:create.category')}
            value={field.value || null}
            options={categoryOptions}
            onChange={field.onChange}
            placeholder={t('business:create.categoryPlaceholder')}
            disabled={!categories}
            error={fieldState.error?.message}
            testID="create-category"
          />
        )}
      />

      <Controller
        control={form.control}
        name="city"
        render={({ field, fieldState }) => (
          <Select
            label={t('business:create.city')}
            value={field.value || null}
            options={cityOptions}
            onChange={field.onChange}
            placeholder={t('business:create.cityPlaceholder')}
            error={fieldState.error?.message}
            testID="create-city"
          />
        )}
      />

      <FormField
        control={form.control}
        name="address"
        label={t('business:create.address')}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
      />

      <FormField
        control={form.control}
        name="contactPhone"
        label={t('business:create.phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <FormField
        control={form.control}
        name="contactEmail"
        label={t('business:create.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <Controller
        control={form.control}
        name="ownerIsStaff"
        render={({ field }) => (
          <SwitchRow
            label={t('business:create.ownerIsStaff')}
            description={t('business:create.ownerIsStaffHint')}
            value={field.value}
            onValueChange={field.onChange}
            testID="create-owner-is-staff"
          />
        )}
      />

      <Button
        label={
          form.formState.isSubmitting
            ? t('business:create.submitting')
            : t('business:create.submit')
        }
        fullWidth
        loading={form.formState.isSubmitting}
        disabled={!categories}
        onPress={() => void form.handleSubmit(onSubmit)()}
        testID="create-business-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
  subtitle: { marginTop: tokens.spacing.xs },
  errorBlock: { gap: tokens.spacing.md },
});
