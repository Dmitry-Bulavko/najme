'use client';

import type { ChangeEvent, ComponentProps, ReactElement } from 'react';

import { Input } from '@/components/ui/input';
import { snapHhMm, TIME_STEP_MINUTES } from '@/components/ui/time';
import { cn } from '@/lib/utils';

export interface TimeInputProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange'
> {
  /** Wall-clock time as `HH:mm`. */
  value: string;
  onChange: (value: string) => void;
  /** Step in minutes; defaults to 5. */
  stepMinutes?: number;
}

/**
 * Time field that stores `HH:mm` and snaps to a 5-minute grid (business schedule / booking slots).
 */
export function TimeInput({
  value,
  onChange,
  stepMinutes = TIME_STEP_MINUTES,
  className,
  onBlur,
  ...props
}: TimeInputProps): ReactElement {
  const stepSeconds = stepMinutes * 60;

  function commit(raw: string): void {
    const snapped = snapHhMm(raw, stepMinutes);
    if (snapped) {
      onChange(snapped);
    }
  }

  return (
    <Input
      type="time"
      step={stepSeconds}
      value={value}
      className={cn('tabular-nums', className)}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        if (next) {
          const snapped = snapHhMm(next, stepMinutes);
          onChange(snapped ?? next);
        }
      }}
      onBlur={(event) => {
        commit(event.target.value);
        onBlur?.(event);
      }}
      {...props}
    />
  );
}
