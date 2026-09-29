import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';

import { fontFamilies } from '@/components/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  }
  return TabIcon;
}

/**
 * Tab shell: Discover / Bookings / Account with Ionicons, token tint colours, localized titles and
 * one shared header style so every screen looks the same.
 */
export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerShadowVisible: false,
        headerTintColor: tokens.colors.text01,
        headerTitleStyle: { fontFamily: fontFamilies.extrabold, color: tokens.colors.text01 },
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.text03,
        tabBarLabelStyle: { fontFamily: fontFamilies.bold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: tokens.colors.base01,
          borderTopColor: tokens.colors.base04,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.discover'), tabBarIcon: tabIcon('compass', 'compass-outline') }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: t('tabs.bookings'), tabBarIcon: tabIcon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('tabs.account'), tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}
