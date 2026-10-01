import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business, BusinessMember, Invitation, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamView } from './team-view';

const apiRequest = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };
const replace = vi.fn();
const invalidateMyBusinesses = vi.fn();
const clearLastBusinessId = vi.fn();
const reloadBusiness = vi.fn(async () => undefined);

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toast.success(...args),
    error: (...args: unknown[]) => toast.error(...args),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/en/business/11111111-1111-4111-8111-111111111111/team',
}));

vi.mock('@/lib/api/client', () => {
  class ApiError extends Error {
    code: string;
    status: number;
    details?: Record<string, unknown>;
    constructor(code: string, message: string, status = 500, details?: Record<string, unknown>) {
      super(message);
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }
  return {
    ApiError,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
  };
});

vi.mock('@/features/business/use-my-businesses', () => ({
  useInvalidateMyBusinesses: () => invalidateMyBusinesses,
}));

vi.mock('@/features/business/last-business', () => ({
  clearLastBusinessId: (...args: unknown[]) => clearLastBusinessId(...args),
}));

let listBusiness: Business;
const businessListeners = new Set<() => void>();

function emitBusiness() {
  for (const listener of businessListeners) listener();
}

vi.mock('@/features/business/business-shell', () => ({
  useBusinessContext: () => {
    const business = useSyncExternalStore(
      (onStoreChange) => {
        businessListeners.add(onStoreChange);
        return () => businessListeners.delete(onStoreChange);
      },
      () => listBusiness,
      () => listBusiness,
    );
    return { business, setBusiness: vi.fn(), reload: reloadBusiness };
  },
}));

const me = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'owner@example.com',
  emailVerified: true,
  displayName: 'Owner',
  avatarUrl: null,
  locale: 'en' as const,
  hasPassword: true,
  isPlatformAdmin: false,
};

vi.mock('@/features/auth/session-context', () => ({
  useSession: () => ({
    state: 'authenticated' as const,
    me,
    signIn: vi.fn(),
    signOut: vi.fn(),
    updateMe: vi.fn(),
  }),
}));

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Salon Ada',
    slug: 'salon-ada',
    categoryId: '22222222-2222-4222-8222-222222222222',
    description: null,
    timezone: 'Europe/Podgorica',
    city: 'PODGORICA',
    address: null,
    contactPhone: null,
    contactEmail: null,
    logoUrl: null,
    coverUrl: null,
    confirmationMode: 'AUTO',
    cancellationWindowMinutes: 120,
    minBookingNoticeMinutes: 60,
    bookingHorizonDays: 60,
    status: 'APPROVED',
    rejectionReason: null,
    myRole: 'OWNER',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeMember(overrides: Partial<BusinessMember> = {}): BusinessMember {
  return {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    businessId: '11111111-1111-4111-8111-111111111111',
    userId: me.id,
    email: 'owner@example.com',
    displayName: 'Owner',
    role: 'OWNER',
    staffMemberId: null,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeStaff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    businessId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Ana',
    photoUrl: null,
    active: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    businessId: '11111111-1111-4111-8111-111111111111',
    email: 'new@example.com',
    role: 'ADMIN',
    staffMemberId: null,
    invitedByUserId: me.id,
    status: 'PENDING',
    expiresAt: '2026-10-08T10:00:00.000Z',
    acceptedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

function renderTeam() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TeamView />
    </NextIntlClientProvider>,
  );
}

function mockTeamData(opts?: {
  members?: BusinessMember[];
  invitations?: Invitation[];
  staff?: StaffMember[];
}) {
  const members = opts?.members ?? [makeMember()];
  const invitations = opts?.invitations ?? [];
  const staff = opts?.staff ?? [makeStaff()];
  apiRequest.mockImplementation(async (path: string) => {
    if (path.endsWith('/members')) return members;
    if (path.endsWith('/invitations')) return invitations;
    if (path.endsWith('/staff')) return staff;
    throw new Error(`unexpected GET ${path}`);
  });
}

