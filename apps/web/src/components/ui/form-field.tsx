import { cloneElement, useId, type ReactElement } from 'react';

import { cn } from '@/lib/utils';

import { Label } from './label';

export interface FormFieldProps {
  label: string;
  /** Validation message. Pass `errors.x?.message` from react-hook-form. */
  error?: string | undefined;
  /** Optional helper text shown under the control while there is no error. */
  description?: string;
  className?: string;
  /**
   * The control (e.g. `<Input {...register('email')} />`). It receives `id`, `aria-invalid` and
   * `aria-describedby` so the label, hint and error are wired for assistive technology.
   */
  children: ReactElement<{
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }>;
}

/** Label + control + helper/error text, wired for react-hook-form via `register`/`Controller`. */
export function FormField({
  label,
  error,
  description,
  className,
  children,
}: FormFieldProps): ReactElement {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : description ? descriptionId : undefined;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
