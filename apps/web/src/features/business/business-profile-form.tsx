'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CITY_CODES,
  FEATURED_CITIES,
  RESERVED_BUSINESS_SLUGS,
  businessSchema,
  categoriesResponseSchema,
  emailSchema,
  updateBusinessRequestSchema,
  type Business,
  type Category,
  type City,
  type UpdateBusinessRequest,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import { useBusinessContext } from './business-shell';
import { ImageUpload } from '@/features/uploads/image-upload';

type ProfileFormValues = {
  name: string;
  categoryId: string;
  city: string;
  slug: string;
  description: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
};

const PROFILE_FIELDS = [
  'name',
  'categoryId',
  'city',
  'slug',
  'description',
  'address',
  'contactPhone',
  'contactEmail',
] as const;

function isProfileField(value: unknown): value is (typeof PROFILE_FIELDS)[number] {
  return typeof value === 'string' && (PROFILE_FIELDS as readonly string[]).includes(value);
}

function buildProfileSchema(
  t: ReturnType<typeof useTranslations<'business'>>,
  options: { validateSlug: boolean },
) {
  const slugSchema = options.validateSlug
    ? z
        .string()
        .trim()
        .min(3, { error: t('profile.errors.slugInvalid') })
        .max(60, { error: t('profile.errors.slugInvalid') })
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: t('profile.errors.slugInvalid') })
        .refine((slug) => !RESERVED_BUSINESS_SLUGS.has(slug), {
          error: t('profile.errors.slugReserved'),
        })
    : z.string();

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
    slug: slugSchema,
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

function slugEditable(status: Business['status']): boolean {
  return status === 'PENDING_APPROVAL' || status === 'REJECTED';
}

