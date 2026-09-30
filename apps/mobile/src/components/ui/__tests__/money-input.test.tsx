import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

import { DatePicker } from '../date-picker';
import { MoneyInput } from '../money-input';
import { TimePicker } from '../time-picker';

beforeAll(async () => {
  await initTestI18n('en');
});

describe('MoneyInput', () => {
  it('formats minor units for display', async () => {
    await renderWithI18n(<MoneyInput label="Amount" value={2550} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('25.50')).toBeTruthy();
  });

  it('parses comma decimals into minor units on blur', async () => {
    const onChange = jest.fn();
    await renderWithI18n(<MoneyInput label="Amount" value={null} onChange={onChange} />);

    const input = screen.getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '12,5');
    await fireEvent(input, 'blur');

    expect(onChange).toHaveBeenCalledWith(1250);
  });

  it('rounds to two decimals', async () => {
    const onChange = jest.fn();
    await renderWithI18n(<MoneyInput label="Amount" value={null} onChange={onChange} />);

    const input = screen.getByLabelText('Amount');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, '1.005');
    await fireEvent(input, 'blur');

    expect(onChange).toHaveBeenCalledWith(101);
  });
});

describe('TimePicker', () => {
  it('renders the current HH:mm value', async () => {
    await renderWithI18n(<TimePicker label="Start" value="09:30" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByText('09:30')).toBeTruthy();
  });
});

describe('DatePicker', () => {
  it('renders the current YYYY-MM-DD value', async () => {
    await renderWithI18n(<DatePicker label="Date" value="2026-09-30" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Date' })).toBeTruthy();
    expect(screen.getByText('2026-09-30')).toBeTruthy();
  });
});
