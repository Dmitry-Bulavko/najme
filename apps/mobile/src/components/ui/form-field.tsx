import type { ReactElement } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from 'react-hook-form';

import { TextField, type TextFieldProps } from './text-field';

export interface FormFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'onBlur' | 'error' | 'defaultValue'> {
  control: Control<TValues>;
  name: TName;
  rules?: Omit<
    RegisterOptions<TValues, TName>,
    'valueAsNumber' | 'valueAsDate' | 'setValueAs' | 'disabled'
  >;
}

/**
 * `TextField` bound to react-hook-form through `Controller`. The field's validation message
 * (`fieldState.error.message`) is shown as the error text, so schemas/rules should supply
 * already-localized messages.
 */
export function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  rules,
  ...fieldProps
}: FormFieldProps<TValues, TName>): ReactElement {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => (
        <TextField
          {...fieldProps}
          value={typeof field.value === 'string' ? field.value : ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          required={fieldProps.required ?? Boolean(rules?.required)}
        />
      )}
    />
  );
}
