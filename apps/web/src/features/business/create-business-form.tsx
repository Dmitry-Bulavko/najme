'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CITY_CODES,
  FEATURED_CITIES,
  businessSchema,
  categoriesResponseSchema,
  createBusinessRequestSchema,
  type Category,
  type City,
  type CreateBusinessRequest,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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

/** Form-local schema: required selects as non-empty strings before mapping to the contract. */
const createBusinessFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: z.string().uuid(),
  city: createBusinessRequestSchema.shape.city,
  address: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string(),
  ownerIsStaff: z.boolean(),
});

type CreateFormValues = z.infer<typeof createBusinessFormSchema>;

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
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

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
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, tErrors]);

  const cityOptions = useMemo(() => {
    const featured = FEATURED_CITIES as readonly City[];
    const rest = CITY_CODES.filter((c) => !featured.includes(c));
    return [...featured, ...rest];
  }, []);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createBusinessFormSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      city: undefined as unknown as City,
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
      city: values.city,
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
      toast.success(t('create.successToast'));
      router.push(`/${locale}/business/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        for (const [field, message] of Object.entries(err.details)) {
          if (typeof message === 'string' && field in values) {
            form.setError(field as keyof CreateFormValues, { message });
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

  return (
    <div className="mx-auto w-full max-w-lg px-4 sm:px-6">
      <div className="mt-10 mb-16 space-y-6">
        <div>
          <h1 className="text-title font-bold text-foreground">{t('create.heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('create.subtitle')}</p>
        </div>

        {categoriesError ? (
          <p className="text-sm text-destructive" role="alert">
            {categoriesError}
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FormField label={t('create.name')} error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} autoComplete="organization" />
          </FormField>

          <FormField label={t('create.category')} error={form.formState.errors.categoryId?.message}>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={!categories}
                >
                  <SelectTrigger aria-label={t('create.category')}>
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
          </FormField>

          <FormField label={t('create.city')} error={form.formState.errors.city?.message}>
            <Controller
              control={form.control}
              name="city"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger aria-label={t('create.city')}>
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
          </FormField>

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
