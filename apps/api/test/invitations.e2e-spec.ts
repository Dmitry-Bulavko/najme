import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { Clock, FixedClock } from '../src/common/clock.js';
import { Mailer } from '../src/mail/mailer.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  BusinessTestTracker,
  addMember,
  createBusiness,
  createUser,
  expectBusinessAuthz,
} from './support/business-factories.js';
import { FakeMailer, tokenFromEmail } from './support/fake-mailer.js';

const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

describe('Invitations and members (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tracker: BusinessTestTracker;
  let mailer: FakeMailer;
  let mail: MailService;
  let clock: FixedClock;

  beforeAll(async () => {
    mailer = new FakeMailer();
    clock = new FixedClock(FIXED_NOW);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Mailer)
      .useValue(mailer)
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
  });

  beforeEach(() => {
    tracker = new BusinessTestTracker();
    mailer.sent.length = 0;
    clock.set(FIXED_NOW);
  });

  afterEach(async () => {
    await mail.idle();
    await tracker.cleanup(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('invites by email, previews, accepts, and lists the new member', async () => {
    const owner = await createUser(app, tracker, 'inv-owner');
    const business = await createBusiness(app, tracker, owner);
    const invitee = await createUser(app, tracker, 'inv-guest');

    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: invitee.email, role: 'ADMIN', locale: 'en' });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING');
    expect(created.body.email).toBe(invitee.email);

    await mail.idle();
    expect(mailer.to(invitee.email)).toHaveLength(1);
    const token = tokenFromEmail(mailer.to(invitee.email)[0]!.text);

    const preview = await request(app.getHttpServer()).get(
      `/api/v1/invitations/preview?token=${encodeURIComponent(token)}`,
    );
    expect(preview.status).toBe(200);
    expect(preview.body.businessName).toBeTruthy();
    expect(preview.body.emailMasked).toMatch(/\*\*\*/);
    expect(preview.body.emailMasked).not.toBe(invitee.email);

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token });
    expect(accepted.status).toBe(200);
    expect(accepted.body.role).toBe('ADMIN');
    expect(accepted.body.userId).toBe(invitee.id);

    const members = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(members.status).toBe(200);
    expect(members.body.some((m: { userId: string }) => m.userId === invitee.id)).toBe(true);
  });

  it('rejects ADMIN inviting OWNER and STAFF invite without staffMemberId', async () => {
    const owner = await createUser(app, tracker, 'own');
    const admin = await createUser(app, tracker, 'adm');
    const business = await createBusiness(app, tracker, owner);
    await addMember(app, business.id, admin.id, 'ADMIN');

    const forbidden = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: 'new-owner@example.com', role: 'OWNER' });
    expect(forbidden.status).toBe(403);

    const badStaff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: 'staff@example.com', role: 'STAFF' });
    expect(badStaff.status).toBe(422);
    expect(badStaff.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects email mismatch, duplicate member, and last-owner leave', async () => {
    const owner = await createUser(app, tracker, 'own2');
    const other = await createUser(app, tracker, 'other');
    const business = await createBusiness(app, tracker, owner);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: other.email, role: 'ADMIN' });
    expect(created.status).toBe(201);
    await mail.idle();
    const token = tokenFromEmail(mailer.to(other.email)[0]!.text);

    const mismatch = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token });
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');

    const accept = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token });
    expect(accept.status).toBe(200);

    const again = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: other.email, role: 'ADMIN' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_MEMBER');

    const leave = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/leave`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(leave.status).toBe(422);
    expect(leave.body.error.code).toBe('LAST_OWNER');
  });

  it('invites STAFF with an unlinked staff member and links on accept', async () => {
    const owner = await createUser(app, tracker, 'staff-own');
    const invitee = await createUser(app, tracker, 'staff-guest');
    const business = await createBusiness(app, tracker, owner);
    const staff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Bookable' });
    expect(staff.status).toBe(201);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: invitee.email, role: 'STAFF', staffMemberId: staff.body.id });
    expect(created.status).toBe(201);
    await mail.idle();
    const token = tokenFromEmail(mailer.to(invitee.email)[0]!.text);

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token });
    expect(accepted.status).toBe(200);
    expect(accepted.body.role).toBe('STAFF');
    expect(accepted.body.staffMemberId).toBe(staff.body.id);
  });

  it('enforces authz on invitation and member routes', async () => {
    await expectBusinessAuthz(app, tracker, {
      method: 'get',
      path: (id) => `/api/v1/businesses/${id}/invitations`,
      allowedRoles: ['OWNER', 'ADMIN'],
    });
    await expectBusinessAuthz(app, tracker, {
      method: 'get',
      path: (id) => `/api/v1/businesses/${id}/members`,
      allowedRoles: ['OWNER', 'ADMIN'],
    });

    // leave: outsider 404; STAFF succeeds when another OWNER remains.
    const owner = await createUser(app, tracker, 'leave-own');
    const staff = await createUser(app, tracker, 'leave-staff');
    const business = await createBusiness(app, tracker, owner);
    await addMember(app, business.id, staff.id, 'STAFF');
    const outsider = await createUser(app, tracker, 'leave-out');
    const denied = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/leave`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(denied.status).toBe(404);
    const left = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/leave`)
      .set('Authorization', `Bearer ${staff.accessToken}`);
    expect(left.status).toBe(204);
  });

  it('revokes an invitation and rejects accept afterwards', async () => {
    const owner = await createUser(app, tracker, 'rev-own');
    const invitee = await createUser(app, tracker, 'rev-guest');
    const business = await createBusiness(app, tracker, owner);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: invitee.email, role: 'ADMIN' });
    expect(created.status).toBe(201);
    await mail.idle();
    const token = tokenFromEmail(mailer.to(invitee.email)[0]!.text);

    const revoked = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/invitations/${created.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(revoked.status).toBe(204);

    const accept = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token });
    expect(accept.status).toBe(400);
    expect(accept.body.error.code).toBe('TOKEN_INVALID');
  });

  it('resends with a new token and manages member roles', async () => {
    const owner = await createUser(app, tracker, 'mgr-own');
    const admin = await createUser(app, tracker, 'mgr-adm');
    const invitee = await createUser(app, tracker, 'mgr-guest');
    const business = await createBusiness(app, tracker, owner);
    await addMember(app, business.id, admin.id, 'ADMIN');

    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: invitee.email, role: 'ADMIN' });
    expect(created.status).toBe(201);
    await mail.idle();
    const firstToken = tokenFromEmail(mailer.to(invitee.email)[0]!.text);

    const resent = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations/${created.body.id}/resend`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(resent.status).toBe(200);
    await mail.idle();
    expect(mailer.to(invitee.email)).toHaveLength(2);
    const secondToken = tokenFromEmail(mailer.to(invitee.email)[1]!.text);
    expect(secondToken).not.toBe(firstToken);

    const stale = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token: firstToken });
    expect(stale.status).toBe(400);
    expect(stale.body.error.code).toBe('TOKEN_INVALID');

    const accepted = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token: secondToken });
    expect(accepted.status).toBe(200);

    const promoteDenied = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/members/${accepted.body.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'OWNER' });
    expect(promoteDenied.status).toBe(403);

    const promoted = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/members/${accepted.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'OWNER' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.role).toBe('OWNER');

    const demoted = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/members/${accepted.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'ADMIN' });
    expect(demoted.status).toBe(200);
    expect(demoted.body.role).toBe('ADMIN');

    const staff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Linked' });
    expect(staff.status).toBe(201);

    const toStaff = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/members/${accepted.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'STAFF', staffMemberId: staff.body.id });
    expect(toStaff.status).toBe(200);
    expect(toStaff.body.staffMemberId).toBe(staff.body.id);

    const withoutStaff = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/members/${accepted.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'STAFF', staffMemberId: null });
    expect(withoutStaff.status).toBe(422);
    expect(withoutStaff.body.error.code).toBe('VALIDATION_FAILED');

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/businesses/${business.id}/members/${accepted.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(removed.status).toBe(204);

    const ownerMembership = (
      await request(app.getHttpServer())
        .get(`/api/v1/businesses/${business.id}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
    ).body.find((m: { userId: string }) => m.userId === owner.id);

    const demoteLast = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'ADMIN' });
    expect(demoteLast.status).toBe(422);
    expect(demoteLast.body.error.code).toBe('LAST_OWNER');
  });

  it('rejects a foreign staffMemberId on PATCH and keeps the staff link on role change', async () => {
    const ownerA = await createUser(app, tracker, 'ten-a');
    const coOwner = await createUser(app, tracker, 'ten-co');
    const ownerB = await createUser(app, tracker, 'ten-b');
    const categoryId = (await prisma.category.findFirstOrThrow({ select: { id: true } })).id;

    const withStaff = await request(app.getHttpServer())
      .post('/api/v1/businesses')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: `Linked ${Date.now()}`,
        categoryId,
        city: 'PODGORICA',
        ownerIsStaff: true,
      });
    expect(withStaff.status).toBe(201);
    tracker.businessIds.push(withStaff.body.id as string);
    await addMember(app, withStaff.body.id, coOwner.id, 'OWNER');

    const meBiz = await request(app.getHttpServer())
      .get('/api/v1/me/businesses')
      .set('Authorization', `Bearer ${ownerA.accessToken}`);
    const linked = meBiz.body.find(
      (b: { businessId: string }) => b.businessId === withStaff.body.id,
    );
    expect(linked?.staffMemberId).toBeTruthy();

    const members = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${withStaff.body.id}/members`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`);
    const ownerMembership = members.body.find((m: { userId: string }) => m.userId === ownerA.id);
    expect(ownerMembership.staffMemberId).toBe(linked.staffMemberId);

    const keepLink = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${withStaff.body.id}/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'ADMIN' });
    expect(keepLink.status).toBe(200);
    expect(keepLink.body.staffMemberId).toBe(linked.staffMemberId);

    const businessA = await createBusiness(app, tracker, ownerA);
    const businessB = await createBusiness(app, tracker, ownerB);
    const staffB = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${businessB.id}/staff`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Foreign' });
    expect(staffB.status).toBe(201);

    const admin = await createUser(app, tracker, 'ten-adm');
    await addMember(app, businessA.id, admin.id, 'ADMIN');
    const adminMembers = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${businessA.id}/members`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`);
    const adminMembership = adminMembers.body.find(
      (m: { userId: string }) => m.userId === admin.id,
    );

    const crossTenant = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${businessA.id}/members/${adminMembership.id}`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ staffMemberId: staffB.body.id });
    expect(crossTenant.status).toBe(422);
    expect(crossTenant.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('serializes concurrent OWNER demotions so one remains', async () => {
    const owner1 = await createUser(app, tracker, 'race-o1');
    const owner2 = await createUser(app, tracker, 'race-o2');
    const business = await createBusiness(app, tracker, owner1);
    await addMember(app, business.id, owner2.id, 'OWNER');

    const members = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/members`)
      .set('Authorization', `Bearer ${owner1.accessToken}`);
    const m1 = members.body.find((m: { userId: string }) => m.userId === owner1.id);
    const m2 = members.body.find((m: { userId: string }) => m.userId === owner2.id);

    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/businesses/${business.id}/members/${m1.id}`)
        .set('Authorization', `Bearer ${owner1.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ role: 'ADMIN' }),
      request(app.getHttpServer())
        .patch(`/api/v1/businesses/${business.id}/members/${m2.id}`)
        .set('Authorization', `Bearer ${owner2.accessToken}`)
        .set('Content-Type', 'application/json')
        .send({ role: 'ADMIN' }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 422]);
    const loser = r1.status === 422 ? r1 : r2;
    expect(loser.body.error.code).toBe('LAST_OWNER');

    const after = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/members`)
      .set('Authorization', `Bearer ${owner1.accessToken}`);
    const ownersLeft = after.body.filter((m: { role: string }) => m.role === 'OWNER');
    expect(ownersLeft).toHaveLength(1);
  });

  it('expires invitations via the clock, resends stale PENDING, and preserves locale', async () => {
    const owner = await createUser(app, tracker, 'ttl-own');
    const invitee = await createUser(app, tracker, 'ttl-guest');
    const business = await createBusiness(app, tracker, owner);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ email: invitee.email, role: 'ADMIN', locale: 'ru' });
    expect(created.status).toBe(201);
    await mail.idle();
    const first = mailer.to(invitee.email)[0]!;
    expect(first.subject).toMatch(/Вас пригласили|Najme/);
    expect(first.text).toContain('/ru/invitations/accept?token=');
    const oldToken = tokenFromEmail(first.text);

    clock.set(new Date(FIXED_NOW.getTime() + 8 * 24 * 60 * 60 * 1000));

    const previewExpired = await request(app.getHttpServer()).get(
      `/api/v1/invitations/preview?token=${encodeURIComponent(oldToken)}`,
    );
    expect(previewExpired.status).toBe(400);
    expect(previewExpired.body.error.code).toBe('TOKEN_EXPIRED');

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body[0].status).toBe('EXPIRED');

    // Flip back to PENDING with a past expiry to exercise stale-PENDING resend.
    await prisma.invitation.update({
      where: { id: created.body.id },
      data: {
        status: 'PENDING',
        expiresAt: new Date(FIXED_NOW.getTime() - 60_000),
      },
    });

    const resent = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations/${created.body.id}/resend`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(resent.status).toBe(200);
    expect(resent.body.status).toBe('PENDING');
    await mail.idle();
    const second = mailer.to(invitee.email)[1]!;
    expect(second.text).toContain('/ru/invitations/accept?token=');
    const newToken = tokenFromEmail(second.text);
    expect(newToken).not.toBe(oldToken);

    const accept = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ token: newToken });
    expect(accept.status).toBe(200);
  });

  it('rejects STAFF invite with a foreign or already-linked staff member', async () => {
    const owner = await createUser(app, tracker, 'stf-own');
    const other = await createUser(app, tracker, 'stf-oth');
    const business = await createBusiness(app, tracker, owner);
    const otherBiz = await createBusiness(app, tracker, other);
    const foreign = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${otherBiz.id}/staff`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Elsewhere' });
    expect(foreign.status).toBe(201);

    const badForeign = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        email: 'x@example.com',
        role: 'STAFF',
        staffMemberId: foreign.body.id,
      });
    expect(badForeign.status).toBe(422);

    const staff = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ displayName: 'Taken' });
    const linkedUser = await createUser(app, tracker, 'stf-link');
    await addMember(app, business.id, linkedUser.id, 'STAFF');
    await prisma.membership.updateMany({
      where: { businessId: business.id, userId: linkedUser.id },
      data: { staffMemberId: staff.body.id },
    });

    const badLinked = await request(app.getHttpServer())
      .post(`/api/v1/businesses/${business.id}/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({
        email: 'y@example.com',
        role: 'STAFF',
        staffMemberId: staff.body.id,
      });
    expect(badLinked.status).toBe(422);
  });
});
