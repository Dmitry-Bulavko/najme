'use client';

import {
  formatMinorAsMajor,
  parseMajorToMinor,
  type ContractLocale,
  type Money,
} from '@najme/contracts';
import { useLocale } from 'next-intl';
import {
  useState,
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
} from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MoneyInputProps extends Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> {
  /** Amount in minor units (e.g. cents). `null` clears the field. */
  value: number | null;
  onChange: (minor: number | null) => void;
  /**
   * Fired when draft validity changes. An invalid non-empty draft calls `onChange(null)` and
   * `onDraftInvalidChange(true)` so the form can block submit with a price-invalid error
   * instead of silently keeping a stale partial amount.
   */
  onDraftInvalidChange?: (invalid: boolean) => void;
  /** ISO currency shown as a trailing affix; defaults to EUR. */
  currency?: Money['currency'];
  /**
   * UI locale used to detect the decimal separator. Defaults to the current next-intl locale.
   * Provide explicitly in tests or when rendering outside a next-intl provider.
   */
  locale?: ContractLocale;
}

/**
 * Edits a major-unit amount (accepts `,` and `.`) and emits integer minor units for the API.
 * Valid drafts commit on change / Enter / blur. Invalid non-empty drafts stay visible, clear
 * the committed value (`onChange(null)`), and signal `onDraftInvalidChange(true)` so submit
 * cannot save a stale partial amount.
 * The decimal separator follows the current UI locale (next-intl) unless overridden via `locale`.
 */
export function MoneyInput({
  value,
  onChange,
  onDraftInvalidChange,
  currency = 'EUR',
  locale: localeProp,
  className,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}: MoneyInputProps): ReactElement {
  // useLocale() reads the next-intl locale from context; prop overrides when provided.
  const uiLocale = useLocale() as ContractLocale;
  const locale = localeProp ?? uiLocale;
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value === null ? '' : formatMinorAsMajor(value, locale));

  function applyDraft(raw: string): boolean {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      onChange(null);
      onDraftInvalidChange?.(false);
      return true;
    }
    const minor = parseMajorToMinor(trimmed, locale);
    if (minor === null) {
      onChange(null);
      onDraftInvalidChange?.(true);
      return false;
    }
    onChange(minor);
    onDraftInvalidChange?.(false);
    return true;
  }

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        className={cn('pr-12 tabular-nums', className)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const raw = event.target.value;
          setDraft(raw);
          applyDraft(raw);
        }}
        onFocus={(event) => {
          setDraft(value === null ? '' : formatMinorAsMajor(value, locale));
          onFocus?.(event);
        }}
        onBlur={(event) => {
          if (applyDraft(event.target.value)) {
            setDraft(null);
          }
          // Invalid non-empty drafts stay visible so the user sees what was rejected.
          onBlur?.(event);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            if (applyDraft(event.currentTarget.value)) {
              setDraft(null);
            }
          }
          onKeyDown?.(event);
        }}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
      >
        {currency}
      </span>
    </div>
  );
}
