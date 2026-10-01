import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { CustomFieldsEditor, type DraftCustomField } from './custom-fields-editor';

function EditorHarness({ initial }: { initial: DraftCustomField[] }) {
  const [value, setValue] = useState(initial);
  return (
    <NextIntlClientProvider locale="en" messages={{ business: catalogs.en.business }}>
      <CustomFieldsEditor value={value} onChange={setValue} />
      <output data-testid="key-value">{value[0]?.key ?? ''}</output>
    </NextIntlClientProvider>
  );
}

describe('CustomFieldsEditor', () => {
  it('auto-slugs key from label until locked', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <EditorHarness
        initial={[
          {
            clientId: 'c1',
            key: 'field',
            keyLocked: false,
            label: '',
            type: 'TEXT',
            required: false,
            options: [],
          },
        ]}
      />,
    );

    await user.type(
      screen.getByLabelText(catalogs.en.business.customFields.label),
      'Pickup address',
    );
    expect(screen.getByTestId('key-value').textContent).toBe('pickup_address');

    rerender(
      <EditorHarness
        key="locked"
        initial={[
          {
            clientId: 'c1',
            key: 'pickup_address',
            keyLocked: true,
            label: 'Pickup address',
            type: 'TEXT',
            required: false,
            options: [],
          },
        ]}
      />,
    );
    expect(screen.getByLabelText(catalogs.en.business.customFields.key)).toBeDisabled();
    expect(screen.getByText(catalogs.en.business.customFields.removeHint)).toBeTruthy();
  });
});
