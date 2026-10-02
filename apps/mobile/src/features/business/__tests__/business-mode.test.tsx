import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Business } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { BusinessMoreHome } from '@/features/business/business-more-home';
import { BusinessProfileForm } from '@/features/business/business-profile-form';
import { BusinessSettingsForm } from '@/features/business/business-settings-form';
import { BusinessStatusBanner } from '@/features/business/business-status-banner';
import { CreateBusinessForm } from '@/features/business/create-business-form';
import { enterBusinessMode, enterClientMode } from '@/features/business/enter-mode';
import { businessHref, writeAppMode, writeLastBusinessId } from '@/features/business/last-business';
import { ApiError, apiRequest } from '@/lib/api/client';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSetBusiness = jest.fn();
const mockInvalidateMyBusinesses = jest.fn(async () => undefined);

const baseBusiness: Business = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Salon Ada',
  slug: 'salon-ada',
  status: 'APPROVED',
  categoryId: '22222222-2222-4222-8222-222222222222',
  city: 'PODGORICA',
  description: null,
  address: null,
  contactPhone: null,
  contactEmail: null,
  logoUrl: null,
  coverUrl: null,
  timezone: 'Europe/Podgorica',
  confirmationMode: 'AUTO',
  cancellationWindowMinutes: 120,
  minBookingNoticeMinutes: 60,
  bookingHorizonDays: 60,
  rejectionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  myRole: 'OWNER',
};

/** Mutable bag for the business-provider mock (jest.mock requires a `mock*` name). */
const mockBusinessRef: { current: Business } = { current: { ...baseBusiness } };

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: jest.fn(),
      canGoBack: () => true,
    }),
    usePathname: () => '/',
    Redirect: ({ href }: { href: string }) =>
      ReactActual.createElement(ReactActual.Fragment, null, `redirect:${href}`),
    Link: ({ children }: { children: ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

jest.mock('@/features/auth/auth-provider', () => ({
  useSession: () => ({
    state: 'authenticated' as const,
    me: {
      id: 'u1',
      email: 'owner@example.com',
      emailVerified: true,
      displayName: 'Owner',
      avatarUrl: null,
      locale: 'en',
      hasPassword: true,
      isPlatformAdmin: false,
    },
    signIn: jest.fn(),
    signUp: jest.fn(),
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
    updateMe: jest.fn(),
  }),
}));

jest.mock('@/features/business/business-provider', () => ({
  useBusinessContext: () => ({
    get business() {
      return mockBusinessRef.current;
    },
    setBusiness: mockSetBusiness,
    reload: jest.fn(async () => undefined),
  }),
}));

jest.mock('@/features/business/use-my-businesses', () => ({
  useMyBusinesses: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
  useInvalidateMyBusinesses: () => mockInvalidateMyBusinesses,
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: jest.fn(),
  };
});

jest.mock('@/features/business/last-business', () => {
  const actual = jest.requireActual<typeof import('@/features/business/last-business')>(
    '@/features/business/last-business',
  );
  return {
    ...actual,
    writeAppMode: jest.fn(async () => undefined),
    writeLastBusinessId: jest.fn(async () => undefined),
  };
});

/** Deterministic Select for form tests — first press assigns the first option. */
jest.mock('@/components/ui/select', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Select: ({
      label,
      value,
      options,
      onChange,
      testID,
    }: {
      label: string;
      value: string | null;
      options: { value: string; label: string }[];
      onChange: (value: string) => void;
      testID?: string;
    }) =>
      ReactActual.createElement(
        RN.View,
        { testID },
        ReactActual.createElement(
          RN.Pressable,
          {
            accessibilityLabel: label,
            testID: testID ? `${testID}-trigger` : undefined,
            onPress: () => {
              const first = options[0];
              if (first) onChange(first.value);
            },
          },
          ReactActual.createElement(
            RN.Text,
            null,
            options.find((option) => option.value === value)?.label ?? 'none',
          ),
        ),
      ),
  };
});

