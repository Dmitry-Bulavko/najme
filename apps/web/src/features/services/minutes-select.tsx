'use client';

import { memo, type ReactElement } from 'react';

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
 * Memoized minute Select so parent re-renders (custom-field typing, submit state)
 * do not rebuild Radix SelectItem subtrees. All curated options stay mounted so
 * closed-trigger typeahead keeps working.
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
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((minutes) => (
          <SelectItem key={minutes} value={String(minutes)}>
            {formatOption(minutes)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
