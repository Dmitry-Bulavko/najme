import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'fr-FR' }, { languageTag: 'tr-TR' }]),
}));

import { initI18n, LOCALE_STORAGE_KEY, setLocale } from './index';

describe('initI18n / setLocale persistence (#15, #34)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('resolves and persists an explicit choice, including the internal "me" code', async () => {
    // i18next.changeLanguage() (used by setLocale) requires an initialized instance.
    await initI18n();
    await setLocale('me');

    expect(await AsyncStorage.getItem(LOCALE_STORAGE_KEY)).toBe('me');

    // A fresh initI18n() call (e.g. next app launch) reads the persisted choice back.
    const locale = await initI18n();

    expect(locale).toBe('me');
  });

  it('falls back to device locales when the stored value is garbage', async () => {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, 'not-a-locale');

    const locale = await initI18n();

    // Device candidates mocked above are 'fr-FR' (unrecognized) then 'tr-TR' -> 'tr'.
    expect(locale).toBe('tr');
  });

  it('falls back to device locales when nothing is stored', async () => {
    const locale = await initI18n();

    expect(locale).toBe('tr');
  });
});