async function wrapQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderWithI18n(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(() => {
  cleanup();
  mockBusinessRef.current = { ...baseBusiness };
  mockReplace.mockReset();
  mockPush.mockReset();
  mockSetBusiness.mockReset();
  mockInvalidateMyBusinesses.mockClear();
  jest.mocked(apiRequest).mockReset();
  jest.mocked(writeAppMode).mockClear();
  jest.mocked(writeLastBusinessId).mockClear();
});

describe('CreateBusinessForm', () => {
  it('submits create payload and navigates to the new business', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.startsWith('/categories')) {
        return Promise.resolve([
          {
            id: baseBusiness.categoryId,
            slug: 'salon',
            name: 'Salon',
            iconKey: null,
            sortOrder: 1,
          },
        ]);
      }
      if (path === '/businesses') {
        return Promise.resolve(baseBusiness);
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await wrapQuery(<CreateBusinessForm />);
    await waitFor(() => expect(screen.getByTestId('create-category-trigger')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.create.name), 'Salon Ada');
      fireEvent.press(screen.getByTestId('create-category-trigger'));
      fireEvent.press(screen.getByTestId('create-city-trigger'));
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('create-business-submit'));
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        '/businesses',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            name: 'Salon Ada',
            categoryId: baseBusiness.categoryId,
            city: expect.any(String),
          }),
        }),
      );
      expect(mockReplace).toHaveBeenCalledWith(businessHref(baseBusiness.id));
    });

    screen.unmount();
  });

  it('maps VALIDATION_FAILED.details onto form fields', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.startsWith('/categories')) {
        return Promise.resolve([
          {
            id: baseBusiness.categoryId,
            slug: 'salon',
            name: 'Salon',
            iconKey: null,
            sortOrder: 1,
          },
        ]);
      }
      if (path === '/businesses') {
        return Promise.reject(
          new ApiError('VALIDATION_FAILED', 'bad', 400, {
            issues: [{ path: ['name'], message: 'taken' }],
          }),
        );
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await wrapQuery(<CreateBusinessForm />);
    await waitFor(() => expect(screen.getByTestId('create-category-trigger')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.create.name), 'Taken');
      fireEvent.press(screen.getByTestId('create-category-trigger'));
      fireEvent.press(screen.getByTestId('create-city-trigger'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('create-business-submit'));
    });

    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.create.errors.invalid)).toBeTruthy();
    });

    screen.unmount();
  });
});

describe('BusinessSettingsForm', () => {
  it('saves confirmation mode with exact PATCH body', async () => {
    jest.mocked(apiRequest).mockResolvedValue({
      ...baseBusiness,
      confirmationMode: 'MANUAL',
    });

    const screen = await wrapQuery(<BusinessSettingsForm />);
    expect(screen.getByTestId('settings-confirmation-mode')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(catalogs.en.business.settings.confirmationManual));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-save'));
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(`/businesses/${baseBusiness.id}`, {
        method: 'PATCH',
        body: { confirmationMode: 'MANUAL' },
      });
    });
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.settings.saved)).toBeTruthy();
    });

    screen.unmount();
  });

  it('shows non-preset 45 and omits it from PATCH when untouched', async () => {
    mockBusinessRef.current = { ...baseBusiness, cancellationWindowMinutes: 45 };
    jest.mocked(apiRequest).mockResolvedValue({
      ...baseBusiness,
      cancellationWindowMinutes: 45,
      confirmationMode: 'MANUAL',
    });

    const screen = await wrapQuery(<BusinessSettingsForm />);
    expect(screen.getByText('45 minutes')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText(catalogs.en.business.settings.confirmationManual));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-save'));
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(`/businesses/${baseBusiness.id}`, {
        method: 'PATCH',
        body: { confirmationMode: 'MANUAL' },
      });
    });

    screen.unmount();
  });

  it('second save sends only the new change', async () => {
    mockBusinessRef.current = { ...baseBusiness, confirmationMode: 'MANUAL' };
    jest.mocked(apiRequest).mockResolvedValue({
      ...baseBusiness,
      confirmationMode: 'MANUAL',
      bookingHorizonDays: 7,
    });

    const screen = await wrapQuery(<BusinessSettingsForm />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-horizon-trigger'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-save'));
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(`/businesses/${baseBusiness.id}`, {
        method: 'PATCH',
        body: { bookingHorizonDays: 7 },
      });
    });

    screen.unmount();
  });

  it('shows forbidden state for STAFF', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    const screen = await wrapQuery(<BusinessSettingsForm />);
    expect(screen.getByTestId('business-settings-forbidden')).toBeTruthy();
    expect(screen.queryByTestId('settings-save')).toBeNull();
    expect(screen.queryByTestId('settings-confirmation-mode')).toBeNull();
    screen.unmount();
  });
});

