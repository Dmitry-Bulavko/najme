import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AcceptInvitationRequest,
  BusinessMember,
  CreateInvitationRequest,
  Invitation,
  InvitationPreviewResponse,
  MembershipRole,
  UpdateMemberRequest,
} from '@najme/contracts';
import { INVITATION_TTL_DAYS } from '@najme/contracts';
import { isLocale, type Locale } from '@najme/i18n';
import { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../common/clock.js';
import { apiError } from '../common/errors/api-error.js';
import { newId } from '../common/id.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ObjectStorage } from '../storage/object-storage.js';
import { normalizeEmail } from '../users/users.service.js';
import { hashInvitationToken, issueInvitationToken, maskEmail } from './invitation-token.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly mail: MailService,
    private readonly storage: ObjectStorage,
  ) {}

  async create(
    businessId: string,
    actor: { userId: string; role: MembershipRole },
    input: CreateInvitationRequest,
  ): Promise<Invitation> {
    if (input.role === 'OWNER' && actor.role !== 'OWNER') {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only an owner may invite an owner.');
    }

    if (input.role === 'STAFF' && !input.staffMemberId) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'staffMemberId is required when role is STAFF.',
      );
    }
    if (input.role !== 'STAFF' && input.staffMemberId !== undefined) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'staffMemberId is only allowed when role is STAFF.',
      );
    }

    const email = normalizeEmail(input.email);
    const now = this.clock.now();
    await this.expireStalePending(businessId, email, now);

    const existingMember = await this.prisma.membership.findFirst({
      where: { businessId, user: { email, deletedAt: null } },
      select: { id: true },
    });
    if (existingMember) {
      throw apiError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', 'User is already a member.');
    }

    const pending = await this.prisma.invitation.findFirst({
      where: { businessId, email, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw apiError(
        HttpStatus.CONFLICT,
        'INVITATION_EXISTS',
        'A pending invitation already exists.',
      );
    }

    let staffMemberId: string | null = null;
    if (input.role === 'STAFF') {
      staffMemberId = await this.requireUnlinkedStaff(businessId, input.staffMemberId!);
    }

    const locale = (input.locale ?? 'en') as Locale;
    const { raw, hash } = issueInvitationToken();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS);
    try {
      const row = await this.prisma.invitation.create({
        data: {
          id: newId(),
          businessId,
          email,
          role: input.role,
          staffMemberId,
          invitedByUserId: actor.userId,
          tokenHash: hash,
          status: 'PENDING',
          locale,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
      });
      await this.queueInvitationEmail(row.id, raw, locale);
      return this.toInvitation(row, now);
    } catch (err) {
      if (isUniqueViolation(err, 'invitations_business_id_email_pending_key')) {
        throw apiError(
          HttpStatus.CONFLICT,
          'INVITATION_EXISTS',
          'A pending invitation already exists.',
        );
      }
      throw err;
    }
  }

  async list(businessId: string): Promise<Invitation[]> {
    const now = this.clock.now();
    await this.prisma.invitation.updateMany({
      where: { businessId, status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', updatedAt: now },
    });
    const rows = await this.prisma.invitation.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toInvitation(row, now));
  }

  async resend(businessId: string, invitationId: string): Promise<Invitation> {
    const now = this.clock.now();
    const existing = await this.prisma.invitation.findFirst({
      where: { id: invitationId, businessId },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Invitation not found.');
    }
    // Include stale PENDING (past expiresAt): rotate token + expiry so Resend still works.
    if (existing.status !== 'PENDING') {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UNPROCESSABLE_ENTITY',
        'Invitation is not pending.',
      );
    }

    const { raw, hash } = issueInvitationToken();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS);
    const locale = parseStoredLocale(existing.locale);
    const row = await this.prisma.invitation.update({
      where: { id: existing.id },
      data: { tokenHash: hash, expiresAt, updatedAt: now },
    });
    await this.queueInvitationEmail(row.id, raw, locale);
    return this.toInvitation(row, now);
  }

  async revoke(businessId: string, invitationId: string): Promise<void> {
    const now = this.clock.now();
    const existing = await this.prisma.invitation.findFirst({
      where: { id: invitationId, businessId },
      select: { id: true, status: true, expiresAt: true },
    });
    if (!existing) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Invitation not found.');
    }
    if (existing.status !== 'PENDING') {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UNPROCESSABLE_ENTITY',
        'Invitation is not pending.',
      );
    }
    await this.prisma.invitation.update({
      where: { id: existing.id },
      data: { status: 'REVOKED', updatedAt: now },
    });
  }

  async preview(token: string): Promise<InvitationPreviewResponse> {
    const now = this.clock.now();
    const row = await this.prisma.invitation.findFirst({
      where: { tokenHash: hashInvitationToken(token) },
      include: {
        business: { select: { name: true, logoKey: true, deletedAt: true } },
        invitedBy: { select: { displayName: true } },
      },
    });
    if (!row || row.business.deletedAt) {
      throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_INVALID', 'This invitation is invalid.');
    }
    if (row.status === 'REVOKED' || row.status === 'ACCEPTED') {
      throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_INVALID', 'This invitation is invalid.');
    }
    if (row.status === 'EXPIRED' || row.expiresAt.getTime() <= now.getTime()) {
      if (row.status === 'PENDING') {
        await this.prisma.invitation.update({
          where: { id: row.id },
          data: { status: 'EXPIRED', updatedAt: now },
        });
      }
      throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_EXPIRED', 'This invitation has expired.');
    }
    return {
      businessName: row.business.name,
      logoUrl: this.storage.publicUrl(row.business.logoKey),
      role: row.role,
      inviterDisplayName: row.invitedBy.displayName,
      emailMasked: maskEmail(row.email),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async accept(userId: string, input: AcceptInvitationRequest): Promise<BusinessMember> {
    const now = this.clock.now();
    const tokenHash = hashInvitationToken(input.token);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const invitation = await this.prisma.invitation.findFirst({
      where: { tokenHash },
      select: {
        id: true,
        businessId: true,
        email: true,
        role: true,
        staffMemberId: true,
        status: true,
        expiresAt: true,
        business: { select: { deletedAt: true } },
      },
    });
    if (!invitation || invitation.business.deletedAt) {
      throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_INVALID', 'This invitation is invalid.');
    }
    // Status/expiry before email mismatch so a revoked token does not ask to switch accounts.
    if (invitation.status === 'REVOKED' || invitation.status === 'ACCEPTED') {
      throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_INVALID', 'This invitation is invalid.');
    }
    if (invitation.status === 'EXPIRED' || invitation.expiresAt.getTime() <= now.getTime()) {
      if (invitation.status === 'PENDING') {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED', updatedAt: now },
        });
      }
      throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_EXPIRED', 'This invitation has expired.');
    }
    if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
      throw apiError(
        HttpStatus.FORBIDDEN,
        'INVITATION_EMAIL_MISMATCH',
        'Sign in with the invited email address.',
      );
    }

    const already = await this.prisma.membership.findFirst({
      where: { businessId: invitation.businessId, userId },
      select: { id: true },
    });
    if (already) {
      throw apiError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', 'User is already a member.');
    }

    if (invitation.role === 'STAFF') {
      if (!invitation.staffMemberId) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Staff link is missing.',
        );
      }
      await this.requireUnlinkedStaff(invitation.businessId, invitation.staffMemberId);
    }

    const membershipId = newId();
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            status: 'PENDING',
            expiresAt: { gt: now },
          },
          data: { status: 'ACCEPTED', acceptedAt: now, updatedAt: now },
        });
        if (claimed.count !== 1) {
          throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_INVALID', 'This invitation is invalid.');
        }
        await tx.membership.create({
          data: {
            id: membershipId,
            userId,
            businessId: invitation.businessId,
            role: invitation.role,
            staffMemberId: invitation.role === 'STAFF' ? invitation.staffMemberId : null,
            createdAt: now,
            updatedAt: now,
          },
        });
        if (user.emailVerifiedAt === null) {
          await tx.user.update({
            where: { id: userId },
            data: { emailVerifiedAt: now, updatedAt: now },
          });
        }
      });
    } catch (err) {
      if (isUniqueViolation(err, 'memberships_user_id_business_id_key')) {
        throw apiError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', 'User is already a member.');
      }
      if (isUniqueViolation(err, 'memberships_staff_member_id_key')) {
        throw apiError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'VALIDATION_FAILED',
          'Staff member is already linked to a membership.',
        );
      }
      throw err;
    }

    return this.getMember(invitation.businessId, membershipId);
  }

  async listMembers(businessId: string): Promise<BusinessMember[]> {
    const rows = await this.prisma.membership.findMany({
      where: { businessId },
      include: { user: { select: { email: true, displayName: true, deletedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.filter((row) => row.user.deletedAt === null).map((row) => this.toMember(row));
  }

  async updateMember(
    businessId: string,
    membershipId: string,
    actor: { userId: string; role: MembershipRole },
    input: UpdateMemberRequest,
  ): Promise<BusinessMember> {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, businessId },
    });
    if (!target) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Member not found.');
    }

    const nextRole = input.role ?? target.role;

    if (
      input.role !== undefined &&
      (input.role === 'OWNER' || target.role === 'OWNER') &&
      actor.role !== 'OWNER'
    ) {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only an owner may change owner roles.');
    }

    // Keep the existing staff link unless the caller sets staffMemberId explicitly.
    let nextStaffId =
      input.staffMemberId !== undefined ? input.staffMemberId : target.staffMemberId;

    if (nextStaffId !== null && nextStaffId !== target.staffMemberId) {
      // Cross-tenant and already-linked ids → 422 for any role (API-STD).
      nextStaffId = await this.requireUnlinkedStaff(businessId, nextStaffId);
    }

    if (nextRole === 'STAFF' && !nextStaffId) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'STAFF memberships require a linked staff member.',
      );
    }

    const now = this.clock.now();
    const demotingOwner = target.role === 'OWNER' && nextRole !== 'OWNER';

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId}::uuid FOR UPDATE`;
      if (demotingOwner) {
        await this.assertNotLastOwnerTx(tx, businessId);
      }
      await tx.membership.update({
        where: { id: target.id },
        data: {
          role: nextRole,
          staffMemberId: nextStaffId,
          updatedAt: now,
        },
      });
    });
    return this.getMember(businessId, target.id);
  }

  async removeMember(
    businessId: string,
    membershipId: string,
    actor: { userId: string; role: MembershipRole },
  ): Promise<void> {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, businessId },
    });
    if (!target) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Member not found.');
    }
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only an owner may remove an owner.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId}::uuid FOR UPDATE`;
      if (target.role === 'OWNER') {
        await this.assertNotLastOwnerTx(tx, businessId);
      }
      await tx.membership.delete({ where: { id: target.id } });
    });
  }

  async leave(businessId: string, userId: string): Promise<void> {
    const target = await this.prisma.membership.findFirst({
      where: { businessId, userId },
    });
    if (!target) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Membership not found.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM businesses WHERE id = ${businessId}::uuid FOR UPDATE`;
      if (target.role === 'OWNER') {
        await this.assertNotLastOwnerTx(tx, businessId);
      }
      await tx.membership.delete({ where: { id: target.id } });
    });
  }

  private async queueInvitationEmail(
    invitationId: string,
    rawToken: string,
    locale: Locale,
  ): Promise<void> {
    this.mail.defer('businessInvitation', null, async () => {
      const row = await this.prisma.invitation.findFirst({
        where: { id: invitationId },
        include: {
          business: { select: { name: true } },
          invitedBy: { select: { displayName: true } },
        },
      });
      if (!row || row.status !== 'PENDING') return;
      await this.mail.sendInvitation(
        { userId: null, email: row.email, locale },
        {
          token: rawToken,
          businessName: row.business.name,
          inviterName: row.invitedBy.displayName ?? '',
          role: row.role,
        },
      );
    });
  }

  private async expireStalePending(businessId: string, email: string, now: Date): Promise<void> {
    await this.prisma.invitation.updateMany({
      where: { businessId, email, status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', updatedAt: now },
    });
  }

  private async requireUnlinkedStaff(businessId: string, staffMemberId: string): Promise<string> {
    const staff = await this.prisma.staffMember.findFirst({
      where: { id: staffMemberId, businessId, deletedAt: null },
      select: { id: true, membership: { select: { id: true } } },
    });
    if (!staff) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'Staff member not found in this business.',
      );
    }
    if (staff.membership) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'Staff member is already linked to a membership.',
      );
    }
    return staff.id;
  }

  private async assertNotLastOwnerTx(
    tx: Prisma.TransactionClient,
    businessId: string,
  ): Promise<void> {
    const owners = await tx.membership.count({
      where: { businessId, role: 'OWNER' },
    });
    if (owners <= 1) {
      throw apiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'LAST_OWNER',
        'A business must keep at least one owner.',
      );
    }
  }

  private async getMember(businessId: string, membershipId: string): Promise<BusinessMember> {
    const row = await this.prisma.membership.findFirst({
      where: { id: membershipId, businessId },
      include: { user: { select: { email: true, displayName: true, deletedAt: true } } },
    });
    if (!row || row.user.deletedAt) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Member not found.');
    }
    return this.toMember(row);
  }

  private toInvitation(
    row: {
      id: string;
      businessId: string;
      email: string;
      role: MembershipRole;
      staffMemberId: string | null;
      invitedByUserId: string;
      status: Invitation['status'];
      expiresAt: Date;
      acceptedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    now: Date,
  ): Invitation {
    const status =
      row.status === 'PENDING' && row.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : row.status;
    return {
      id: row.id,
      businessId: row.businessId,
      email: row.email,
      role: row.role,
      staffMemberId: row.staffMemberId,
      invitedByUserId: row.invitedByUserId,
      status,
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMember(row: {
    id: string;
    businessId: string;
    userId: string;
    role: MembershipRole;
    staffMemberId: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: { email: string; displayName: string | null };
  }): BusinessMember {
    return {
      id: row.id,
      businessId: row.businessId,
      userId: row.userId,
      email: row.user.email,
      displayName: row.user.displayName,
      role: row.role,
      staffMemberId: row.staffMemberId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function parseStoredLocale(value: string): Locale {
  return isLocale(value) ? value : 'en';
}

function isUniqueViolation(err: unknown, constraint: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return false;
  }
  const meta = JSON.stringify(err.meta ?? {});
  return meta.includes(constraint);
}
