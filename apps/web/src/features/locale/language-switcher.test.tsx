import { catalogs, LOCALE_META } from '@najme/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LanguageSwitcher } from './language-switcher';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/some/path',
  useRouter: () => ({ replace }),
}));

const messages = catalogs.en.common;

function renderSwitcher() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LanguageSwitcher />
    </NextIntlClientProvider>,
  );
}

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    replace.mockClear();
    document.cookie = '';
  });

  it('lists every supported locale with its native label', () => {
    renderSwitcher();

    const select = screen.getByRole('combobox', { name: messages.languageSwitcher.label });
    for (const meta of Object.values(LOCALE_META)) {
      expect(screen.getByRole('option', { name: meta.label })).toBeInTheDocument();
    }
    expect(select).toHaveValue('en');
  });

  it('navigates to the same path under the new locale and remembers the choice in a cookie', async () => {
    renderSwitcher();

    const select = screen.getByRole('combobox', { name: messages.languageSwitcher.label });
    await userEvent.selectOptions(select, 'ru');

    expect(replace).toHaveBeenCalledWith('/ru/some/path');
    expect(document.cookie).toContain('NEXT_LOCALE=ru');
  });
});
