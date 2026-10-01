'use client';

import { memo, useState, type ReactElement } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MinutesSelectProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  options: readonly number[];
  formatOption: (minutes: number) => string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

/**
 * Memoized minute Select. While closed, only the selected item is mounted so Radix does
 * not rebuild a large SelectItem / native-option tree on every parent re-render.
 */
export const MinutesSelect = memo(function MinutesSelect({
  id,
  value,
  onValueChange,
  disabled,
  options,
  formatOption,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: MinutesSelectProps): ReactElement {
  const [open, setOpen] = useState(false);
  const selected = Number(value);
  const visibleOptions = open
    ? options
    : options.includes(selected)
      ? ([selected] as const)
      : options;

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger id={id} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {visibleOptions.map((minutes) => (
          <SelectItem key={minutes} value={String(minutes)}>
            {formatOption(minutes)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
