import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { catalogs } from '@najme/i18n';
import { cleanup, fireEvent } from '@testing-library/react-native';

import { WorkingHoursEditor } from '@/features/schedule/working-hours-editor';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
});

describe('WorkingHoursEditor', () => {
  // Closed / 24:00 / Copy payloads are covered by working-hours-draft unit tests;
  // SwitchRow toggles are unreliable under RNTL on this RN version.
  it('blocks save when intervals overlap and shows a row error', async () => {
    const onSave = jest.fn(async () => undefined);
    const screen = await renderWithI18n(
      <WorkingHoursEditor
        initialIntervals={[
          { weekday: 'MONDAY', start: '09:00', end: '12:00' },
          { weekday: 'MONDAY', start: '11:00', end: '14:00' },
        ]}
        onSave={onSave}
      />,
    );

    fireEvent.press(screen.getByTestId('save-hours'));

    expect(
      await screen.findByText(catalogs.en.business.schedule.hours.validationError),
    ).toBeTruthy();
    expect(
      screen.getAllByText(catalogs.en.business.schedule.hours.rowValidationError).length,
    ).toBeGreaterThan(0);
    expect(onSave).not.toHaveBeenCalled();
    screen.unmount();
  });
});
