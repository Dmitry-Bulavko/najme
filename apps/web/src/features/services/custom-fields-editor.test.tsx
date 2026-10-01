import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  CustomFieldsEditor,
  draftFromResponse,
  draftsToPayload,
  type DraftCustomField,
} from './custom-fields-editor';

function EditorHarness({
  initial,
  onChangeSpy,
}: {
  initial: DraftCustomField[];
  onChangeSpy?: (next: DraftCustomField[]) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={{ business: catalogs.en.business }}>
      <CustomFieldsEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          onChangeSpy?.(next);
        }}
      />
      <output data-testid="key-value">{value[0]?.key ?? ''}</output>
      <output data-testid="key-touched">{value[0]?.keyTouched ? 'yes' : 'no'}</output>
      <output data-testid="order">{value.map((f) => f.key).join(',')}</output>
      <output data-testid="payload">{JSON.stringify(draftsToPayload(value))}</output>
    </NextIntlClientProvider>
  );
}

const emptyField = (): DraftCustomField => ({
  clientId: 'c1',
  key: 'field',
  keyLocked: false,
  keyTouched: false,
  label: '',
  type: 'TEXT',
  required: false,
  options: [],
});

describe('CustomFieldsEditor', () => {
  it('auto-slugs key from label until locked', async () => {
    const user = userEvent.setup();
    render(<EditorHarness initial={[emptyField()]} />);

    await user.type(
      screen.getByLabelText(catalogs.en.business.customFields.label),
      'Pickup address',
    );
    expect(screen.getByTestId('key-value').textContent).toBe('pickup_address');
  });

  it('does not overwrite a hand-typed key when the label changes', async () => {
    const user = userEvent.setup();
    render(<EditorHarness initial={[emptyField()]} />);

    const keyInput = screen.getByLabelText(catalogs.en.business.customFields.key);
    await user.clear(keyInput);
    await user.type(keyInput, 'allergies');
    expect(screen.getByTestId('key-touched').textContent).toBe('yes');

    await user.type(screen.getByLabelText(catalogs.en.business.customFields.label), 'Аллергии');
    expect(screen.getByTestId('key-value').textContent).toBe('allergies');
  });

  it('shows an empty-key error when the auto-slug is empty', async () => {
    const user = userEvent.setup();
    render(
      <EditorHarness
        initial={[
          {
            ...emptyField(),
            key: '',
          },
        ]}
      />,
    );

    await user.type(screen.getByLabelText(catalogs.en.business.customFields.label), '!!!');
    expect(screen.getByTestId('key-value').textContent).toBe('');
    expect(screen.getByText(catalogs.en.business.customFields.errors.keyInvalid)).toBeTruthy();
  });

  it('moves fields up and down and keeps SELECT options in payload order', async () => {
    const user = userEvent.setup();
    render(
      <EditorHarness
        initial={[
          {
            clientId: 'a',
            key: 'first',
            keyLocked: false,
            keyTouched: false,
            label: 'First',
            type: 'TEXT',
            required: false,
            options: [],
          },
          {
            clientId: 'b',
            key: 'second',
            keyLocked: false,
            keyTouched: false,
            label: 'Second',
            type: 'SELECT',
            required: false,
            options: [{ value: 'opt_a', label: 'A' }],
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: catalogs.en.business.customFields.moveUpNamed.replace('{label}', 'Second'),
      }),
    );
    expect(screen.getByTestId('order').textContent).toBe('second,first');

    const payload = JSON.parse(screen.getByTestId('payload').textContent ?? '[]') as Array<{
      key: string;
      sortOrder: number;
      options?: Array<{ value: string }>;
    }>;
    expect(payload[0]?.key).toBe('second');
    expect(payload[0]?.sortOrder).toBe(0);
    expect(payload[0]?.options?.[0]?.value).toBe('opt_a');
    expect(payload[1]?.sortOrder).toBe(1);
  });

  it('locks keys after a save round-trip via draftFromResponse', () => {
    const drafted = draftFromResponse([
      {
        key: 'allergies',
        label: 'Allergies',
        type: 'TEXT',
        required: false,
        options: null,
      },
    ]);
    expect(drafted[0]?.keyLocked).toBe(true);
    expect(drafted[0]?.key).toBe('allergies');

    render(<EditorHarness initial={drafted} />);
    expect(screen.getByLabelText(catalogs.en.business.customFields.key)).toBeDisabled();
  });

  it('wires the Type select to a label', () => {
    render(<EditorHarness initial={[emptyField()]} />);
    expect(screen.getByLabelText(catalogs.en.business.customFields.type)).toBeTruthy();
  });
});
