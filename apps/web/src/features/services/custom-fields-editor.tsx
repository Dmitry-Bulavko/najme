'use client';

import type { CustomFieldType, SelectOption, ServiceCustomField } from '@najme/contracts';
import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  isValidCustomFieldKey,
  slugCustomFieldKey,
  uniqueCustomFieldKey,
} from './slug-custom-field-key';

export type DraftCustomField = {
  /** Stable React key for new rows (not sent to API). */
  clientId: string;
  key: string;
  /** True once the field exists on the server (key locked). */
  keyLocked: boolean;
  /** True after the user edits the key manually; stops auto-slug from label. */
  keyTouched: boolean;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options: SelectOption[];
};

export function draftFromResponse(
  fields: readonly {
    key: string;
    label: string;
    type: CustomFieldType;
    required: boolean;
    options: SelectOption[] | null;
  }[],
): DraftCustomField[] {
  return fields.map((field, index) => ({
    clientId: `saved-${field.key}-${index}`,
    key: field.key,
    keyLocked: true,
    keyTouched: false,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options ?? [],
  }));
}

export function draftsToPayload(drafts: DraftCustomField[]): ServiceCustomField[] {
  return drafts.map((field, index) => ({
    key: field.key,
    label: field.label.trim(),
    type: field.type,
    required: field.required,
    options: field.type === 'SELECT' ? field.options : undefined,
    sortOrder: index,
  }));
}

type CustomFieldsEditorProps = {
  value: DraftCustomField[];
  onChange: (next: DraftCustomField[]) => void;
  /** Hide add/move/remove when true (STAFF read-only). */
  readOnly?: boolean;
  /** Disable controls while submitting without unmounting actions. */
  disabled?: boolean;
  /** Field-level error messages keyed by `${clientId}.${prop}` or root. */
  errors?: Partial<Record<string, string>>;
};