describe('BusinessProfileForm', () => {
  it('is read-only for STAFF (no Save, readOnlySubtitle)', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    jest.mocked(apiRequest).mockResolvedValue([
      {
        id: baseBusiness.categoryId,
        slug: 'salon',
        name: 'Salon',
        iconKey: null,
        sortOrder: 1,
      },
    ]);

    const screen = await wrapQuery(<BusinessProfileForm />);
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.profile.readOnlySubtitle)).toBeTruthy();
    });
    expect(screen.queryByTestId('profile-save')).toBeNull();
    expect(screen.getByDisplayValue('Salon Ada')).toBeTruthy();

    screen.unmount();
  });

  it('PATCHes only changed fields', async () => {
    jest.mocked(apiRequest).mockImplementation(((path: string) => {
      if (path.startsWith('/categories')) {
        return Promise.resolve([
          {
            id: baseBusiness.categoryId,
            slug: 'salon',
            name: 'Salon',
            iconKey: null,
            sortOrder: 1,
          },
        ]);
      }
      if (path === `/businesses/${baseBusiness.id}`) {
        return Promise.resolve({ ...baseBusiness, name: 'New Name' });
      }
      return Promise.reject(new Error(`unexpected ${path}`));
    }) as typeof apiRequest);

    const screen = await wrapQuery(<BusinessProfileForm />);
    await waitFor(() => expect(screen.getByTestId('profile-save')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText(catalogs.en.business.profile.name), 'New Name');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-save'));
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(`/businesses/${baseBusiness.id}`, {
        method: 'PATCH',
        body: { name: 'New Name' },
      });
    });

    screen.unmount();
  });
});

describe('More tab settings visibility', () => {
  it('hides Settings for STAFF', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'STAFF' };
    const screen = await wrapQuery(<BusinessMoreHome />);
    expect(screen.queryByTestId('more-settings')).toBeNull();
    expect(screen.getByTestId('more-profile')).toBeTruthy();
    expect(screen.getByTestId('more-client-mode')).toBeTruthy();
    screen.unmount();
  });

  it('shows Settings for OWNER', async () => {
    mockBusinessRef.current = { ...baseBusiness, myRole: 'OWNER' };
    const screen = await wrapQuery(<BusinessMoreHome />);
    expect(screen.getByTestId('more-settings')).toBeTruthy();
    screen.unmount();
  });
});

describe('BusinessStatusBanner', () => {
  it('resubmits a REJECTED business for OWNER/ADMIN', async () => {
    const onUpdated = jest.fn();
    const rejected: Business = {
      ...baseBusiness,
      status: 'REJECTED',
      rejectionReason: 'Fix the logo',
      myRole: 'OWNER',
    };
    jest.mocked(apiRequest).mockResolvedValue({
      ...rejected,
      status: 'PENDING_APPROVAL',
      rejectionReason: null,
    });

    const screen = await renderWithI18n(
      <BusinessStatusBanner business={rejected} onUpdated={onUpdated} />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('business-resubmit'));
    });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${rejected.id}/resubmit`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onUpdated).toHaveBeenCalled();
    });

    screen.unmount();
  });

  it('hides resubmit for STAFF', async () => {
    const screen = await renderWithI18n(
      <BusinessStatusBanner
        business={{ ...baseBusiness, status: 'REJECTED', myRole: 'STAFF' }}
        onUpdated={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('business-resubmit')).toBeNull();
    screen.unmount();
  });
});

describe('enterBusinessMode', () => {
  it('opens create when the user has no businesses without writing appMode', async () => {
    await enterBusinessMode({ push: mockPush, replace: mockReplace }, []);
    expect(writeAppMode).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(business)/new');
  });

  it('opens the only business directly', async () => {
    await enterBusinessMode({ push: mockPush, replace: mockReplace }, [
      {
        businessId: baseBusiness.id,
        name: 'Salon Ada',
        slug: 'salon-ada',
        status: 'PENDING_APPROVAL',
        role: 'OWNER',
        staffMemberId: null,
        logoUrl: null,
      },
    ]);
    expect(writeLastBusinessId).toHaveBeenCalledWith(baseBusiness.id);
    expect(mockReplace).toHaveBeenCalledWith(businessHref(baseBusiness.id));
  });

  it('forces the picker when requested', async () => {
    await enterBusinessMode(
      { push: mockPush, replace: mockReplace },
      [
        {
          businessId: baseBusiness.id,
          name: 'A',
          slug: 'a',
          status: 'APPROVED',
          role: 'OWNER',
          staffMemberId: null,
          logoUrl: null,
        },
        {
          businessId: '33333333-3333-4333-8333-333333333333',
          name: 'B',
          slug: 'b',
          status: 'APPROVED',
          role: 'ADMIN',
          staffMemberId: null,
          logoUrl: null,
        },
      ],
      { forcePick: true },
    );
    expect(mockReplace).toHaveBeenCalledWith('/(business)/pick');
  });
});

describe('enterClientMode', () => {
  it('persists client mode and returns to account', async () => {
    await enterClientMode({ replace: mockReplace });
    expect(writeAppMode).toHaveBeenCalledWith('client');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/account');
  });
});
