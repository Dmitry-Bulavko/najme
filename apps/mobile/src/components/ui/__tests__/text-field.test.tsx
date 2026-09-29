import { beforeAll, describe, expect, it } from '@jest/globals';
import { catalogs } from '@najme/i18n';
import { fireEvent, screen } from '@testing-library/react-native';

import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

import { TextField } from '../text-field';

beforeAll(async () => {
  await initTestI18n('en');
});

describe('TextField', () => {
  it('shows the label and helper text', async () => {
    await renderWithI18n(<TextField label="Email" helperText="We never share it." />);

    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('We never share it.')).toBeTruthy();
  });

  it('shows the error instead of helper text and announces it as an alert', async () => {
    await renderWithI18n(
      <TextField label="Phone" helperText="Helper" error="Enter a valid phone." />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid phone.');
    expect(screen.queryByText('Helper')).toBeNull();
  });

  it('toggles secure entry with the visibility button', async () => {
    await renderWithI18n(<TextField label="Password" secureTextEntry defaultValue="secret" />);

    const input = screen.getByLabelText('Password');
    expect(input.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: catalogs.en.mobile.ui.showPassword }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: catalogs.en.mobile.ui.hidePassword }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });

  it('has no visibility toggle for regular fields', async () => {
    await renderWithI18n(<TextField label="Name" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('marks required fields visually and for assistive technology', async () => {
    await renderWithI18n(<TextField label="Email" required />);

    expect(screen.getByText('Email *')).toBeTruthy();
    expect(screen.getByLabelText(`Email, ${catalogs.en.mobile.ui.required}`)).toBeTruthy();
  });
});
