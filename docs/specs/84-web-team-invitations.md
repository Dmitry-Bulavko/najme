# #84 — Build web team management and the invitation-accept page

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/84
- Status: Implemented
- Related: #77, ADR-0011, ADR-0013, `docs/specs/77-invitations-members.md`

## Goal

OWNER/ADMIN manage members and invitations on `/business/[businessId]/team`. Invitees open
`/[locale]/invitations/accept?token=` to preview and accept (or sign in first), then land in
business mode for that business.

## Approach

- Feature module `apps/web/src/features/team/` with thin App Router pages (same pattern as staff).
- Reuse `useEmailLinkToken` + `TOKEN_LINK_PATH` Referrer-Policy (ADR-0011); keep the invite token in
  `sessionStorage` across the auth round-trip.
- Anonymous `?next=` is locale-prefixed via `safeNextPath`. API errors via `errorMessage`.
- Resend/Revoke only for `PENDING`; `EXPIRED` gets **Invite again** (new `POST` with same fields).

## Changes

| Area / path                                | Change                                                |
| ------------------------------------------ | ----------------------------------------------------- |
| `apps/web/src/proxy.ts`                    | Add `invitations/accept` to `TOKEN_LINK_PATH`         |
| `apps/web/src/features/team/`              | Team view, invite dialog, accept panel, token storage |
| `apps/web/src/app/.../team/`               | Thin team page                                        |
| `apps/web/src/app/.../invitations/accept/` | Thin accept page + `referrer: no-referrer` metadata   |
| `packages/i18n` `business`                 | Team + accept strings (en/me/ru/tr)                   |

### Contracts / API

- `businessMemberSchema` includes `businessId` (returned from accept and member list/update).

### Data model

None.

### UI and i18n

- `/[locale]/business/[businessId]/team` — members + invitations (OWNER/ADMIN via nav).
- `/[locale]/invitations/accept` — public accept flow.
- Namespace: `business` (`team.*`, `inviteAccept.*`).

## Test plan

- Unit/RTL: team view (members, invite, resend/revoke/invite-again, LAST_OWNER, role gating).
- Unit/RTL: accept panel (preview, strip token, anonymous next, accept success, mismatch/expired/invalid).
- Proxy: Referrer-Policy on `invitations/accept`.

## Risks and open questions

- None — API behaviour is defined in #77.

## Implementation notes

- `BusinessMember` includes `businessId`; accept uses it directly (no `/me/businesses` lookup).
- Invite token lives in `sessionStorage` (`najme.invitation.token`) across the auth round-trip;
  cleared right after a successful accept POST and on terminal errors (invalid/expired/already member).
- After email-mismatch Sign out, status returns to `ready` so anonymous Sign in / Create account with
  `next` are shown again.
- Resend/Revoke only for PENDING; Invite again = new POST (locale + schema) and drops the expired row.
- OWNER role in invite/change-role selects is gated to actors with `myRole === 'OWNER'`.
- Invite dialog shows the staff field only for STAFF and never sends `staffMemberId` for other roles.
- `TOKEN_LINK_PATH` includes `invitations/accept`; page metadata also sets `referrer: 'no-referrer'`.
