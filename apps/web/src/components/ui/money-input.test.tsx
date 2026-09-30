import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactElement } from 'react';

import { MoneyInput } from './money-input';
import { TimeInput } from './time-input';

function MoneyHarness({
  initial = null as number | null,
}: {
  initial?: number | null;
}): ReactElement {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <div>
      <MoneyInput aria-label="Amount" value={value} onChange={setValue} />
      <output data-testid="minor">{value === null ? 'null' : String(value)}</output>
    </div>
  );
}

describe('MoneyInput', () => {
  it('formats minor units for display', () => {
    render(<MoneyInput aria-label="Amount" value={2550} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Amount')).toHaveValue('25.50');
  });

  it('parses dot and comma decimals into minor units on blur', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '12,5');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('1250');
    expect(input).toHaveValue('12.50');
  });

  it('rounds half-up to two decimals', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness />);

    const input = screen.getByLabelText('Amount');
    await user.type(input, '1.005');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('101');
  });
});

function TimeHarness({ initial = '09:00' }: { initial?: string }): ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <TimeInput aria-label="Start" value={value} onChange={setValue} />
      <output data-testid="time">{value}</output>
    </div>
  );
}

describe('TimeInput', () => {
  it('renders HH:mm and uses a 5-minute step', () => {
    render(<TimeInput aria-label="Start" value="09:30" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Start');
    expect(input).toHaveAttribute('type', 'time');
    expect(input).toHaveAttribute('step', '300');
    expect(input).toHaveValue('09:30');
  });

  it('snaps on blur to the 5-minute grid', () => {
    render(<TimeHarness initial="09:00" />);
    const input = screen.getByLabelText('Start');
    // jsdom's time input does not accept typed HH:mm reliably; drive blur with the raw value.
    fireEvent.blur(input, { target: { value: '09:03' } });
    expect(screen.getByTestId('time')).toHaveTextContent('09:05');
  });
});