/** Business profile editor: public fields, slug (until approved), logo and cover. */
export function BusinessProfileForm() {
  const t = useTranslations('business');
  const tCities = useTranslations('cities');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const { business, setBusiness } = useBusinessContext();
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const canEditSlug = canEdit && slugEditable(business.status);
  const categoryFieldId = useId();
  const cityFieldId = useId();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesNonce, setCategoriesNonce] = useState(0);

  const formSchema = useMemo(
    () => buildProfileSchema(t, { validateSlug: canEditSlug }),
    [canEditSlug, t],
  );

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
          setCategoriesError(errorMessage(tErrors, code));
          setCategories(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, tErrors, categoriesNonce]);

  const cityOptions = useMemo(() => {
    const featured = FEATURED_CITIES as readonly City[];
    const rest = CITY_CODES.filter((c) => !featured.includes(c));
    return [...featured, ...rest];
  }, []);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    values: {
      name: business.name,
      categoryId: business.categoryId,
      city: business.city,
      slug: business.slug,
      description: business.description ?? '',
      address: business.address ?? '',
      contactPhone: business.contactPhone ?? '',
      contactEmail: business.contactEmail ?? '',
    },
    // Keep in-progress edits when categories load (setState re-render) or shell context updates.
    resetOptions: { keepDirtyValues: true },
  });

  async function onSubmit(values: ProfileFormValues): Promise<void> {
    if (!canEdit) return;
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
    if (dirty.slug && canEditSlug) {
      body.slug = values.slug;
    }
    if (Object.keys(body).length === 0) {
      toast.success(t('profile.saved'));
      return;
    }
    const parsedBody = updateBusinessRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      toast.error(errorMessage(tErrors, 'VALIDATION_FAILED'));
      return;
    }
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}`, {
        method: 'PATCH',
        body: parsedBody.data,
      });
      setBusiness(businessSchema.parse(raw));
      toast.success(t('profile.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLUG_TAKEN') {
        form.setError('slug', { message: errorMessage(tErrors, 'SLUG_TAKEN') });
      } else if (err instanceof ApiError && err.code === 'SLUG_LOCKED') {
        form.setError('slug', { message: errorMessage(tErrors, 'SLUG_LOCKED') });
      } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            const field = Array.isArray(path) ? path[0] : undefined;
            if (isProfileField(field)) {
              form.setError(field, { message: t('profile.errors.invalid') });
            }
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    }
  }

  const categoryError = form.formState.errors.categoryId?.message;
  const cityError = form.formState.errors.city?.message;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-title font-bold text-foreground">{t('profile.heading')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit ? t('profile.subtitle') : t('profile.readOnlySubtitle')}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <ImageUpload
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
        <ImageUpload
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
      </div>

      {canEdit && categoriesError ? (
        <div className="rounded-md border border-border p-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {categoriesError}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            type="button"
            onClick={() => setCategoriesNonce((n) => n + 1)}
          >
            {t('profile.retryCategories')}
          </Button>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField label={t('profile.name')} error={form.formState.errors.name?.message}>
          <Input {...form.register('name')} disabled={!canEdit} autoComplete="organization" />
        </FormField>

        <div className="grid gap-2">
          <Label htmlFor={categoryFieldId}>{t('profile.category')}</Label>
          {canEdit ? (
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={!categories}
                >
                  <SelectTrigger
                    id={categoryFieldId}
                    aria-invalid={categoryError ? true : undefined}
                    aria-describedby={categoryError ? `${categoryFieldId}-error` : undefined}
                  >
                    <SelectValue placeholder={t('profile.categoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <Input
              id={categoryFieldId}
              value={
                categories?.find((c) => c.id === business.categoryId)?.name ??
                t('profile.categoryUnavailable')
              }
              disabled
              readOnly
            />
          )}
          {categoryError ? (
            <p
              id={`${categoryFieldId}-error`}
              role="alert"
              className="text-xs font-medium text-destructive"
            >
              {categoryError}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={cityFieldId}>{t('profile.city')}</Label>
          {canEdit ? (
            <Controller
              control={form.control}
              name="city"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={cityFieldId}
                    aria-invalid={cityError ? true : undefined}
                    aria-describedby={cityError ? `${cityFieldId}-error` : undefined}
                  >
                    <SelectValue placeholder={t('profile.cityPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.map((code) => (
                      <SelectItem key={code} value={code}>
                        {tCities(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <Input id={cityFieldId} value={tCities(business.city)} disabled readOnly />
          )}
          {cityError ? (
            <p
              id={`${cityFieldId}-error`}
              role="alert"
              className="text-xs font-medium text-destructive"
            >
              {cityError}
            </p>
          ) : null}
        </div>

        <FormField
          label={t('profile.slug')}
          error={form.formState.errors.slug?.message}
          description={
            canEditSlug ? t('profile.slugHint') : canEdit ? t('profile.slugLockedHint') : undefined
          }
        >
          <Input {...form.register('slug')} disabled={!canEditSlug} autoComplete="off" />
        </FormField>

        <FormField
          label={t('profile.description')}
          error={form.formState.errors.description?.message}
        >
          <Textarea {...form.register('description')} disabled={!canEdit} rows={4} />
        </FormField>

        <FormField label={t('profile.address')} error={form.formState.errors.address?.message}>
          <Input {...form.register('address')} disabled={!canEdit} autoComplete="street-address" />
        </FormField>

        <FormField label={t('profile.phone')} error={form.formState.errors.contactPhone?.message}>
          <Input {...form.register('contactPhone')} disabled={!canEdit} autoComplete="tel" />
        </FormField>

        <FormField label={t('profile.email')} error={form.formState.errors.contactEmail?.message}>
          <Input
            {...form.register('contactEmail')}
            disabled={!canEdit}
            type="email"
            autoComplete="email"
          />
        </FormField>

        {canEdit ? (
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || (!!categoriesError && !categories)}
          >
            {form.formState.isSubmitting ? t('profile.saving') : t('profile.save')}
          </Button>
        ) : null}
      </form>

      {canEdit && !categories && !categoriesError ? (
        <div className="space-y-2" aria-busy="true" aria-label={t('profile.loadingCategories')}>
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      ) : null}
    </div>
  );
}
