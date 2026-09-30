import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { catalogs, flattenMessages } from '@najme/i18n';
import { tokens } from '@najme/ui-tokens';
import { act, render } from '@testing-library/react-native';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import type { ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { TAB_BAR_BASE_HEIGHT, TAB_ICON_SIZE, TAB_LABEL_LINE_HEIGHT } from '../components/ui/theme';
import TabsLayout from '../app/(tabs)/_layout';

interface CapturedScreenOptions {
  tabBarActiveTintColor?: string;
  tabBarStyle?: {
    height?: number;
    paddingTop?: number;
    paddingBottom?: number;
    [key: string]: unknown;
  };
  tabBarLabelStyle?: { lineHeight?: number; [key: string]: unknown };
}
const tabsScreenOptions: { current?: CapturedScreenOptions } = {};
const mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };

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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

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
  beforeEach(() => {
    mockInsets.bottom = 0;
  });

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
    mockInsets.bottom = 34;
    await renderTabs();

    expect(tabsScreenOptions.current?.tabBarStyle?.height).toBe(TAB_BAR_BASE_HEIGHT + 34);
  });

  it('sets tabBarLabelStyle.lineHeight to TAB_LABEL_LINE_HEIGHT so labels are not clipped', async () => {
    await renderTabs();

    expect(tabsScreenOptions.current?.tabBarLabelStyle?.lineHeight).toBe(TAB_LABEL_LINE_HEIGHT);
  });

  it('budget covers padding + icon + label line inside TAB_BAR_BASE_HEIGHT', async () => {
    await renderTabs();
    const paddingTop = Number(tabsScreenOptions.current?.tabBarStyle?.paddingTop ?? 0);
    const paddingBottom = Number(tabsScreenOptions.current?.tabBarStyle?.paddingBottom ?? 0);
    const border = 1;
    expect(TAB_BAR_BASE_HEIGHT).toBeGreaterThanOrEqual(
      border + paddingTop + paddingBottom + TAB_ICON_SIZE + TAB_LABEL_LINE_HEIGHT,
    );
  });
});
