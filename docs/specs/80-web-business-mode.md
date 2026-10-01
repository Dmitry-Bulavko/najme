# #80 — Add web business mode with switcher, creation and dashboard shell

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/80
- Status: Implemented
- Related: ADR-0013, ADR-0004, #73, #78, #79, #52

## Goal

Signed-in users switch into business mode on the web, create a business, and land in a
role-aware dashboard that shows moderation status (with resubmit) and a setup checklist.

## Approach

- Nested `business` i18n namespace (shared with mobile later).
- Account menu offers Business mode (create vs picker) and Client mode; last business id in
  `localStorage` (try/catch).
- Routes under `/[locale]/business`: index (redirect/list), `new` (create form),
  `[businessId]` shell + overview.
- Shell: sidebar on `lg+`, Sheet nav on narrow; STAFF hide Team and Settings (ADR-0013).
- Checklist fetches business + staff + services + working hours in parallel (bounded).
- Contract: add nullable `rejectionReason` on member `businessSchema` so the REJECTED banner
  can show the reason (admin payloads already had it).

## Changes

| Area / path    | Change                                                           |
| -------------- | ---------------------------------------------------------------- |
| contracts      | `businessSchema.rejectionReason`                                 |
| api businesses | select + map `rejectionReason`                                   |
| i18n           | `business` namespace en/me/ru/tr                                 |
| web            | account menu, routes, shell, create, overview, banner, checklist |

### Contracts / API

- `GET /businesses/:id` (and create/patch/resubmit responses) include `rejectionReason: string | null`.

### Data model

No migration.

### UI and i18n

Namespace `business`. City labels via `common.cities.<CODE>`. Categories from
`GET /categories?locale=`.

## Test plan

- Contracts: rejectionReason nullable on parse.
- API e2e: rejected business detail exposes reason; resubmit clears it.
- Web RTL: account menu create/picker; create form submit; status banner resubmit; STAFF nav
  hides Team/Settings; anonymous redirect with locale-prefixed `next`.

## Risks and open questions

- Checklist links to pages owned by #81–#84 (404 until those land) — intentional.
- Profile/settings/staff/services/hours/team page bodies out of scope.

## Implementation notes

- Member `businessSchema` gained `rejectionReason` so the REJECTED banner can show the admin
  note; API `toBusiness` maps it.
- Account menu: empty memberships → Create; one → Business mode + Create + Client mode; many →
  `/business` list + Create + Client mode (no submenu component in the UI kit).
- Checklist links to profile/staff/services/schedule paths owned by #81–#83 (404 until those land).
- `localStorage` key `najme.lastBusinessId` with try/catch; Client mode clears it.
