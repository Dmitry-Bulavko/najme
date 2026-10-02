import { beforeAll, describe, expect, it, jest } from '@jest/globals';
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
      <Text testID="key-locked">{value[0]?.keyLocked ? 'yes' : 'no'}</Text>
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

describe('CustomFieldsEditor', () => {
  it('auto-slugs key from label until locked after save', async () => {
    const screen = await renderWithI18n(<EditorHarness initial={[emptyField()]} />);
    await act(async () => {
      fireEvent.changeText(
        screen.getByLabelText(catalogs.en.business.customFields.label),
        'Pickup address',
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('key-value').props.children).toBe('pickup_address');
    });
    expect(screen.getByTestId('key-locked').props.children).toBe('no');

    const locked = draftFromResponse([
      {
        key: 'pickup_address',
        label: 'Pickup address',
        type: 'TEXT',
        required: false,
        options: null,
      },
    ]);
    cleanup();
    const lockedScreen = await renderWithI18n(<EditorHarness initial={locked} />);
    expect(lockedScreen.getByTestId('key-locked').props.children).toBe('yes');
    await act(async () => {
      fireEvent.changeText(
        lockedScreen.getByLabelText(catalogs.en.business.customFields.label),
        'New label',
      );
    });
    expect(lockedScreen.getByTestId('key-value').props.children).toBe('pickup_address');
    lockedScreen.unmount();
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
