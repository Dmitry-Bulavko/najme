import { zodResolver } from '@hookform/resolvers/zod';
import {
  CITY_CODES,
  FEATURED_CITIES,
  businessSchema,
  categoriesResponseSchema,
  emailSchema,
  updateBusinessRequestSchema,
  type Business,
  type Category,
  type City,
  type UpdateBusinessRequest,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner, Button, FormField, Select, Text, TextField } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api/client';

import { BusinessImageUpload } from './business-image-upload';
import { useBusinessContext } from './business-provider';

type ProfileFormValues = {
  name: string;
  categoryId: string;
  city: string;
  description: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
};

const PROFILE_FIELDS = [
  'name',
  'categoryId',
  'city',
  'description',
  'address',
  'contactPhone',
  'contactEmail',
] as const;

function isProfileField(value: unknown): value is (typeof PROFILE_FIELDS)[number] {
  return typeof value === 'string' && (PROFILE_FIELDS as readonly string[]).includes(value);
}

function buildProfileSchema(t: (key: string) => string) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: t('profile.errors.nameRequired') })
      .max(120, { error: t('profile.errors.nameTooLong') }),
    categoryId: z
      .string()
      .min(1, { error: t('profile.errors.categoryRequired') })
      .uuid({ error: t('profile.errors.categoryRequired') }),
    city: z
      .string()
      .min(1, { error: t('profile.errors.cityRequired') })
      .refine((value): value is City => (CITY_CODES as readonly string[]).includes(value), {
        error: t('profile.errors.cityRequired'),
      }),
    description: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      if (trimmed.length > 2000) {
        ctx.addIssue({ code: 'custom', message: t('profile.errors.descriptionTooLong') });
      }
    }),
    address: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      if (trimmed.length > 300) {
        ctx.addIssue({ code: 'custom', message: t('profile.errors.addressTooLong') });
      }
    }),
    contactPhone: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      if (trimmed.length < 3 || trimmed.length > 40) {
        ctx.addIssue({ code: 'custom', message: t('profile.errors.phoneInvalid') });
      }
    }),
    contactEmail: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return;
      if (!emailSchema.safeParse(trimmed).success) {
        ctx.addIssue({ code: 'custom', message: t('profile.errors.emailInvalid') });
      }
    }),
  });
}

function toProfileFormValues(business: Business): ProfileFormValues {
  return {
    name: business.name,
    categoryId: business.categoryId,
    city: business.city,
    description: business.description ?? '',
    address: business.address ?? '',
    contactPhone: business.contactPhone ?? '',
    contactEmail: business.contactEmail ?? '',
  };
}

