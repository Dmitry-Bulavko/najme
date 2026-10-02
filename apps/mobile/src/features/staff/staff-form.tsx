import { zodResolver } from '@hookform/resolvers/zod';
import {
  createStaffMemberRequestSchema,
  staffMemberSchema,
  updateStaffMemberRequestSchema,
  type StaffMember,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner, Button, FormField, Screen, SwitchRow, Text } from '@/components/ui';
import { BusinessImageUpload } from '@/features/business/business-image-upload';
import { useBusinessContext } from '@/features/business/business-provider';
import { businessHref } from '@/features/business/last-business';
import { ApiError, apiRequest } from '@/lib/api/client';

type StaffFormValues = {
  displayName: string;
  active: boolean;
};

type StaffFormProps = {
  mode: 'create' | 'edit';
  staffId?: string;
};

/** Create or edit a staff member. Photo upload is available after create (needs staffId). */
export function StaffForm({ mode, staffId }: StaffFormProps): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
  const router = useRouter();
  const { business } = useBusinessContext();
  const canEdit = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const listHref = businessHref(business.id, '/staff');

  const [member, setMember] = useState<StaffMember | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [loadNonce, setLoadNonce] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const formSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .trim()
          .min(1, { error: t('business:staff.errors.nameRequired') })
          .max(120, { error: t('business:staff.errors.nameTooLong') }),
        active: z.boolean(),
      }),
    [t],
  );

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: '', active: true },
  });

  const reload = useCallback(() => {
    setLoadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !staffId) {
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff/${staffId}`);
        const parsed = staffMemberSchema.parse(raw);
        if (cancelled) return;
        setMember(parsed);
        form.reset({ displayName: parsed.displayName, active: parsed.active });
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
        setLoadError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // form.reset is stable; listing `form` retriggers load every render under React 19.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [business.id, mode, staffId, t, loadNonce]);

  async function onSubmit(values: StaffFormValues): Promise<void> {
    if (!canEdit) return;
    setApiError(null);
    setSaved(false);
    try {
      if (mode === 'create') {
        const body = createStaffMemberRequestSchema.parse({
          displayName: values.displayName.trim(),
          active: values.active,
        });
        const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff`, {
          method: 'POST',
          body,
        });
        const created = staffMemberSchema.parse(raw);
        setSaved(true);
        router.replace(businessHref(business.id, `/staff/${created.id}`));
        return;
      }
      if (!staffId) return;
      const body = updateStaffMemberRequestSchema.parse({
        displayName: values.displayName.trim(),
        active: values.active,
      });
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff/${staffId}`, {
        method: 'PATCH',
        body,
      });
      const updated = staffMemberSchema.parse(raw);
      setMember(updated);
      form.reset({ displayName: updated.displayName, active: updated.active });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.details) {
        const issues = err.details.issues;
        if (Array.isArray(issues)) {
          for (const issue of issues) {
            if (!issue || typeof issue !== 'object') continue;
            const path = 'path' in issue ? issue.path : undefined;
            const field = Array.isArray(path) ? path[0] : undefined;
            if (field === 'displayName' || field === 'active') {
              form.setError(field, { message: t('business:staff.errors.invalid') });
            }
          }
        }
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setApiError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    }
  }

  if (!canEdit && mode === 'create') {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <View style={styles.root}>
          <Banner tone="error" message={t('business:staff.forbidden')} />
          <Button
            label={t('business:staff.backToList')}
            variant="secondary"
            onPress={() => router.replace(listHref)}
          />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <View
          style={styles.centered}
          accessibilityLabel={t('business:staff.loading')}
          accessibilityState={{ busy: true }}
        >
          <ActivityIndicator color={tokens.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <View style={styles.root}>
          <Banner tone="error" message={loadError} />
          <Button label={t('business:staff.retry')} variant="secondary" onPress={reload} />
          <Button
            label={t('business:staff.backToList')}
            variant="secondary"
            onPress={() => router.replace(listHref)}
          />
        </View>
      </Screen>
    );
  }

  const readOnly = !canEdit;

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.headerText}>
          <Text variant="title">
            {mode === 'create'
              ? t('business:staff.createHeading')
              : t('business:staff.editHeading')}
          </Text>
          <Text variant="caption" color="text03">
            {readOnly ? t('business:staff.readOnlySubtitle') : t('business:staff.formSubtitle')}
          </Text>
        </View>

        {saved ? (
          <Banner
            tone="success"
            message={
              mode === 'create' ? t('business:staff.createdToast') : t('business:staff.savedToast')
            }
          />
        ) : null}
        {apiError ? <Banner tone="error" message={apiError} /> : null}

        {mode === 'edit' && staffId ? (
          <BusinessImageUpload
            businessId={business.id}
            kind="STAFF_PHOTO"
            staffId={staffId}
            currentUrl={member?.photoUrl ?? null}
            frame="square"
            readOnly={readOnly}
            onChanged={({ photoUrl }) => {
              setMember((prev) => (prev ? { ...prev, photoUrl: photoUrl ?? null } : prev));
            }}
          />
        ) : null}

        {mode === 'create' ? (
          <Text variant="caption" color="text03">
            {t('business:staff.photoAfterCreate')}
          </Text>
        ) : null}

        <FormField
          control={form.control}
          name="displayName"
          label={t('business:staff.name')}
          editable={!readOnly && !form.formState.isSubmitting}
          autoComplete="off"
          testID="staff-display-name"
        />

        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <SwitchRow
              label={t('business:staff.activeToggle')}
              value={field.value}
              onValueChange={field.onChange}
              disabled={readOnly || form.formState.isSubmitting}
              testID="staff-active"
            />
          )}
        />

        <View style={styles.actions}>
          {!readOnly ? (
            <Button
              label={
                mode === 'create' ? t('business:staff.createSubmit') : t('business:staff.save')
              }
              loading={form.formState.isSubmitting}
              onPress={form.handleSubmit(onSubmit)}
              testID="staff-submit"
            />
          ) : null}
          <Button
            label={t('business:staff.backToList')}
            variant="secondary"
            onPress={() => router.replace(listHref)}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.lg, padding: tokens.spacing.lg },
  headerText: { gap: tokens.spacing.xs },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  actions: { gap: tokens.spacing.sm },
});
