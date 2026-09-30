# #77 — Add invitations and member management API

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/77
- Status: Implemented
- Related: ADR-0011, ADR-0013, `docs/architecture/data-model.md` (Roles, Invitation), #74

## Goal

Owners/admins invite colleagues by email link (7-day TTL, email must match on accept) and manage
memberships without leaving a business without an OWNER. STAFF memberships always link a staff
member.

## Approach

- Prisma `Invitation` + partial unique `(business_id, email) WHERE status = 'PENDING'`.
- Token scheme identical to email/reset (ADR-0011): 32 bytes base64url, SHA-256 at rest.
- Nest module `invitations/` for invite CRUD + public preview/accept; member list/patch/delete/leave
  live in the same module (business-scoped under `/businesses/:businessId/members`).
- Invitation email via existing `MailService` (`businessInvitation` in `emails` namespace).
- Atomic accept: conditional `UPDATE … WHERE status = PENDING AND expires_at > now`.

## Changes

| Area / path        | Change                                                       |
| ------------------ | ------------------------------------------------------------ |
| contracts          | invitation + member schemas; new error codes                 |
| prisma             | `Invitation`, `InvitationStatus`; migration + partial unique |
| api `invitations/` | controllers + service; mail template                         |
| i18n               | `errors.*`, `emails.businessInvitation` (en/me/ru/tr)        |

### Contracts / API

- `POST/GET /businesses/:id/invitations`, `POST …/invitations/:id/resend`, `DELETE …/invitations/:id`
- `GET /invitations/preview?token=` (public), `POST /invitations/accept` (auth)
- `GET/PATCH/DELETE /businesses/:id/members/:membershipId`, `POST …/leave`

### Data model

`Invitation` as in data-model.md. No deletes; status lifecycle only.

### UI and i18n

API only. Email + error strings in four locales.

## Test plan

- Unit: email mask, token hash, expire-stale helper, LAST_OWNER guard.
- e2e: invite happy path + accept; OWNER-only invite OWNER; STAFF staffMemberId rules; conflicts;
  preview/accept errors; member role changes; leave; authz matrix; resend throttle.

## Risks and open questions

- Concurrent accepts covered by conditional update.
- Web accept page is out of scope (#84).

## Implementation notes

- STAFF `staffMemberId` rules are enforced in `InvitationsService` (422 `VALIDATION_FAILED`), not
  via zod `superRefine`, so the create pipe keeps a plain object schema.
- Accept uses `updateMany` with `status = PENDING AND expires_at > now` inside a transaction;
  unique membership collisions map to 409 `ALREADY_MEMBER`.
- Resend is throttled (3/min); preview 30/min; accept 10/min. Invitation locale is not persisted —
  resend emails use `en`.
- Fake-mailer e2e covers invite/preview/accept, OWNER-only invite, STAFF link, conflicts,
  LAST_OWNER, revoke, resend token rotation, and member PATCH/DELETE authz.
