import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { catalogs } from '@najme/i18n';
import { useState, type ReactElement } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, within } from '@testing-library/react-native';

import { MoneyInput } from '@/components/ui/money-input';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

function MoneyHarness({
  initial = null as number | null,
  locale = 'en' as 'en' | 'me' | 'ru' | 'tr',
}: {
  initial?: number | null;
  locale?: 'en' | 'me' | 'ru' | 'tr';
}): ReactElement {
  const [value, setValue] = useState<number | null>(initial);
  const [draftInvalid, setDraftInvalid] = useState(false);
  return (
    <>
      <MoneyInput
        label="Amount"
        value={value}
        onChange={setValue}
        onDraftInvalidChange={setDraftInvalid}
        locale={locale}
        testID="money"
      />
      <Text testID="minor">{value === null ? 'null' : String(value)}</Text>
      <Text testID="draft-invalid">{draftInvalid ? 'yes' : 'no'}</Text>
    </>
  );
}

beforeAll(async () => {
  await initTestI18n('en');
});

describe('MoneyInput', () => {
  it('formats minor units for display', async () => {
    const screen = await renderWithI18n(
      <MoneyInput label="Amount" value={2550} onChange={jest.fn()} testID="money" />,
    );
    const input = within(screen.getByTestId('money')).getByLabelText('Amount');
    expect(input.props.value).toBe('25.50');
    screen.unmount();
  });

  it('commits on change and flags invalid en drafts like 12,50', async () => {
    const screen = await renderWithI18n(<MoneyHarness locale="en" initial={1500} />);
    const input = within(screen.getByTestId('money')).getByLabelText('Amount');
    await act(async () => {
      fireEvent(input, 'focus');
    });
    await act(async () => {
      fireEvent.changeText(input, '12,50');
    });
    expect(screen.getByTestId('minor').props.children).toBe('null');
    expect(screen.getByTestId('draft-invalid').props.children).toBe('yes');
    await act(async () => {
      fireEvent(input, 'blur');
    });
    expect(input.props.value).toBe('12,50');
    expect(screen.getByTestId('minor').props.children).toBe('null');
    expect(screen.getByTestId('draft-invalid').props.children).toBe('yes');
    screen.unmount();
  });

  it('parses comma decimal in me locale on change', async () => {
    const screen = await renderWithI18n(<MoneyHarness locale="me" />);
    const input = within(screen.getByTestId('money')).getByLabelText('Amount');
    await act(async () => {
      fireEvent(input, 'focus');
    });
    await act(async () => {
      fireEvent.changeText(input, '12,50');
    });
    expect(screen.getByTestId('minor').props.children).toBe('1250');
    expect(screen.getByTestId('draft-invalid').props.children).toBe('no');
    screen.unmount();
  });

  it('updates the controlled value while typing so submit is not stale', async () => {
    const screen = await renderWithI18n(<MoneyHarness locale="en" initial={1500} />);
    const input = within(screen.getByTestId('money')).getByLabelText('Amount');
    await act(async () => {
      fireEvent(input, 'focus');
    });
    await act(async () => {
      fireEvent.changeText(input, '35');
    });
    expect(screen.getByTestId('minor').props.children).toBe('3500');
    screen.unmount();
  });

  it('clears draft-invalid when the field is emptied', async () => {
    const screen = await renderWithI18n(<MoneyHarness locale="en" />);
    const input = within(screen.getByTestId('money')).getByLabelText('Amount');
    await act(async () => {
      fireEvent(input, 'focus');
    });
    await act(async () => {
      fireEvent.changeText(input, '12,50');
    });
    expect(screen.getByTestId('draft-invalid').props.children).toBe('yes');
    await act(async () => {
      fireEvent.changeText(input, '');
    });
    expect(screen.getByTestId('minor').props.children).toBe('null');
    expect(screen.getByTestId('draft-invalid').props.children).toBe('no');
    // catalogs imported so i18n stays warm for sibling suites
    expect(catalogs.en.business.services.price).toBeTruthy();
    screen.unmount();
  });
});
