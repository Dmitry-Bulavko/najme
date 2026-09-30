import { zodResolver } from '@hookform/resolvers/zod';
import { displayNameSchema, meSchema } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useMemo, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner, Button, FormField } from '@/components/ui';
import { useSession } from '@/features/auth/auth-provider';
import { ApiError, apiRequest } from '@/lib/api/client';

type ProfileFormValues = { displayName: string };

/** Display-name editor for the signed-in account (PATCH /me). */
export function EditProfileForm(): ReactElement {
  const { t } = useTranslation(['account', 'errors']);
  const session = useSession();
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const profileSchema = useMemo(() => z.object({ displayName: displayNameSchema }), []);

  const defaultName = session.state === 'authenticated' ? (session.me.displayName ?? '') : '';

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: defaultName },
  });

  async function onSubmit(data: ProfileFormValues) {
    setApiError(null);
    setSaved(false);
    try {
      const raw = await apiRequest<unknown>('/me', {
        method: 'PATCH',
        body: { displayName: data.displayName },
      });
      const parsed = meSchema.safeParse(raw);
      if (!parsed.success) {
        setApiError(t('errors:HTTP_ERROR'));
        return;
      }
      if (session.state === 'authenticated') {
        session.updateMe(parsed.data);
      }
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(t(`errors:${error.code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      } else {
        setApiError(t('errors:HTTP_ERROR'));
      }
    }
  }

  return (
    <View style={styles.form}>
      {saved ? <Banner tone="success" message={t('account:profileSection.saved')} /> : null}
      {apiError ? <Banner tone="error" message={apiError} /> : null}

      <FormField
        control={control}
        name="displayName"
        label={t('account:profileSection.displayNameLabel')}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />

      <Button
        label={t('account:profileSection.save')}
        fullWidth
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
});
