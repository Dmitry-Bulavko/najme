import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fontFamilies,
  TAB_BAR_BASE_HEIGHT,
  TAB_LABEL_FONT_SIZE,
  TAB_LABEL_LINE_HEIGHT,
} from '@/components/ui/theme';

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
 * one shared header style so every screen looks the same. Tab bar height includes the bottom safe
 * area and an explicit label line-height so long labels (`ru`/`me`) are not clipped (#55).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.colors.background },
        headerShadowVisible: false,
        headerTintColor: tokens.colors.text01,
        headerTitleStyle: { fontFamily: fontFamilies.extrabold, color: tokens.colors.text01 },
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.text03,
        tabBarLabelStyle: {
          fontFamily: fontFamilies.bold,
          fontSize: TAB_LABEL_FONT_SIZE,
          lineHeight: TAB_LABEL_LINE_HEIGHT,
        },
        tabBarStyle: {
          backgroundColor: tokens.colors.base01,
          borderTopColor: tokens.colors.base04,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingBottom: Math.max(insets.bottom, tokens.spacing.xs),
          paddingTop: tokens.spacing.xs,
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
        options={{
          title: t('tabs.account'),
          headerShown: false,
          tabBarIcon: tabIcon('person', 'person-outline'),
        }}
      />
    </Tabs>
  );
}
