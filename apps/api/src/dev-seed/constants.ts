/**
 * Fixed identities for the local/CI demo seed (#88). Emails and UUIDs are stable so
 * `db:seed` upserts instead of duplicating. Passwords are for development only —
 * documented in `docs/runbooks/local-dev.md`.
 */

export const DEV_SEED_PASSWORD = 'najme-dev-password';

export const DEV_SEED_EMAILS = {
  admin: 'admin@najme.dev',
  owner: 'owner@najme.dev',
  staff: 'staff@najme.dev',
  client: 'client@najme.dev',
} as const;

/** Hard-coded UUID v7-style ids (version nibble `7`) for idempotent upserts. */
export const DEV_SEED_IDS = {
  adminUser: '0188f088-0001-7000-8000-000000000001',
  ownerUser: '0188f088-0001-7000-8000-000000000002',
  staffUser: '0188f088-0001-7000-8000-000000000003',
  clientUser: '0188f088-0001-7000-8000-000000000004',
  adminIdentity: '0188f088-0002-7000-8000-000000000001',
  ownerIdentity: '0188f088-0002-7000-8000-000000000002',
  staffIdentity: '0188f088-0002-7000-8000-000000000003',
  clientIdentity: '0188f088-0002-7000-8000-000000000004',
  demoBusiness: '0188f088-0003-7000-8000-000000000001',
  pendingBusiness: '0188f088-0003-7000-8000-000000000002',
  demoOwnerMembership: '0188f088-0004-7000-8000-000000000001',
  demoStaffMembership: '0188f088-0004-7000-8000-000000000002',
  pendingOwnerMembership: '0188f088-0004-7000-8000-000000000003',
  staffAna: '0188f088-0005-7000-8000-000000000001',
  staffMarko: '0188f088-0005-7000-8000-000000000002',
  serviceHaircut: '0188f088-0006-7000-8000-000000000001',
  serviceColor: '0188f088-0006-7000-8000-000000000002',
  serviceConsult: '0188f088-0006-7000-8000-000000000003',
  customFieldNotes: '0188f088-0007-7000-8000-000000000001',
} as const;

export const DEMO_SALON = {
  name: 'Demo Salon',
  slug: 'demo-salon',
  city: 'PODGORICA' as const,
  categorySlug: 'hair',
};

export const PENDING_STUDIO = {
  name: 'Pending Studio',
  slug: 'pending-studio',
  city: 'BUDVA' as const,
  categorySlug: 'beauty',
};

/** Monday–Friday morning and afternoon windows (minutes from midnight). */
export const DEMO_WEEKDAY_INTERVALS = [
  { startMinute: 9 * 60, endMinute: 13 * 60 },
  { startMinute: 14 * 60, endMinute: 18 * 60 },
] as const;

export const DEMO_WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
