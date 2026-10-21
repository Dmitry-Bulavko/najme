'use client';

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
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useSession } from '@/features/auth/session-context';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import { writeLastBusinessId } from './last-business';
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

/**
 * Form schema derived from `createBusinessRequestSchema`: required fields get localized
 * messages (no enum dumps); optional strings stay as '' in the form and map to omitted body
 * fields on submit, with contract-aligned length/format checks when non-empty.
 */
function buildCreateBusinessFormSchema(t: ReturnType<typeof useTranslations<'business'>>) {
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

/**
 * Create-business form: name, category, city (featured first), optional contacts, ownerIsStaff.
 */
export function CreateBusinessForm() {
  const t = useTranslations('business');
  const tCities = useTranslations('cities');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const session = useSession();
  const invalidateMyBusinesses = useInvalidateMyBusinesses();
  const categoryFieldId = useId();
  const cityFieldId = useId();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoriesNonce, setCategoriesNonce] = useState(0);

  const formSchema = useMemo(() => buildCreateBusinessFormSchema(t), [t]);

  useEffect(() => {
    if (session.state === 'anonymous') {
      router.replace(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/business/new`)}`);
    }
  }, [locale, router, session.state]);

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
      toast.error(errorMessage(tErrors, 'VALIDATION_FAILED'));
      return;
    }
    try {
      const raw = await apiRequest<unknown>('/businesses', {
        method: 'POST',
        body: parsedBody.data,
      });
      const created = businessSchema.parse(raw);
      writeLastBusinessId(created.id);
      await invalidateMyBusinesses();
      toast.success(t('create.successToast'));
      router.push(`/${locale}/business/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            const field = Array.isArray(path) ? path[0] : undefined;
            if (isFormFieldName(field)) {
              form.setError(field, { message: t('create.errors.invalid') });
            }
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    }
  }

  if (session.state === 'loading' || session.state === 'anonymous') {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-10" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const categoryError = form.formState.errors.categoryId?.message;
  const cityError = form.formState.errors.city?.message;

  return (
    <div className="mx-auto w-full max-w-lg px-4 sm:px-6">
      <div className="mt-10 mb-16 space-y-6">
        <div>
          <h1 className="text-title font-bold text-foreground">{t('create.heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('create.subtitle')}</p>
        </div>

        {categoriesError ? (
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
              {t('create.retryCategories')}
            </Button>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField label={t('create.name')} error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} autoComplete="organization" />
          </FormField>

          <div className="grid gap-2">
            <Label htmlFor={categoryFieldId}>{t('create.category')}</Label>
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
                    <SelectValue placeholder={t('create.categoryPlaceholder')} />
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
            <Label htmlFor={cityFieldId}>{t('create.city')}</Label>
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
                    <SelectValue placeholder={t('create.cityPlaceholder')} />
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

          <FormField label={t('create.address')} error={form.formState.errors.address?.message}>
            <Input {...form.register('address')} autoComplete="street-address" />
          </FormField>

          <FormField label={t('create.phone')} error={form.formState.errors.contactPhone?.message}>
            <Input {...form.register('contactPhone')} autoComplete="tel" />
          </FormField>

          <FormField label={t('create.email')} error={form.formState.errors.contactEmail?.message}>
            <Input {...form.register('contactEmail')} type="email" autoComplete="email" />
          </FormField>

          <div className="flex items-start gap-3 rounded-md border border-border p-3">
            <Controller
              control={form.control}
              name="ownerIsStaff"
              render={({ field }) => (
                <Checkbox
                  id="ownerIsStaff"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <div className="grid gap-1">
              <Label htmlFor="ownerIsStaff">{t('create.ownerIsStaff')}</Label>
              <p className="text-xs text-muted-foreground">{t('create.ownerIsStaffHint')}</p>
            </div>
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting || !categories}>
            {form.formState.isSubmitting ? t('create.submitting') : t('create.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
