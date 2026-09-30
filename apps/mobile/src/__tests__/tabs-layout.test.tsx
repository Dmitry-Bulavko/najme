import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { catalogs, flattenMessages } from '@najme/i18n';
import { tokens } from '@najme/ui-tokens';
import { act, render } from '@testing-library/react-native';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import type { ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { TAB_BAR_BASE_HEIGHT, TAB_LABEL_LINE_HEIGHT } from '../components/ui/theme';
import TabsLayout from '../app/(tabs)/_layout';

// `expo-router`'s real `Tabs`/`Tabs.Screen` render native tab-bar chrome that isn't meaningful in a
// unit test; this test double renders each screen's `options.title` as plain text so the localized
// tab titles are observable via Testing Library, while exercising the real `TabsLayout` component
// (and its `useTranslation()` call) end to end.
interface CapturedScreenOptions {
  tabBarActiveTintColor?: string;
  tabBarStyle?: { height?: number; [key: string]: unknown };
  tabBarLabelStyle?: { lineHeight?: number; [key: string]: unknown };
}
const tabsScreenOptions: { current?: CapturedScreenOptions } = {};

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  function Tabs({
    children,
    screenOptions,
  }: {
    children: ReactNode;
    screenOptions?: CapturedScreenOptions;
  }) {
    tabsScreenOptions.current = screenOptions;
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }
  Tabs.Screen = function Screen({
    options,
  }: {
    options?: { title?: string; tabBarIcon?: unknown };
  }) {
    return ReactActual.createElement(
      Text,
      { testID: options?.tabBarIcon ? 'tab-with-icon' : 'tab-without-icon' },
      options?.title ?? '',
    );
  };

  return { Tabs };
});

beforeAll(async () => {
  await i18next
    .use(ICU)
    .use(initReactI18next)
    .init({
      resources: {
        en: { common: flattenMessages(catalogs.en.common) },
        me: { common: flattenMessages(catalogs.me.common) },
        ru: { common: flattenMessages(catalogs.ru.common) },
        tr: { common: flattenMessages(catalogs.tr.common) },
      },
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: 'common',
      ns: ['common'],
      interpolation: { escapeValue: false },
      returnNull: false,
    });
});

function renderTabs() {
  return render(
    <I18nextProvider i18n={i18next}>
      <TabsLayout />
    </I18nextProvider>,
  );
}

describe('TabsLayout', () => {
  it('gives every tab an icon and tints the active tab with the primary token', async () => {
    const { getAllByTestId } = await renderTabs();

    expect(getAllByTestId('tab-with-icon')).toHaveLength(3);
    expect(tabsScreenOptions.current?.tabBarActiveTintColor).toBe(tokens.colors.primary);
  });

  it('renders the English tab titles by default', async () => {
    const { getByText } = await renderTabs();

    expect(getByText(catalogs.en.common.tabs.discover)).toBeTruthy();
    expect(getByText(catalogs.en.common.tabs.bookings)).toBeTruthy();
    expect(getByText(catalogs.en.common.tabs.account)).toBeTruthy();
  });

  it('renders the localized tab titles after switching locale', async () => {
    await i18next.changeLanguage('me');
    const { getByText } = await renderTabs();

    expect(getByText(catalogs.me.common.tabs.discover)).toBeTruthy();
    expect(getByText(catalogs.me.common.tabs.bookings)).toBeTruthy();
    expect(getByText(catalogs.me.common.tabs.account)).toBeTruthy();

    await act(async () => {
      await i18next.changeLanguage('en');
    });
  });

  it('sets tabBarStyle.height to TAB_BAR_BASE_HEIGHT plus safe-area bottom inset', async () => {
    // jest.setup.ts mocks react-native-safe-area-context with zero insets.
    await renderTabs();

    expect(tabsScreenOptions.current?.tabBarStyle?.height).toBe(TAB_BAR_BASE_HEIGHT);
  });

  it('sets tabBarLabelStyle.lineHeight to TAB_LABEL_LINE_HEIGHT so labels are not clipped', async () => {
    await renderTabs();

    expect(tabsScreenOptions.current?.tabBarLabelStyle?.lineHeight).toBe(TAB_LABEL_LINE_HEIGHT);
  });
});
