import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fontFamilies,
  TAB_BAR_BASE_HEIGHT,
  TAB_LABEL_FONT_SIZE,
  TAB_LABEL_LINE_HEIGHT,
} from '@/components/ui/theme';
import { BusinessProvider, useBusinessContext } from '@/features/business/business-provider';
import { useMyBusinesses } from '@/features/business/use-my-businesses';

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

function BusinessTabs(): ReactElement {
  const { t } = useTranslation('business');
  const insets = useSafeAreaInsets();
  const { business } = useBusinessContext();
  const { data: myBusinesses } = useMyBusinesses();

  const myStaffMemberId = useMemo(() => {
    const row = myBusinesses?.find((b) => b.businessId === business.id);
    return row?.staffMemberId ?? null;
  }, [business.id, myBusinesses]);

  const isStaff = business.myRole === 'STAFF';
  // Hide Schedule for unlinked STAFF (mirrors web nav).
  const hideScheduleTab = isStaff && myBusinesses !== undefined && myStaffMemberId === null;

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
          // Allow wrapping on narrow phones (STAFF schedule label).
          textAlign: 'center',
        },
        tabBarAllowFontScaling: true,
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
        options={{
          title: t('shell.overview'),
          tabBarIcon: tabIcon('grid', 'grid-outline'),
        }}
      />
      <Tabs.Screen
        name="staff"
        options={{
          title: t('shell.staff'),
          headerShown: false,
          tabBarIcon: tabIcon('people', 'people-outline'),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t('shell.services'),
          headerShown: false,
          tabBarIcon: tabIcon('cut', 'cut-outline'),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: isStaff ? t('shell.mySchedule') : t('shell.schedule'),
          headerShown: false,
          href: hideScheduleTab ? null : undefined,
          tabBarIcon: tabIcon('calendar', 'calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('shell.more'),
          headerShown: false,
          tabBarIcon: tabIcon('ellipsis-horizontal', 'ellipsis-horizontal-outline'),
        }}
      />
    </Tabs>
  );
}

/** Business dashboard tabs wrapped in the loaded business context. */
export default function BusinessIdLayout(): ReactElement {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  return (
    <BusinessProvider businessId={businessId}>
      <BusinessTabs />
    </BusinessProvider>
  );
}
