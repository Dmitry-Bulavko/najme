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

    const demoted = await request(app.getHttpServer())
      .patch(`/api/v1/businesses/${business.id}/members/${accepted.body.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('Content-Type', 'application/json')
      .send({ role: 'ADMIN' });
    expect(demoted.status).toBe(200);

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
});
