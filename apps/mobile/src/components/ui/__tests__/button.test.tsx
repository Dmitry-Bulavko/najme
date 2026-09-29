import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { catalogs } from '@najme/i18n';
import { fireEvent, screen } from '@testing-library/react-native';

import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

import { Button } from '../button';

beforeAll(async () => {
  await initTestI18n('en');
});

describe('Button', () => {
  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await renderWithI18n(<Button label="Save" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses and reports busy while loading', async () => {
    const onPress = jest.fn();
    await renderWithI18n(<Button label="Save" loading onPress={onPress} />);

    const button = screen.getByRole('button', { name: /Save/ });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityLabel).toBe(`Save, ${catalogs.en.mobile.ui.loading}`);
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('ignores presses and reports disabled when disabled', async () => {
    const onPress = jest.fn();
    await renderWithI18n(<Button label="Save" disabled onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: false, disabled: true });
  });

  it.each(['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const)(
    'renders the %s variant',
    async (variant) => {
      await renderWithI18n(<Button label="Go" variant={variant} />);
      expect(screen.getByText('Go')).toBeTruthy();
    },
  );
});