describe('TeamView', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    replace.mockReset();
    invalidateMyBusinesses.mockReset();
    clearLastBusinessId.mockReset();
    reloadBusiness.mockReset();
    listBusiness = makeBusiness();
    emitBusiness();
  });

  it('shows members with role badges and linked staff', async () => {
    mockTeamData({
      members: [
        makeMember(),
        makeMember({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          email: 'admin@example.com',
          displayName: 'Admin User',
          role: 'ADMIN',
          staffMemberId: '33333333-3333-4333-8333-333333333333',
        }),
      ],
    });
    renderTeam();
    expect(await screen.findByText('Admin User')).toBeTruthy();
    expect(screen.getByText('admin@example.com')).toBeTruthy();
    expect(
      screen.getByText(catalogs.en.business.team.linkedStaff.replace('{name}', 'Ana')),
    ).toBeTruthy();
    expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
  });

  it('hides OWNER role option for ADMIN actors', async () => {
    listBusiness = makeBusiness({ myRole: 'ADMIN' });
    emitBusiness();
    mockTeamData({
      members: [
        makeMember({
          userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          email: 'other-owner@example.com',
          displayName: 'Other Owner',
          role: 'OWNER',
        }),
        makeMember({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          userId: me.id,
          email: 'admin@example.com',
          displayName: 'Me Admin',
          role: 'ADMIN',
        }),
      ],
    });
    renderTeam();
    expect(await screen.findByText('Me Admin')).toBeTruthy();
    const roleTrigger = screen.getByRole('combobox', {
      name: catalogs.en.business.team.roleSelectNamed.replace('{name}', 'Me Admin'),
    });
    await userEvent.click(roleTrigger);
    expect(screen.queryByRole('option', { name: 'Owner' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Admin' })).toBeTruthy();
  });

  it('ADMIN actor sees no role combobox or Remove on an OWNER row', async () => {
    listBusiness = makeBusiness({ myRole: 'ADMIN' });
    emitBusiness();
    mockTeamData({
      members: [
        makeMember({
          userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          email: 'other-owner@example.com',
          displayName: 'Sara Staff',
          role: 'OWNER',
        }),
        makeMember({
          id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          userId: me.id,
          email: 'admin@example.com',
          displayName: 'Me Admin',
          role: 'ADMIN',
        }),
      ],
    });
    renderTeam();
    expect(await screen.findByText('Sara Staff')).toBeTruthy();
    expect(
      screen.queryByRole('combobox', {
        name: catalogs.en.business.team.roleSelectNamed.replace('{name}', 'Sara Staff'),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: catalogs.en.business.team.removeNamed.replace('{name}', 'Sara Staff'),
      }),
    ).toBeNull();
  });

  it('maps LAST_OWNER on leave', async () => {
    const { ApiError } = await import('@/lib/api/client');
    mockTeamData();
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (!init?.method || init.method === 'GET') {
        if (path.endsWith('/members')) return [makeMember()];
        if (path.endsWith('/invitations')) return [];
        if (path.endsWith('/staff')) return [];
      }
      if (path.endsWith('/leave') && init?.method === 'POST') {
        throw new ApiError('LAST_OWNER', 'last', 422);
      }
      throw new Error(`unexpected ${init?.method} ${path}`);
    });
    renderTeam();
    expect(
      await screen.findByRole('button', { name: catalogs.en.business.team.leave }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: catalogs.en.business.team.leave }));
    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.team.leaveConfirm }),
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(catalogs.en.errors.LAST_OWNER);
    });
  });

  it('opens invite dialog and creates an invitation without staffMemberId for ADMIN', async () => {
    const created = makeInvitation();
    let postedBody: unknown;
    mockTeamData();
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (!init?.method || init.method === 'GET') {
          if (path.endsWith('/members')) return [makeMember()];
          if (path.endsWith('/invitations')) return [];
          if (path.endsWith('/staff')) return [makeStaff()];
        }
        if (path.endsWith('/invitations') && init?.method === 'POST') {
          postedBody = init.body;
          return created;
        }
        throw new Error(`unexpected ${init?.method} ${path}`);
      },
    );
    renderTeam();
    await userEvent.click(
      await screen.findByRole('button', { name: catalogs.en.business.team.invite }),
    );
    expect(screen.getByText(catalogs.en.business.team.inviteDialogTitle)).toBeTruthy();
    expect(screen.queryByLabelText(catalogs.en.business.team.inviteStaff)).toBeNull();
    await userEvent.type(
      screen.getByLabelText(catalogs.en.business.team.inviteEmail),
      'new@example.com',
    );
    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.team.inviteSubmit }),
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.team.invitedToast);
    });
    expect(postedBody).toMatchObject({ email: 'new@example.com', role: 'ADMIN', locale: 'en' });
    expect(postedBody).not.toHaveProperty('staffMemberId');
    expect(await screen.findByText('new@example.com')).toBeTruthy();
  });

  it('resends and revokes pending invitations with named buttons', async () => {
    const pending = makeInvitation();
    mockTeamData({ invitations: [pending] });
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (!init?.method || init.method === 'GET') {
        if (path.endsWith('/members')) return [makeMember()];
        if (path.endsWith('/invitations')) return [pending];
        if (path.endsWith('/staff')) return [];
      }
      if (path.endsWith('/resend') && init?.method === 'POST') {
        return { ...pending, expiresAt: '2026-10-15T10:00:00.000Z' };
      }
      if (path.includes(`/invitations/${pending.id}`) && init?.method === 'DELETE') {
        return undefined;
      }
      throw new Error(`unexpected ${init?.method} ${path}`);
    });
    renderTeam();
    expect(await screen.findByText(pending.email)).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', {
        name: catalogs.en.business.team.resendNamed.replace('{email}', pending.email),
      }),
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.team.resentToast);
    });
    await userEvent.click(
      screen.getByRole('button', {
        name: catalogs.en.business.team.revokeNamed.replace('{email}', pending.email),
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.team.revokeConfirm }),
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.team.revokedToast);
    });
  });

  it('invite again posts locale and drops the expired row', async () => {
    const expired = makeInvitation({
      id: '55555555-5555-4555-8555-555555555555',
      status: 'EXPIRED',
      email: 'expired@example.com',
    });
    const created = makeInvitation({
      id: '66666666-6666-4666-8666-666666666666',
      email: 'expired@example.com',
      status: 'PENDING',
    });
    mockTeamData({ invitations: [expired] });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (!init?.method || init.method === 'GET') {
          if (path.endsWith('/members')) return [makeMember()];
          if (path.endsWith('/invitations')) return [expired];
          if (path.endsWith('/staff')) return [];
        }
        if (path.endsWith('/invitations') && init?.method === 'POST') {
          expect(init.body).toMatchObject({
            email: 'expired@example.com',
            role: 'ADMIN',
            locale: 'en',
          });
          return created;
        }
        throw new Error(`unexpected ${init?.method} ${path}`);
      },
    );
    renderTeam();
    expect(await screen.findByText('expired@example.com')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', {
        name: catalogs.en.business.team.inviteAgainNamed.replace('{email}', 'expired@example.com'),
      }),
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.team.inviteAgainToast);
    });
    // Expired section should no longer list that email (pending takes it).
    const expiredHeading = screen.getByText(catalogs.en.business.team.expiredHeading);
    const expiredSection = expiredHeading.parentElement;
    expect(expiredSection).toBeTruthy();
    expect(within(expiredSection!).queryByText('expired@example.com')).toBeNull();
  });

  it('requires staff when inviting as STAFF and does not POST', async () => {
    mockTeamData();
    const postSpy = vi.fn();
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (!init?.method || init.method === 'GET') {
          if (path.endsWith('/members')) return [makeMember()];
          if (path.endsWith('/invitations')) return [];
          if (path.endsWith('/staff')) return [makeStaff()];
        }
        if (path.endsWith('/invitations') && init?.method === 'POST') {
          postSpy(init.body);
          return makeInvitation();
        }
        throw new Error(`unexpected ${init?.method} ${path}`);
      },
    );
    renderTeam();
    await userEvent.click(
      await screen.findByRole('button', { name: catalogs.en.business.team.invite }),
    );
    await userEvent.type(
      screen.getByLabelText(catalogs.en.business.team.inviteEmail),
      'staff@example.com',
    );
    await userEvent.click(
      screen.getByRole('combobox', { name: catalogs.en.business.team.inviteRole }),
    );
    await userEvent.click(screen.getByRole('option', { name: 'Staff' }));
    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.team.inviteSubmit }),
    );
    expect(await screen.findByText(catalogs.en.business.team.errors.staffRequired)).toBeTruthy();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('PATCHes member role/staff link and removes a member', async () => {
    const admin = makeMember({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'ADMIN',
      staffMemberId: null,
    });
    const staff = makeStaff();
    const updated = { ...admin, staffMemberId: staff.id };
    mockTeamData({ members: [makeMember(), admin], staff: [staff] });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (!init?.method || init.method === 'GET') {
          if (path.endsWith('/members')) return [makeMember(), admin];
          if (path.endsWith('/invitations')) return [];
          if (path.endsWith('/staff')) return [staff];
        }
        if (path.includes(`/members/${admin.id}`) && init?.method === 'PATCH') {
          expect(init.body).toMatchObject({ staffMemberId: staff.id });
          return updated;
        }
        if (path.includes(`/members/${admin.id}`) && init?.method === 'DELETE') {
          return undefined;
        }
        throw new Error(`unexpected ${init?.method} ${path}`);
      },
    );
    renderTeam();
    expect(await screen.findByText('Admin User')).toBeTruthy();

    await userEvent.click(
      screen.getByRole('combobox', {
        name: catalogs.en.business.team.linkStaffNamed.replace('{name}', 'Admin User'),
      }),
    );
    await userEvent.click(screen.getByRole('option', { name: 'Ana' }));
    await userEvent.click(
      screen.getByRole('button', {
        name: catalogs.en.business.team.saveMemberNamed.replace('{name}', 'Admin User'),
      }),
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.team.memberSavedToast);
    });

    await userEvent.click(
      screen.getByRole('button', {
        name: catalogs.en.business.team.removeNamed.replace('{name}', 'Admin User'),
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.team.removeConfirm }),
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.team.removedToast);
    });
    expect(screen.queryByText('Admin User')).toBeNull();
  });

  it('keeps Linked staff controlled when clearing to None after a prior pick', async () => {
    const bob = makeStaff({
      id: '55555555-5555-4555-8555-555555555555',
      displayName: 'Bob',
    });
    const ana = makeStaff();
    const admin = makeMember({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'ADMIN',
      staffMemberId: bob.id,
    });
    let patched: unknown;
    mockTeamData({ members: [makeMember(), admin], staff: [bob, ana] });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (!init?.method || init.method === 'GET') {
          if (path.endsWith('/members')) return [makeMember(), admin];
          if (path.endsWith('/invitations')) return [];
          if (path.endsWith('/staff')) return [bob, ana];
        }
        if (path.includes(`/members/${admin.id}`) && init?.method === 'PATCH') {
          patched = init.body;
          return { ...admin, staffMemberId: null };
        }
        throw new Error(`unexpected ${init?.method} ${path}`);
      },
    );
    renderTeam();
    expect(await screen.findByText('Admin User')).toBeTruthy();

    const staffSelect = screen.getByRole('combobox', {
      name: catalogs.en.business.team.linkStaffNamed.replace('{name}', 'Admin User'),
    });
    expect(staffSelect).toHaveTextContent('Bob');

    await userEvent.click(staffSelect);
    await userEvent.click(screen.getByRole('option', { name: 'Ana' }));
    expect(staffSelect).toHaveTextContent('Ana');

    await userEvent.click(staffSelect);
    await userEvent.click(
      screen.getByRole('option', { name: catalogs.en.business.team.linkStaffNone }),
    );
    expect(staffSelect).toHaveTextContent(catalogs.en.business.team.linkStaffNone);

    await userEvent.click(
      screen.getByRole('button', {
        name: catalogs.en.business.team.saveMemberNamed.replace('{name}', 'Admin User'),
      }),
    );
    await waitFor(() => {
      expect(patched).toEqual({ staffMemberId: null });
    });
  });

  it('maps INVITATION_EXISTS and ALREADY_MEMBER onto the email field', async () => {
    const { ApiError } = await import('@/lib/api/client');
    mockTeamData();
    let invitePosts = 0;
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (!init?.method || init.method === 'GET') {
        if (path.endsWith('/members')) return [makeMember()];
        if (path.endsWith('/invitations')) return [];
        if (path.endsWith('/staff')) return [];
      }
      if (path.endsWith('/invitations') && init?.method === 'POST') {
        invitePosts += 1;
        if (invitePosts === 1) {
          throw new ApiError('INVITATION_EXISTS', 'exists', 409);
        }
        throw new ApiError('ALREADY_MEMBER', 'member', 409);
      }
      throw new Error(`unexpected ${init?.method} ${path}`);
    });
    renderTeam();
    await userEvent.click(
      await screen.findByRole('button', { name: catalogs.en.business.team.invite }),
    );
    await userEvent.type(
      screen.getByLabelText(catalogs.en.business.team.inviteEmail),
      'dup@example.com',
    );
    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.team.inviteSubmit }),
    );
    expect(await screen.findByText(catalogs.en.business.team.errors.invitationExists)).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.team.inviteSubmit }),
    );
    expect(await screen.findByText(catalogs.en.business.team.errors.alreadyMember)).toBeTruthy();
  });

  it('shows forbidden for STAFF role', async () => {
    listBusiness = makeBusiness({ myRole: 'STAFF' });
    emitBusiness();
    renderTeam();
    expect(await screen.findByText(catalogs.en.business.team.forbidden)).toBeTruthy();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
