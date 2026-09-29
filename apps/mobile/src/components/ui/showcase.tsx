import { tokens } from '@najme/ui-tokens';
import type { ReactElement, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Banner,
  Button,
  Card,
  Divider,
  FormField,
  ListGroup,
  ListItem,
  Screen,
  Text,
  TextField,
} from './index';

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <View style={styles.section}>
      <Text variant="title">{title}</Text>
      {children}
    </View>
  );
}

/** Development-only gallery rendering every UI kit component (reachable from Account). */
export function UiShowcase(): ReactElement {
  const { t } = useTranslation('mobile');
  const { control } = useForm<{ name: string }>({ defaultValues: { name: '' } });

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Section title={t('showcase.typography')}>
        <Text variant="heading">{t('showcase.heading')}</Text>
        <Text variant="title">{t('showcase.titleSample')}</Text>
        <Text variant="body">{t('showcase.body')}</Text>
        <Text variant="caption" color="text03">
          {t('showcase.caption')}
        </Text>
      </Section>

      <Section title={t('showcase.buttons')}>
        <View style={styles.row}>
          <Button label={t('showcase.primary')} />
          <Button label={t('showcase.secondary')} variant="secondary" />
          <Button label={t('showcase.outline')} variant="outline" />
          <Button label={t('showcase.ghost')} variant="ghost" />
          <Button label={t('showcase.destructive')} variant="destructive" />
        </View>
        <View style={styles.row}>
          <Button label={t('showcase.small')} size="sm" />
          <Button label={t('showcase.large')} size="lg" />
          <Button label={t('showcase.loading')} loading />
          <Button label={t('showcase.disabled')} disabled />
        </View>
      </Section>

      <Section title={t('showcase.fields')}>
        <TextField
          label={t('showcase.emailLabel')}
          placeholder={t('showcase.emailPlaceholder')}
          helperText={t('showcase.emailHelper')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField label={t('showcase.passwordLabel')} secureTextEntry defaultValue="secret" />
        <TextField label={t('showcase.errorLabel')} error={t('showcase.errorMessage')} />
        <FormField control={control} name="name" label={t('showcase.formName')} />
      </Section>

      <Section title={t('showcase.banners')}>
        <Banner tone="info" message={t('showcase.info')} />
        <Banner tone="success" message={t('showcase.success')} />
        <Banner tone="warning" message={t('showcase.warning')} />
        <Banner tone="error" message={t('showcase.error')} />
      </Section>

      <Section title={t('showcase.avatars')}>
        <View style={styles.row}>
          <Avatar name="Ana Petrović" size={40} />
          <Avatar name="Mehmet" size={56} />
          <Avatar name="Ivan Ivanov" uri="https://invalid.example/none.png" size={72} />
        </View>
      </Section>

      <Section title={t('showcase.cards')}>
        <Card>
          <Text variant="body">{t('showcase.cardBody')}</Text>
          <Divider />
          <Text variant="caption" color="text03">
            {t('showcase.caption')}
          </Text>
        </Card>
        <ListGroup>
          <ListItem
            icon="notifications-outline"
            title={t('showcase.listNotifications')}
            onPress={() => undefined}
          />
          <ListItem
            icon="lock-closed-outline"
            title={t('showcase.listPrivacy')}
            subtitle={t('showcase.caption')}
            onPress={() => undefined}
          />
          <ListItem
            icon="help-circle-outline"
            title={t('showcase.listHelp')}
            selected
            onPress={() => undefined}
          />
        </ListGroup>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing.md },
});