/** Editable list of service custom fields (add, reorder, remove, slug key until saved). */
export function CustomFieldsEditor({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  errors = {},
}: CustomFieldsEditorProps) {
  const t = useTranslations('business');
  const headingId = useId();
  const nextClientSeq = useRef(0);
  const controlsDisabled = readOnly || disabled;

  function newClientId(): string {
    nextClientSeq.current += 1;
    return `new-${nextClientSeq.current}`;
  }

  function updateAt(index: number, patch: Partial<DraftCustomField>): void {
    const next = value.map((field, i) => (i === index ? { ...field, ...patch } : field));
    onChange(next);
  }

  function onLabelChange(index: number, label: string): void {
    const field = value[index];
    if (!field) return;
    if (field.keyLocked || field.keyTouched) {
      updateAt(index, { label });
      return;
    }
    const others = value.filter((_, i) => i !== index).map((f) => f.key);
    const slugged = uniqueCustomFieldKey(slugCustomFieldKey(label), others);
    updateAt(index, { label, key: slugged });
  }

  function onKeyChange(index: number, key: string): void {
    const field = value[index];
    if (!field || field.keyLocked) return;
    updateAt(index, { key: key.trim().toLowerCase(), keyTouched: true });
  }

  function addField(): void {
    if (value.length >= 10) return;
    const others = value.map((f) => f.key);
    const key = uniqueCustomFieldKey('field', others);
    onChange([
      ...value,
      {
        clientId: newClientId(),
        key,
        keyLocked: false,
        keyTouched: false,
        label: '',
        type: 'TEXT',
        required: false,
        options: [],
      },
    ]);
  }

  function move(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  }

  function removeAt(index: number): void {
    onChange(value.filter((_, i) => i !== index));
  }

  function addOption(index: number): void {
    const field = value[index];
    if (!field || field.options.length >= 20) return;
    const n = field.options.length + 1;
    updateAt(index, {
      options: [...field.options, { value: `option_${n}`, label: '' }],
    });
  }

  function updateOption(
    fieldIndex: number,
    optionIndex: number,
    patch: Partial<SelectOption>,
  ): void {
    const field = value[fieldIndex];
    if (!field) return;
    const options = field.options.map((opt, i) => (i === optionIndex ? { ...opt, ...patch } : opt));
    updateAt(fieldIndex, { options });
  }

  function removeOption(fieldIndex: number, optionIndex: number): void {
    const field = value[fieldIndex];
    if (!field) return;
    updateAt(fieldIndex, {
      options: field.options.filter((_, i) => i !== optionIndex),
    });
  }

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-bold text-foreground">
          {t('customFields.heading')}
        </h2>
        {!readOnly ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addField}
            disabled={controlsDisabled || value.length >= 10}
          >
            {t('customFields.add')}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t('customFields.hint')}</p>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('customFields.empty')}</p>
      ) : (
        <ul className="space-y-4">
          {value.map((field, index) => {
            const typeId = `${field.clientId}-type`;
            const keyError =
              errors[`${field.clientId}.key`] ??
              ((field.keyTouched || field.label.trim() !== '') &&
              (!field.key || !isValidCustomFieldKey(field.key))
                ? t('customFields.errors.keyInvalid')
                : undefined);
            const labelError = errors[`${field.clientId}.label`];
            const optionsError = errors[`${field.clientId}.options`];
            const rowLabel = field.label.trim() || t('customFields.label');
            return (
              <li key={field.clientId} className="space-y-3 rounded-md border border-border p-3">
                <FormField label={t('customFields.label')} error={labelError}>
                  <Input
                    value={field.label}
                    onChange={(event) => onLabelChange(index, event.target.value)}
                    disabled={controlsDisabled}
                    autoComplete="off"
                    maxLength={80}
                  />
                </FormField>

                <FormField
                  label={t('customFields.key')}
                  error={keyError}
                  description={
                    field.keyLocked
                      ? t('customFields.keyLockedHint')
                      : t('customFields.keyEditableHint')
                  }
                >
                  <Input
                    value={field.key}
                    onChange={(event) => onKeyChange(index, event.target.value)}
                    disabled={controlsDisabled || field.keyLocked}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={40}
                  />
                </FormField>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={typeId}>{t('customFields.type')}</Label>
                    <Select
                      value={field.type}
                      onValueChange={(next) => {
                        const type = next as CustomFieldType;
                        updateAt(index, {
                          type,
                          options:
                            type === 'SELECT'
                              ? field.options.length > 0
                                ? field.options
                                : [{ value: 'option_1', label: '' }]
                              : [],
                        });
                      }}
                      disabled={controlsDisabled}
                    >
                      <SelectTrigger id={typeId}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEXT">{t('customFields.typeText')}</SelectItem>
                        <SelectItem value="NUMBER">{t('customFields.typeNumber')}</SelectItem>
                        <SelectItem value="SELECT">{t('customFields.typeSelect')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 self-end pb-1">
                    <Checkbox
                      id={`${field.clientId}-required`}
                      checked={field.required}
                      onCheckedChange={(checked) => updateAt(index, { required: checked === true })}
                      disabled={controlsDisabled}
                    />
                    <Label htmlFor={`${field.clientId}-required`}>
                      {t('customFields.required')}
                    </Label>
                  </div>
                </div>

                {field.type === 'SELECT' ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground">
                      {t('customFields.optionsHeading')}
                    </p>
                    {optionsError ? (
                      <p className="text-xs font-medium text-destructive" role="alert">
                        {optionsError}
                      </p>
                    ) : null}
                    {field.options.map((option, optionIndex) => (
                      <div key={`${field.clientId}-opt-${optionIndex}`} className="flex gap-2">
                        <Input
                          aria-label={t('customFields.optionValue')}
                          value={option.value}
                          onChange={(event) =>
                            updateOption(index, optionIndex, {
                              value: event.target.value,
                            })
                          }
                          disabled={controlsDisabled}
                          className="flex-1"
                          autoComplete="off"
                          maxLength={80}
                        />
                        <Input
                          aria-label={t('customFields.optionLabel')}
                          value={option.label}
                          onChange={(event) =>
                            updateOption(index, optionIndex, {
                              label: event.target.value,
                            })
                          }
                          disabled={controlsDisabled}
                          className="flex-1"
                          autoComplete="off"
                          maxLength={80}
                        />
                        {!readOnly ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(index, optionIndex)}
                            disabled={controlsDisabled}
                          >
                            {t('customFields.removeOption')}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => addOption(index)}
                        disabled={controlsDisabled || field.options.length >= 20}
                      >
                        {t('customFields.addOption')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {!readOnly ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => move(index, -1)}
                      disabled={controlsDisabled || index === 0}
                      aria-label={t('customFields.moveUpNamed', { label: rowLabel })}
                    >
                      {t('customFields.moveUp')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => move(index, 1)}
                      disabled={controlsDisabled || index === value.length - 1}
                      aria-label={t('customFields.moveDownNamed', { label: rowLabel })}
                    >
                      {t('customFields.moveDown')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAt(index)}
                      disabled={controlsDisabled}
                      aria-label={t('customFields.removeNamed', { label: rowLabel })}
                    >
                      {t('customFields.remove')}
                    </Button>
                  </div>
                ) : null}
                {!readOnly ? (
                  <p className="text-xs text-muted-foreground">{t('customFields.removeHint')}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
