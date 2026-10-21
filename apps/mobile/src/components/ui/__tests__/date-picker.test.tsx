import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent } from '@testing-library/react-native';
import { act as reactAct } from 'react';

import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

import { DatePicker } from '../date-picker';
import { parseIsoDate } from '../date-time';

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
