# #85 — Add mobile business mode with switcher, creation, profile and settings

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/85
- Status: Implemented
- Related: ADR-0003, ADR-0013, ADR-0014, #78, #80, #81, `docs/runbooks/local-dev.md`

## Goal

Signed-in users switch into business mode on mobile (create or pick a business), land in a
role-aware tab shell (Overview / Staff / Services / More), and manage profile + booking settings.
Mode and last business id persist in AsyncStorage. Staff/services bodies stay stubs; delete and
slug editing stay web-only.

## Approach

- Mirror web #80/#81 behaviour with the mobile UI kit from #78 (`Select`, `SwitchRow`,
  `SegmentedControl`, `confirm`).
- AsyncStorage keys: `najme.appMode` (`client` | `business`) and `najme.lastBusinessId` (same
  semantic as web `localStorage`).
- Route group `(business)` beside `(tabs)`: create/pick stack screens + `[businessId]` tabs.
- More tab: Client mode, Profile, Settings (OWNER/ADMIN only), switch business.
- Image upload: `expo-image-picker` + `expo-image-manipulator` (≤1600 px JPEG) → multipart
  presigned POST → attach. Hidden on Expo web export (`Platform.OS === 'web'`).
- API errors only via shared `parseErrorEnvelope` / `ApiError` — no envelope re-parsing in
  features.
- Reuse existing `business.*` i18n keys; add only keys the mobile shell needs (`shell.more`,
  stub placeholders).

## Changes

| Area / path     | Change                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| mobile deps     | `expo-image-picker`, `expo-image-manipulator` (SDK 57)                                                 |
| mobile features | mode/last-business storage, my-businesses, checklist, presets, create/overview/profile/settings/upload |
| mobile routes   | `(business)` group: new, pick, `[businessId]` tabs + More stack                                        |
| account         | Business mode row                                                                                      |
| i18n            | minimal new `business.shell.more` (+ stub copy) ×4                                                     |
| docs            | this spec; LAN note for device uploads                                                                 |

### Contracts / API

None — reuse create/update/upload/my-businesses schemas and endpoints.

### Data model

None.

### UI and i18n

- Namespace `business` (already in `UI_NAMESPACES`).
- Cities via `common:cities.<CODE>`.
- STAFF: read-only profile; Settings hidden; Staff/Services stubs OK.

## Test plan

- Unit: last-business + mode AsyncStorage helpers; booking presets; checklist mapper.
- RNTL: account Business mode row; create form submit; status banner resubmit; settings
  SegmentedControl + Select; STAFF hides Settings; image upload controls absent on web.
- Mock AsyncStorage, image picker/manipulator, `apiRequest`.

## Risks and open questions

- Physical devices need LAN IPs for `EXPO_PUBLIC_API_URL` and `STORAGE_*` (see local-dev.md).
- Staff/services/hours editors arrive in later M2 mobile tasks.

## Implementation notes

- AsyncStorage: `najme.appMode` + `najme.lastBusinessId` (web parity for the id key).
- Routes: `(business)/new`, `pick`, `[businessId]` tabs (Overview / Staff / Services / More);
  More stack holds Profile, Settings, Client mode, Switch business.
- Image upload uses `expo-image-picker` + `expo-image-manipulator` (JPEG ≤1600 px) then
  presigned multipart POST; controls return `null` on `Platform.OS === 'web'`.
- Physical devices: set `EXPO_PUBLIC_API_URL`, `STORAGE_ENDPOINT` and `STORAGE_PUBLIC_BASE_URL`
  to the machine LAN IP (not localhost) — see `docs/runbooks/local-dev.md`.
- Slug edit and business delete remain web-only; STAFF profile is read-only and Settings is
  hidden from More.
- Dependencies: `expo-image-picker@~57.0.20`, `expo-image-manipulator@~57.0.20`.
