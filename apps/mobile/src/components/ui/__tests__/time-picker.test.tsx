import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { act as reactAct } from 'react';

import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

// Import the web fallback explicitly to test the *.web.tsx bundle.
import { TimePicker as TimePickerWeb } from '../time-picker.web';
import { TimePicker } from '../time-picker';

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
      dtpCallbacks.onChange = onChange;
      return React.createElement(View, { testID: 'mock-datetimepicker' });
    },
  };
});

beforeAll(async () => {
  await initTestI18n('en');
});

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

    await fireEvent.press(getByRole('button', { name: 'Start' }));

    await reactAct(async () => {
      dtpCallbacks.onChange?.({ type: 'set' }, new Date(2000, 0, 1, 9, 3));
    });

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