/** Business profile editor (no slug — web-only). STAFF is read-only. */
export function BusinessProfileForm(): ReactElement {
  const { t, i18n } = useTranslation(['business', 'common', 'errors']);
  const { business, setBusiness } = useBusinessContext();
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesNonce, setCategoriesNonce] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const locale = i18n.language;

  const formSchema = useMemo(() => buildProfileSchema((key) => t(`business:${key}`)), [t]);
  const formValues = useMemo(() => toProfileFormValues(business), [business]);

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

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    values: formValues,
    resetOptions: { keepDirtyValues: true },
  });

  async function onSubmit(values: ProfileFormValues): Promise<void> {
    if (!canEdit) return;
    setApiError(null);
    setSaved(false);
    const dirty = form.formState.dirtyFields;
    const body: UpdateBusinessRequest = {};
    if (dirty.name) body.name = values.name;
    if (dirty.categoryId) body.categoryId = values.categoryId;
    if (dirty.city) body.city = values.city as City;
    if (dirty.description) {
      body.description = values.description.trim() ? values.description.trim() : null;
    }
    if (dirty.address) {
      body.address = values.address.trim() ? values.address.trim() : null;
    }
    if (dirty.contactPhone) {
      body.contactPhone = values.contactPhone.trim() ? values.contactPhone.trim() : null;
    }
    if (dirty.contactEmail) {
      body.contactEmail = values.contactEmail.trim() ? values.contactEmail.trim() : null;
    }
    if (Object.keys(body).length === 0) {
      setSaved(true);
      return;
    }
    const parsedBody = updateBusinessRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      setApiError(t('errors:VALIDATION_FAILED'));
      return;
    }
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}`, {
        method: 'PATCH',
        body: parsedBody.data,
      });
      const updated = businessSchema.parse(raw);
      const nextValues = toProfileFormValues(updated);
      if (parsedBody.data.name !== undefined) {
        form.resetField('name', { defaultValue: nextValues.name });
      }
      if (parsedBody.data.categoryId !== undefined) {
        form.resetField('categoryId', { defaultValue: nextValues.categoryId });
      }
      if (parsedBody.data.city !== undefined) {
        form.resetField('city', { defaultValue: nextValues.city });
      }
      if (parsedBody.data.description !== undefined) {
        form.resetField('description', { defaultValue: nextValues.description });
      }
      if (parsedBody.data.address !== undefined) {
        form.resetField('address', { defaultValue: nextValues.address });
      }
      if (parsedBody.data.contactPhone !== undefined) {
        form.resetField('contactPhone', { defaultValue: nextValues.contactPhone });
      }
      if (parsedBody.data.contactEmail !== undefined) {
        form.resetField('contactEmail', { defaultValue: nextValues.contactEmail });
      }
      setBusiness((prev) => ({
        ...updated,
        logoUrl: prev.logoUrl,
        coverUrl: prev.coverUrl,
      }));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            const field = Array.isArray(path) ? path[0] : undefined;
            if (isProfileField(field)) {
              form.setError(field, { message: t('business:profile.errors.invalid') });
            }
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setApiError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    }
  }

  return (
    <View style={styles.form} testID="business-profile-form">
      <View>
        <Text variant="title">{t('business:profile.heading')}</Text>
        <Text variant="body" color="text03" style={styles.subtitle}>
          {canEdit ? t('business:profile.subtitle') : t('business:profile.readOnlySubtitle')}
        </Text>
      </View>

      <BusinessImageUpload
        businessId={business.id}
        kind="LOGO"
        currentUrl={business.logoUrl}
        frame="square"
        readOnly={!canEdit}
        onChanged={(urls) => {
          setBusiness((prev) => ({
            ...prev,
            ...(urls.logoUrl !== undefined ? { logoUrl: urls.logoUrl } : {}),
            ...(urls.coverUrl !== undefined ? { coverUrl: urls.coverUrl } : {}),
          }));
        }}
      />
      <BusinessImageUpload
        businessId={business.id}
        kind="COVER"
        currentUrl={business.coverUrl}
        frame="wide"
        readOnly={!canEdit}
        onChanged={(urls) => {
          setBusiness((prev) => ({
            ...prev,
            ...(urls.logoUrl !== undefined ? { logoUrl: urls.logoUrl } : {}),
            ...(urls.coverUrl !== undefined ? { coverUrl: urls.coverUrl } : {}),
          }));
        }}
      />

      {saved ? <Banner tone="success" message={t('business:profile.saved')} /> : null}
      {apiError ? <Banner tone="error" message={apiError} /> : null}

      {canEdit && categoriesError ? (
        <View style={styles.errorBlock}>
          <Banner tone="error" message={categoriesError} />
          <Button
            label={t('business:profile.retryCategories')}
            variant="secondary"
            onPress={() => setCategoriesNonce((n) => n + 1)}
          />
        </View>
      ) : null}

      {canEdit ? (
        <>
          <FormField
            control={form.control}
            name="name"
            label={t('business:profile.name')}
            autoComplete="organization"
            textContentType="organizationName"
          />

          <Controller
            control={form.control}
            name="categoryId"
            render={({ field, fieldState }) => (
              <Select
                label={t('business:profile.category')}
                value={field.value || null}
                options={categoryOptions}
                onChange={field.onChange}
                placeholder={t('business:profile.categoryPlaceholder')}
                disabled={!categories}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={form.control}
            name="city"
            render={({ field, fieldState }) => (
              <Select
                label={t('business:profile.city')}
                value={field.value || null}
                options={cityOptions}
                onChange={field.onChange}
                placeholder={t('business:profile.cityPlaceholder')}
                error={fieldState.error?.message}
              />
            )}
          />

          <FormField
            control={form.control}
            name="description"
            label={t('business:profile.description')}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <FormField
            control={form.control}
            name="address"
            label={t('business:profile.address')}
            autoComplete="street-address"
            textContentType="fullStreetAddress"
          />

          <FormField
            control={form.control}
            name="contactPhone"
            label={t('business:profile.phone')}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />

          <FormField
            control={form.control}
            name="contactEmail"
            label={t('business:profile.email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Button
            label={
              form.formState.isSubmitting
                ? t('business:profile.saving')
                : t('business:profile.save')
            }
            fullWidth
            loading={form.formState.isSubmitting}
            disabled={!!categoriesError && !categories}
            onPress={() => void form.handleSubmit(onSubmit)()}
            testID="profile-save"
          />
        </>
      ) : (
        <View style={styles.readOnly}>
          <TextField label={t('business:profile.name')} value={business.name} editable={false} />
          <TextField
            label={t('business:profile.category')}
            value={
              categories?.find((c) => c.id === business.categoryId)?.name ??
              t('business:profile.categoryUnavailable')
            }
            editable={false}
          />
          <TextField
            label={t('business:profile.city')}
            value={t(`common:cities.${business.city}`)}
            editable={false}
          />
          {business.description ? (
            <TextField
              label={t('business:profile.description')}
              value={business.description}
              editable={false}
              multiline
            />
          ) : null}
          {business.address ? (
            <TextField
              label={t('business:profile.address')}
              value={business.address}
              editable={false}
            />
          ) : null}
          {business.contactPhone ? (
            <TextField
              label={t('business:profile.phone')}
              value={business.contactPhone}
              editable={false}
            />
          ) : null}
          {business.contactEmail ? (
            <TextField
              label={t('business:profile.email')}
              value={business.contactEmail}
              editable={false}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
  subtitle: { marginTop: tokens.spacing.xs },
  errorBlock: { gap: tokens.spacing.md },
  readOnly: { gap: tokens.spacing.lg },
});
