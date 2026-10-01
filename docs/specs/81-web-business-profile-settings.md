# #81 — Build web business profile and settings pages

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/81
- Status: Implemented
- Related: ADR-0013, ADR-0014, #76, #80, `docs/architecture/data-model.md` (slugs, R18)

## Goal

Owners/admins edit the public profile (including logo/cover via presigned upload) and booking
policy on the web; STAFF get a read-only profile; OWNER can soft-delete the business.

## Approach

- Profile and settings as client feature views under the existing `BusinessShell` layout.
- Reusable `ImageUpload`: client type/size checks, canvas ≤1600 px, XHR progress on the
  presigned POST, then attach/remove via the #76 upload routes.
- Forms: react-hook-form + contract-derived zod, localized field errors, `errorMessage` for API
  codes (`SLUG_TAKEN`, `SLUG_LOCKED`, `UPLOAD_INVALID`).
- Booking policy presets as `Select` values that include R18 defaults and stay inside CHECK
  ranges; confirmation mode as `RadioGroup`.
- Slug field editable in the UI when status is `PENDING_APPROVAL` or `REJECTED`; API still
  enforces `approvedAt`-based `SLUG_LOCKED`.

## Changes

| Area / path  | Change                                                        |
| ------------ | ------------------------------------------------------------- |
| web routes   | `…/profile`, `…/settings` pages + metadata                    |
| web features | profile form, settings form, `ImageUpload`                    |
| i18n         | `business.profile`, `business.settings`, `business.upload` ×4 |
| docs         | this spec                                                     |

### Contracts / API

No contract or API changes — reuse `updateBusinessRequestSchema`, upload schemas, soft-delete.

### Data model

None.

### UI and i18n

- Namespace `business`: `profile.*`, `settings.*`, `upload.*` (en/me/ru/tr).
- Images: plain `<img>` (no `next/image` optimization).

### Booking policy presets

| Field                  | Preset values (minutes / days)                            | Default |
| ---------------------- | --------------------------------------------------------- | ------- |
| Cancellation window    | 0, 30, 60, **120**, 240, 1440 (1d), 2880 (2d), 10080 (7d) | 120     |
| Minimum notice         | 0, 15, 30, **60**, 120, 240, 480                          | 60      |
| Booking horizon (days) | 7, 14, 30, **60**, 90, 180, 365                           | 60      |

All stay within CHECKs: window/notice 0…525 600 minutes; horizon 1…365 days.

## Test plan

- RTL: profile save/PATCH body, STAFF read-only, slug locked when APPROVED, ImageUpload
  validation + attach/remove (mocked fetch/XHR).
- RTL: settings presets + confirmation mode, OWNER danger-zone delete → client mode;
  STAFF visiting settings sees no editor.
- Manual: upload against local MinIO when available.

## Risks and open questions

- Staff photo usage of `ImageUpload` lands in #82 (out of scope here; API path supported).
- Deletion while future bookings exist is deferred (integrity guards issue).

## Implementation notes

- `ImageUpload` takes `kind` + business id (+ optional `staffId`) so #82 can reuse it.
- After successful profile/settings PATCH, call `setBusiness` from shell context.
- After delete: clear last-business id, invalidate my-businesses, navigate to `/${locale}`.
