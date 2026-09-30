import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { act as reactAct } from 'react';

import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

// Import the web fallback explicitly to test the *.web.tsx bundle.
import { TimePicker as TimePickerWeb } from '../time-picker.web';
import { DatePicker } from '../date-picker';
import { MoneyInput } from '../money-input';
import { TimePicker } from '../time-picker';
import { parseIsoDate } from '../date-time';

// ---------------------------------------------------------------------------
// Capture DateTimePicker onChange callbacks without UNSAFE_getByType.
// The mock factory creates MockDTP; when rendered it stores the current onChange
// in dtpCallbacks so tests can call it directly.
// ---------------------------------------------------------------------------
const dtpCallbacks: { onChange?: (event: { type: string }, date?: Date) => void } = {};

jest.mock('@react-native-community/datetimepicker', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: function MockDTP({
      onChange,
    }: {
      onChange: (event: { type: string }, date?: Date) => void;
    }): React.ReactElement {
      // Captured by closure reference — dtpCallbacks is assigned after module init.
      dtpCallbacks.onChange = onChange;
      return React.createElement(View, { testID: 'mock-datetimepicker' });
    },
  };
});

beforeAll(async () => {
  await initTestI18n('en');
});

// Auto-cleanup after each test so screen doesn't bleed across tests.
// RNTL v14 does this automatically, but we add it explicitly for safety.

// ---------------------------------------------------------------------------
// MoneyInput
// ---------------------------------------------------------------------------

describe('MoneyInput', () => {
  it('formats minor units for display', async () => {
    const { getByDisplayValue } = await renderWithI18n(
      <MoneyInput label="Amount" value={2550} onChange={jest.fn()} />,
    );
    expect(getByDisplayValue('25.50')).toBeTruthy();
  });

  it('parses dot decimal (en locale) into minor units on blur', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} locale="en" />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12.5');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith(1250);
  });

  it('parses comma decimal (me locale) into minor units on blur', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} locale="me" />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12,5');
    await fireEvent(input, 'blur');
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
    await fireEvent(input, 'blur');
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
    await fireEvent(input, 'blur');
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
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith(101);
  });

  it('does not call onChange for invalid input (12abc)', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12abc');
    await fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('round-trip: value=2500 me locale → focus then blur emits 2500', async () => {
    const onChange = jest.fn();
    const { getByLabelText, getByDisplayValue } = await renderWithI18n(
      <MoneyInput label="Amount" value={2500} onChange={onChange} locale="me" />,
    );
    // formatMinorAsMajor(2500, 'me') = '25,00' — displayed with comma decimal
    expect(getByDisplayValue('25,00')).toBeTruthy();
    const input = getByLabelText('Amount');
    // Focus sets draft to '25,00'; blur parses it back to 2500.
    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith(2500);
  });

  it('rejects 12,50 in en locale (only 2 digits after comma — bad grouping)', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <MoneyInput label="Amount" value={null} onChange={onChange} locale="en" />,
    );
    const input = getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12,50');
    await fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TimePicker (native)
// ---------------------------------------------------------------------------

describe('TimePicker (native)', () => {
  it('renders the current HH:mm value', async () => {
    const { getByRole, getByText } = await renderWithI18n(
      <TimePicker label="Start" value="09:30" onChange={jest.fn()} />,
    );
    expect(getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(getByText('09:30')).toBeTruthy();
  });

  it('emits snapped HH:mm when DateTimePicker fires a set event (09:03 → 09:05)', async () => {
    const onChange = jest.fn();
    const { getByRole } = await renderWithI18n(
      <TimePicker label="Start" value="09:00" onChange={onChange} />,
    );

    // Open the picker so MockDTP mounts and captures onChange.
    await fireEvent.press(getByRole('button', { name: 'Start' }));

    // Fire the captured onChange with an off-grid time.
    await reactAct(async () => {
      dtpCallbacks.onChange?.({ type: 'set' }, new Date(2000, 0, 1, 9, 3));
    });

    // 09:03 → rounds to 09:05
    expect(onChange).toHaveBeenCalledWith('09:05');
  });

  it('does not emit when DateTimePicker fires a dismissed event', async () => {
    const onChange = jest.fn();
    const { getByRole } = await renderWithI18n(
      <TimePicker label="Start" value="09:00" onChange={onChange} />,
    );

    await fireEvent.press(getByRole('button', { name: 'Start' }));

    await reactAct(async () => {
      dtpCallbacks.onChange?.({ type: 'dismissed' }, undefined);
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TimePicker.web.tsx fallback
// ---------------------------------------------------------------------------

describe('TimePicker web fallback', () => {
  it('renders with the current value', async () => {
    const { getByDisplayValue } = await renderWithI18n(
      <TimePickerWeb label="Start" value="09:30" onChange={jest.fn()} />,
    );
    expect(getByDisplayValue('09:30')).toBeTruthy();
  });

  it('snaps to 5-minute grid on blur', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <TimePickerWeb label="Start" value="09:00" onChange={onChange} />,
    );
    const input = getByLabelText('Start');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '09:03');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith('09:05');
  });

  it('does not emit for invalid input on blur', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithI18n(
      <TimePickerWeb label="Start" value="09:00" onChange={onChange} />,
    );
    const input = getByLabelText('Start');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, 'bad-value');
    await fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DatePicker (native)
// ---------------------------------------------------------------------------

describe('DatePicker (native)', () => {
  it('renders the current YYYY-MM-DD value', async () => {
    const { getByRole, getByText } = await renderWithI18n(
      <DatePicker label="Date" value="2026-09-30" onChange={jest.fn()} />,
    );
    expect(getByRole('button', { name: 'Date' })).toBeTruthy();
    expect(getByText('2026-09-30')).toBeTruthy();
  });

  it('emits ISO date when DateTimePicker fires a set event', async () => {
    const onChange = jest.fn();
    const { getByRole } = await renderWithI18n(
      <DatePicker label="Date" value="2026-09-30" onChange={onChange} />,
    );

    await fireEvent.press(getByRole('button', { name: 'Date' }));

    await reactAct(async () => {
      // Sep 15 2026 (month is 0-indexed in JS Date)
      dtpCallbacks.onChange?.({ type: 'set' }, new Date(2026, 8, 15));
    });

    expect(onChange).toHaveBeenCalledWith('2026-09-15');
  });

  it('does not emit when DateTimePicker is dismissed', async () => {
    const onChange = jest.fn();
    const { getByRole } = await renderWithI18n(
      <DatePicker label="Date" value="2026-09-30" onChange={onChange} />,
    );

    await fireEvent.press(getByRole('button', { name: 'Date' }));

    await reactAct(async () => {
      dtpCallbacks.onChange?.({ type: 'dismissed' }, undefined);
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// parseIsoDate — rejection of bad dates
// ---------------------------------------------------------------------------

describe('parseIsoDate rejection', () => {
  it('returns null for invalid calendar dates', () => {
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('26-09-30')).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
  });

  it('returns a Date for a valid date', () => {
    const d = parseIsoDate('2026-09-15');
    expect(d).toBeInstanceOf(Date);
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8); // 0-indexed
    expect(d?.getDate()).toBe(15);
  });
});
