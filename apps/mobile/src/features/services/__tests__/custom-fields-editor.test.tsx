import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { catalogs } from '@najme/i18n';
import { useState, type ReactElement } from 'react';
import { Text } from 'react-native';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';

import {
  CustomFieldsEditor,
  draftFromResponse,
  draftsToPayload,
  type DraftCustomField,
} from '@/features/services/custom-fields-editor';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

jest.mock('@/components/ui/select', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { TextInput, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Select: ({
      label,
      value,
      onChange,
      disabled,
      testID,
    }: {
      label: string;
      value: string | null;
      options: { value: string; label: string }[];
      onChange: (value: string) => void;
      disabled?: boolean;
      testID?: string;
    }) =>
      ReactActual.createElement(
        View,
        { testID },
        ReactActual.createElement(TextInput, {
          accessibilityLabel: label,
          value: value ?? '',
          editable: !disabled,
          onChangeText: onChange,
        }),
      ),
  };
});

function EditorHarness({ initial }: { initial: DraftCustomField[] }): ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CustomFieldsEditor value={value} onChange={setValue} />
      <Text testID="key-value">{value[0]?.key ?? ''}</Text>
      <Text testID="key-touched">{value[0]?.keyTouched ? 'yes' : 'no'}</Text>
      <Text testID="key-locked">{value[0]?.keyLocked ? 'yes' : 'no'}</Text>
      <Text testID="order">{value.map((f) => f.key).join(',')}</Text>
      <Text testID="payload">{JSON.stringify(draftsToPayload(value))}</Text>
    </>
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

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(async () => {
  cleanup();
  await initTestI18n('en');
});

describe('CustomFieldsEditor', () => {
  it('auto-slugs key from label until locked after save', async () => {
    const screen = await renderWithI18n(<EditorHarness initial={[emptyField()]} />);
    const label = screen.getByLabelText(catalogs.en.business.customFields.label);
    await act(async () => {
      fireEvent.changeText(label, 'Pickup address');
    });
    await waitFor(() => {
      expect(screen.getByTestId('key-value').props.children).toBe('pickup_address');
    });
    expect(screen.getByTestId('key-locked').props.children).toBe('no');
    screen.unmount();
  });

  it('locks keys after a save round-trip via draftFromResponse', async () => {
    const locked = draftFromResponse([
      {
        key: 'pickup_address',
        label: 'Pickup address',
        type: 'TEXT',
        required: false,
        options: null,
      },
    ]);
    const screen = await renderWithI18n(<EditorHarness initial={locked} />);
    expect(screen.getByTestId('key-locked').props.children).toBe('yes');
    const label = screen.getByLabelText(catalogs.en.business.customFields.label);
    await act(async () => {
      fireEvent.changeText(label, 'New label');
    });
    expect(screen.getByTestId('key-value').props.children).toBe('pickup_address');
    screen.unmount();
  });

  it('does not overwrite a hand-typed key when the label changes', async () => {
    const screen = await renderWithI18n(<EditorHarness initial={[emptyField()]} />);
    const keyInput = screen.getByTestId('custom-field-key-c1');
    await act(async () => {
      fireEvent.changeText(keyInput, 'allergies');
    });
    expect(screen.getByTestId('key-touched').props.children).toBe('yes');
    const label = screen.getByLabelText(catalogs.en.business.customFields.label);
    await act(async () => {
      fireEvent.changeText(label, 'Аллергии');
    });
    expect(screen.getByTestId('key-value').props.children).toBe('allergies');
    screen.unmount();
  });

  it('does not show a key error on a freshly added blank field', async () => {
    const screen = await renderWithI18n(
      <EditorHarness
        initial={[
          {
            ...emptyField(),
            key: '',
            label: '',
            keyTouched: false,
          },
        ]}
      />,
    );
    expect(screen.queryByText(catalogs.en.business.customFields.errors.keyInvalid)).toBeNull();
    screen.unmount();
  });

  it('shows an empty-key error once the label is typed and the auto-slug is empty', async () => {
    const screen = await renderWithI18n(
      <EditorHarness
        initial={[
          {
            ...emptyField(),
            key: '',
          },
        ]}
      />,
    );
    const label = screen.getByLabelText(catalogs.en.business.customFields.label);
    await act(async () => {
      fireEvent.changeText(label, '!!!');
    });
    expect(screen.getByTestId('key-value').props.children).toBe('');
    expect(screen.getByText(catalogs.en.business.customFields.errors.keyInvalid)).toBeTruthy();
    screen.unmount();
  });

  it('moves fields up and down and keeps SELECT options in payload order', async () => {
    const screen = await renderWithI18n(
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

    const moveUp = screen.getByLabelText(
      catalogs.en.business.customFields.moveUpNamed.replace('{label}', 'Second'),
    );
    await act(async () => {
      fireEvent.press(moveUp);
    });
    expect(screen.getByTestId('order').props.children).toBe('second,first');

    const payload = JSON.parse(
      String(screen.getByTestId('payload').props.children ?? '[]'),
    ) as Array<{
      key: string;
      sortOrder: number;
      options?: Array<{ value: string }>;
    }>;
    expect(payload[0]?.key).toBe('second');
    expect(payload[0]?.sortOrder).toBe(0);
    expect(payload[0]?.options?.[0]?.value).toBe('opt_a');
    expect(payload[1]?.sortOrder).toBe(1);
    screen.unmount();
  });

  it('removes a field via removeNamed', async () => {
    const screen = await renderWithI18n(
      <EditorHarness
        initial={[
          {
            ...emptyField(),
            label: 'Notes',
            key: 'notes',
          },
        ]}
      />,
    );
    const remove = screen.getByLabelText(
      catalogs.en.business.customFields.removeNamed.replace('{label}', 'Notes'),
    );
    await act(async () => {
      fireEvent.press(remove);
    });
    expect(screen.getByTestId('order').props.children).toBe('');
    screen.unmount();
  });

  it('serializes drafts to payload with sortOrder', () => {
    const payload = draftsToPayload([
      {
        clientId: 'c1',
        key: 'notes',
        keyLocked: false,
        keyTouched: false,
        label: ' Notes ',
        type: 'TEXT',
        required: true,
        options: [],
      },
    ]);
    expect(payload).toEqual([
      {
        key: 'notes',
        label: 'Notes',
        type: 'TEXT',
        required: true,
        options: undefined,
        sortOrder: 0,
      },
    ]);
  });
});
