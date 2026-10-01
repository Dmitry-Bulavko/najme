import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactElement } from 'react';

// MoneyInput reads the current next-intl locale; default to 'en' in unit tests.
vi.mock('next-intl', () => ({ useLocale: () => 'en' }));

import { MoneyInput } from './money-input';
import { TimeInput } from './time-input';

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
    <div>
      <MoneyInput
        aria-label="Amount"
        value={value}
        onChange={setValue}
        onDraftInvalidChange={setDraftInvalid}
        locale={locale}
      />
      <output data-testid="minor">{value === null ? 'null' : String(value)}</output>
      <output data-testid="draft-invalid">{draftInvalid ? 'yes' : 'no'}</output>
    </div>
  );
}

describe('MoneyInput', () => {
  it('formats minor units for display', () => {
    render(<MoneyInput aria-label="Amount" value={2550} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Amount')).toHaveValue('25.50');
  });

  it('clears the value and flags invalid for en grouping drafts like 12,5', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '12,5');
    expect(screen.getByTestId('minor')).toHaveTextContent('null');
    expect(screen.getByTestId('draft-invalid')).toHaveTextContent('yes');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('null');
    expect(input).toHaveValue('12,5');
    expect(screen.getByTestId('draft-invalid')).toHaveTextContent('yes');
  });

  it('round-trip: value=2500 me locale → focus then blur emits 2500', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness initial={2500} locale="me" />);

    const input = screen.getByLabelText('Amount');
    // On focus, formatMinorAsMajor(2500, 'me') = '25,00'; on blur parseMajorToMinor('25,00', 'me') = 2500.
    await user.click(input);
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('2500');
  });

  it('clears the value and keeps the draft for en 12,50', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="en" initial={1500} />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '12,50');
    expect(screen.getByTestId('minor')).toHaveTextContent('null');
    expect(screen.getByTestId('draft-invalid')).toHaveTextContent('yes');
    await user.tab();
    expect(input).toHaveValue('12,50');
    expect(screen.getByTestId('minor')).toHaveTextContent('null');
  });

  it('parses dot decimal in en locale on blur', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="en" />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '12.5');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('1250');
    expect(input).toHaveValue('12.50');
    expect(screen.getByTestId('draft-invalid')).toHaveTextContent('no');
  });

  it('commits the parsed value on Enter without requiring blur', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="en" initial={0} />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '20{Enter}');
    expect(screen.getByTestId('minor')).toHaveTextContent('2000');
  });

  it('updates the controlled value while typing so submit is not stale', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="en" initial={1500} />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '35');
    expect(screen.getByTestId('minor')).toHaveTextContent('3500');
  });

  it('parses comma decimal in me locale on blur', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="me" />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '12,5');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('1250');
  });

  it('treats comma as grouping in en locale (1,234 → 123400)', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="en" />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '1,234');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('123400');
  });

  it('treats dot as grouping in me locale (1.234,56 → 123456)', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="me" />);

    const input = screen.getByLabelText('Amount');
    await user.clear(input);
    await user.type(input, '1.234,56');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('123456');
  });

  it('rounds half-up to two decimals', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness />);

    const input = screen.getByLabelText('Amount');
    await user.type(input, '1.005');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('101');
  });

  it('clears the value and keeps an invalid draft with non-numeric characters', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness />);

    const input = screen.getByLabelText('Amount');
    await user.type(input, '12abc');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('null');
    expect(input).toHaveValue('12abc');
    expect(screen.getByTestId('draft-invalid')).toHaveTextContent('yes');
  });

  it('clears a prior amount when an invalid draft is entered at once', async () => {
    const user = userEvent.setup();
    render(<MoneyHarness locale="en" initial={1500} />);

    const input = screen.getByLabelText('Amount');
    await user.click(input);
    fireEvent.change(input, { target: { value: '12.3.4' } });
    expect(screen.getByTestId('minor')).toHaveTextContent('null');
    expect(screen.getByTestId('draft-invalid')).toHaveTextContent('yes');
    await user.tab();
    expect(screen.getByTestId('minor')).toHaveTextContent('null');
    expect(input).toHaveValue('12.3.4');
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
    fireEvent.blur(input, { target: { value: '09:03' } });
    expect(screen.getByTestId('time')).toHaveTextContent('09:05');
  });

  it('onChange never emits an off-step value', () => {
    const onChange = vi.fn();
    render(<TimeInput aria-label="Start" value="09:00" onChange={onChange} />);
    const input = screen.getByLabelText('Start');

    fireEvent.change(input, { target: { value: '09:03' } });
    expect(onChange).toHaveBeenCalledWith('09:05');

    fireEvent.change(input, { target: { value: '09:07' } });
    expect(onChange).toHaveBeenCalledWith('09:05');

    fireEvent.change(input, { target: { value: '09:08' } });
    expect(onChange).toHaveBeenCalledWith('09:10');
  });
});
