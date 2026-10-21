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

  it('parses dot decimal (en locale) into minor units on change', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} locale="en" />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12.5');
    expect(onChange).toHaveBeenCalledWith(1250);
  });

  it('parses comma decimal (me locale) into minor units on change', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} locale="me" />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12,5');
    expect(onChange).toHaveBeenCalledWith(1250);
  });

  it('treats comma as grouping in en locale (1,234 → 123400)', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} locale="en" />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '1,234');
    expect(onChange).toHaveBeenCalledWith(123400);
  });

  it('treats dot as grouping in me locale (1.234,56 → 123456)', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} locale="me" />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '1.234,56');
    expect(onChange).toHaveBeenCalledWith(123456);
  });

  it('rounds to two decimals (1.005 → 101)', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '1.005');
    expect(onChange).toHaveBeenCalledWith(101);
  });

  it('clears the committed value and flags invalid input (12abc)', async () => {
    const onChange = jest.fn();
    const onDraftInvalidChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput
        label="Amount"
        value={null}
        onChange={onChange}
        onDraftInvalidChange={onDraftInvalidChange}
      />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12abc');
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onDraftInvalidChange).toHaveBeenCalledWith(true);
  });

  it('round-trip: value=2500 me locale → focus then blur emits 2500', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByDisplayValue } = await renderWithI18n(
      <MoneyInput label="Amount" value={2500} onChange={onChange} locale="me" />,
    );
    expect(getByDisplayValue('25,00')).toBeTruthy();
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith(2500);
  });

  it('rejects 12,50 in en locale (only 2 digits after comma — bad grouping)', async () => {
    const onChange = jest.fn();
    const onDraftInvalidChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput
        label="Amount"
        value={null}
        onChange={onChange}
        onDraftInvalidChange={onDraftInvalidChange}
        locale="en"
      />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12,50');
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onDraftInvalidChange).toHaveBeenCalledWith(true);
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

  it('parses comma decimal in me locale on change (harness)', async () => {
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

  it('keeps a typed prefix draft when blur fires before formatting matches', async () => {
    const screen = await renderWithI18n(<MoneyHarness locale="en" initial={1500} />);
    const input = within(screen.getByTestId('money')).getByLabelText('Amount');
    await act(async () => {
      fireEvent(input, 'focus');
    });
    await act(async () => {
      fireEvent.changeText(input, '1');
    });
    expect(screen.getByTestId('minor').props.children).toBe('100');
    await act(async () => {
      fireEvent(input, 'blur');
    });
    // Unexpected blur must not rewrite "1" → "1.00" (truncated commit).
    expect(input.props.value).toBe('1');
    expect(screen.getByTestId('minor').props.children).toBe('100');
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
    expect(catalogs.en.business.services.price).toBeTruthy();
    screen.unmount();
  });
});
