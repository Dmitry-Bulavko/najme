import { tokens } from '@najme/ui-tokens';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

/** Placeholder tab navigation: Discover / Bookings / Account (issue #15; real screens land later). */
export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontFamily: tokens.typography.fontFamily },
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarLabelStyle: { fontFamily: tokens.typography.fontFamily },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.discover') }} />
      <Tabs.Screen name="bookings" options={{ title: t('tabs.bookings') }} />
      <Tabs.Screen name="account" options={{ title: t('tabs.account') }} />
    </Tabs>
  );
}
