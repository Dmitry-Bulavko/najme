# #85 — Add mobile business mode with switcher, creation, profile and settings

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/85
- Status: Implemented (review round 1 addressed)
- Related: ADR-0003, ADR-0013, ADR-0014, #78, #80, #81, `docs/runbooks/local-dev.md`

## Goal

Signed-in users switch into business mode on mobile (create or pick a business), land in a
role-aware tab shell (Overview / Staff / Services / More), and manage profile + booking settings.
Mode and last business id persist in AsyncStorage. Staff/services editors land in #86; delete and
slug editing stay web-only.

## Approach

- Mirror web #80/#81 behaviour with the mobile UI kit from #78 (`Select`, `SwitchRow`,
  `SegmentedControl`, `confirm`).
- AsyncStorage keys: `najme.appMode` (`client` | `business`) and `najme.lastBusinessId` (same
  semantic as web `localStorage`). Cleared on sign-out (`clearAppMode` + `clearLastBusinessId`).
- Route group `(business)` beside `(tabs)`: create/pick stack screens + fixed segment
  `business/[businessId]` tabs (avoids clashing with `new`/`pick`).
- More tab: Client mode, Profile, Settings (OWNER/ADMIN only), switch business.
- Image upload: `expo-image-picker` + `expo-image-manipulator` new API (≤1600 px JPEG) →
  multipart presigned POST (fields before file) → attach. On Expo web: preview stays, edit
  actions hidden. No `requestMediaLibraryPermissionsAsync` (system picker).
- `BusinessProvider` alone writes `appMode` after successful `GET /businesses/:id`. On
  NOT_FOUND/FORBIDDEN: clear matching `lastBusinessId`, invalidate `/me/businesses`, offer
  Switch business / Client mode (Retry only for transient errors).
- `BusinessModeRestorer` restores only when the initial path is `/` (never overrides deep links).
- Navigation into a business uses `router.replace` so history does not stack.
- API errors only via shared `parseErrorEnvelope` / `ApiError` — no envelope re-parsing in
  features.
- Reuse existing `business.*` i18n keys; add only keys the mobile shell needs (`shell.more`,
  stub placeholders).

## Changes

| Area / path     | Change                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| mobile deps     | `expo-image-picker`, `expo-image-manipulator` (SDK 57)                                                 |
| mobile features | mode/last-business storage, my-businesses, checklist, presets, create/overview/profile/settings/upload |
| mobile routes   | `(business)` group: new, pick, `business/[businessId]` tabs + More stack                               |
| account         | Business mode row (error vs empty list distinguished)                                                  |
| i18n            | minimal new `business.shell.more` (+ stub copy) ×4                                                     |
| docs            | this spec; LAN note for device uploads                                                                 |

### Contracts / API

None — reuse create/update/upload/my-businesses schemas and endpoints.

### Data model

None.

### UI and i18n

- Namespace `business` (already in `UI_NAMESPACES`).
- Cities via `common:cities.<CODE>`.
- STAFF: read-only profile; Settings hidden; Staff/Services read-only lists (#86).

## Test plan

- Unit: last-business + mode AsyncStorage helpers (incl. clearAppMode); booking presets;
  `loadChecklist` mapping; `mapWithConcurrency`.
- RNTL: account Business mode row (error / empty / success); create form submit + VALIDATION_FAILED
  field mapping; provider NOT_FOUND recovery; status banner resubmit; settings exact PATCH body +
  non-preset 45; profile STAFF read-only + changed-fields PATCH; overview checklist OWNER-only;
  image upload native path (resize, presign, fields-before-file, >25 MB, storage failure,
  re-compress) and web preview-without-edit.
- Mock AsyncStorage, image picker/manipulator, `apiRequest`, XMLHttpRequest.

## Risks and open questions

- Physical devices need LAN IPs for `EXPO_PUBLIC_API_URL` and `STORAGE_*` (see local-dev.md).
- Staff/services/hours editors: staff & services in #86; hours in #87.

## Implementation notes

- AsyncStorage: `najme.appMode` + `najme.lastBusinessId` (web parity for the id key); both cleared
  on sign-out.
- Routes: `(business)/new`, `pick`, `business/[businessId]` tabs (Overview / Staff / Services /
  More); More stack holds Profile, Settings, Client mode, Switch business. Hrefs use
  `/(business)/business/<id>/…`.
- Image upload uses `ImageManipulator.manipulate` → `resize` → `renderAsync` → `saveAsync`
  (JPEG ≤1600 px) then presigned multipart POST; web keeps preview, hides edit buttons.
- Physical devices: set `EXPO_PUBLIC_API_URL`, `STORAGE_ENDPOINT` and `STORAGE_PUBLIC_BASE_URL`
  to the machine LAN IP (not localhost) — see `docs/runbooks/local-dev.md`.
- Slug edit and business delete remain web-only; STAFF profile is read-only and Settings is
  hidden from More.
- Dependencies: `expo-image-picker@~57.0.20`, `expo-image-manipulator@~57.0.20`.
