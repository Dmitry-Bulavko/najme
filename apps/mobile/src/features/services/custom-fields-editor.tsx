import type { CustomFieldType, SelectOption, ServiceCustomField } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRef, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Select, SwitchRow, Text, TextField } from '@/components/ui';

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
}: CustomFieldsEditorProps): ReactElement {
  const { t } = useTranslation('business');
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

  const typeOptions = [
    { value: 'TEXT', label: t('customFields.typeText') },
    { value: 'NUMBER', label: t('customFields.typeNumber') },
    { value: 'SELECT', label: t('customFields.typeSelect') },
  ];

  return (
    <View style={styles.root} accessibilityLabel={t('customFields.heading')}>
      <View style={styles.header}>
        <Text variant="body">{t('customFields.heading')}</Text>
        {!readOnly ? (
          <Button
            label={t('customFields.add')}
            variant="secondary"
            size="sm"
            onPress={addField}
            disabled={controlsDisabled || value.length >= 10}
            testID="custom-fields-add"
          />
        ) : null}
      </View>
      <Text variant="caption" color="text03">
        {t('customFields.hint')}
      </Text>

      {value.length === 0 ? (
        <Text variant="body" color="text03">
          {t('customFields.empty')}
        </Text>
      ) : (
        <View style={styles.list}>
          {value.map((field, index) => {
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
              <View
                key={field.clientId}
                style={styles.card}
                testID={`custom-field-${field.clientId}`}
              >
                <TextField
                  label={t('customFields.label')}
                  value={field.label}
                  onChangeText={(label) => onLabelChange(index, label)}
                  editable={!controlsDisabled}
                  autoComplete="off"
                  maxLength={80}
                  error={labelError}
                />
                <TextField
                  label={t('customFields.key')}
                  value={field.key}
                  onChangeText={(key) => onKeyChange(index, key)}
                  editable={!controlsDisabled && !field.keyLocked}
                  autoComplete="off"
                  autoCapitalize="none"
                  maxLength={40}
                  error={keyError}
                  helperText={
                    field.keyLocked
                      ? t('customFields.keyLockedHint')
                      : t('customFields.keyEditableHint')
                  }
                  testID={`custom-field-key-${field.clientId}`}
                />
                <Select
                  label={t('customFields.type')}
                  value={field.type}
                  options={typeOptions}
                  disabled={controlsDisabled}
                  onChange={(next) => {
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
                />
                <SwitchRow
                  label={t('customFields.required')}
                  value={field.required}
                  onValueChange={(required) => updateAt(index, { required })}
                  disabled={controlsDisabled}
                />

                {field.type === 'SELECT' ? (
                  <View style={styles.options}>
                    <Text variant="caption" color="text02">
                      {t('customFields.optionsHeading')}
                    </Text>
                    {optionsError ? (
                      <Text variant="caption" color="danger" accessibilityRole="alert">
                        {optionsError}
                      </Text>
                    ) : null}
                    {field.options.map((option, optionIndex) => (
                      <View key={`${field.clientId}-opt-${optionIndex}`} style={styles.optionRow}>
                        <TextField
                          label={t('customFields.optionValue')}
                          value={option.value}
                          onChangeText={(value) => updateOption(index, optionIndex, { value })}
                          editable={!controlsDisabled}
                          autoComplete="off"
                          maxLength={80}
                          containerStyle={styles.optionField}
                        />
                        <TextField
                          label={t('customFields.optionLabel')}
                          value={option.label}
                          onChangeText={(label) => updateOption(index, optionIndex, { label })}
                          editable={!controlsDisabled}
                          autoComplete="off"
                          maxLength={80}
                          containerStyle={styles.optionField}
                        />
                        {!readOnly ? (
                          <Button
                            label={t('customFields.removeOption')}
                            accessibilityLabel={t('customFields.removeOptionNamed', {
                              label:
                                option.label.trim() ||
                                option.value.trim() ||
                                String(optionIndex + 1),
                            })}
                            variant="ghost"
                            size="sm"
                            onPress={() => removeOption(index, optionIndex)}
                            disabled={controlsDisabled}
                          />
                        ) : null}
                      </View>
                    ))}
                    {!readOnly ? (
                      <Button
                        label={t('customFields.addOption')}
                        variant="secondary"
                        size="sm"
                        onPress={() => addOption(index)}
                        disabled={controlsDisabled || field.options.length >= 20}
                      />
                    ) : null}
                  </View>
                ) : null}

                {!readOnly ? (
                  <View style={styles.rowActions}>
                    <Button
                      label={t('customFields.moveUp')}
                      variant="secondary"
                      size="sm"
                      onPress={() => move(index, -1)}
                      disabled={controlsDisabled || index === 0}
                      accessibilityLabel={t('customFields.moveUpNamed', { label: rowLabel })}
                    />
                    <Button
                      label={t('customFields.moveDown')}
                      variant="secondary"
                      size="sm"
                      onPress={() => move(index, 1)}
                      disabled={controlsDisabled || index === value.length - 1}
                      accessibilityLabel={t('customFields.moveDownNamed', { label: rowLabel })}
                    />
                    <Button
                      label={t('customFields.remove')}
                      variant="destructive"
                      size="sm"
                      onPress={() => removeAt(index)}
                      disabled={controlsDisabled}
                      accessibilityLabel={t('customFields.removeNamed', { label: rowLabel })}
                    />
                  </View>
                ) : null}
                {!readOnly ? (
                  <Text variant="caption" color="text03">
                    {t('customFields.removeHint')}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
  },
  list: { gap: tokens.spacing.md },
  card: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    backgroundColor: tokens.colors.base01,
  },
  options: { gap: tokens.spacing.sm },
  optionRow: { gap: tokens.spacing.sm },
  optionField: { flex: 1 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
});
