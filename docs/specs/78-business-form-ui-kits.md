# #78 — Extend the web and mobile UI kits for business forms

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/78
- Status: Implemented
- Related: #44, #45, ADR-0003, `docs/specs/44-web-ui-kit.md`, `docs/specs/45-mobile-ui-kit.md`

## Goal

Add the form and overlay primitives both business dashboards need (dialogs, selects, toggles,
tables, money/time inputs, mobile pickers) so later feature issues stay small. Every new primitive
uses design tokens only, has accessibility roles/labels, appears in the kit showcase, and ships with
i18n strings in `shell` (web) / `mobile` (app) for en/me/ru/tr.

## Approach

- **Web:** hand-write shadcn "new-york" primitives under `apps/web/src/components/ui/` (same pattern
  as #44), adding the missing Radix packages. `TimeInput` wraps a stepped `type="time"` control
  (5-minute step, value `HH:mm`). `MoneyInput` edits EUR major units in the UI and emits/accepts
  integer minor units via helpers next to `moneySchema` in `packages/contracts` (accept `,` and `.`,
  round to 2 decimals). Showcase entries go in `/[locale]/dev/ui`.
- **Mobile:** own primitives (ADR-0003) — bottom-sheet `Select`, `SwitchRow`, `SegmentedControl`,
  `Chip`, `Badge`, `MoneyInput`, `confirm()` (`Alert.alert` Promise wrapper). `TimePicker` /
  `DatePicker` wrap `@react-native-community/datetimepicker` on native; `.web.tsx` (or
  `Platform.OS === 'web'`) falls back to plain text/date/time inputs so `expo export --platform web`
  keeps working. Showcase entries in the existing `__DEV__` gallery.
- No new ADR; no feature screens; no ImageUpload.

## Changes

| Area / path                                  | Change                                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/money.ts`            | Major↔minor parse/format helpers for 2-decimal currencies                                                                              |
| `apps/web/src/components/ui/*`               | Dialog, AlertDialog, Select, Textarea, Switch, Checkbox, RadioGroup, Tabs, Badge, Popover, Table, TimeInput, MoneyInput (+ unit tests) |
| `apps/web/src/features/dev/ui-showcase.tsx`  | Showcase sections for every new primitive                                                                                              |
| `apps/mobile/src/components/ui/*`            | Select, SwitchRow, SegmentedControl, Chip, Badge, TimePicker, DatePicker, MoneyInput, confirm (+ tests, web fallbacks)                 |
| `apps/mobile/src/components/ui/showcase.tsx` | Showcase entries                                                                                                                       |
| `packages/i18n`                              | Kit strings in `shell` / `mobile` for en/me/ru/tr                                                                                      |
| `apps/web` / `apps/mobile` package.json      | Radix packages; `@react-native-community/datetimepicker`                                                                               |

### Contracts / API

No new endpoints. Add pure helpers on `money.ts` (e.g. `parseMajorToMinor`, `formatMinorAsMajor`) used
by both MoneyInputs; keep `moneySchema` unchanged.

### Data model

None.

### UI and i18n

- Web kit strings under `shell` → `devUi.*` (and small `ui.*` labels if needed for a11y).
- Mobile kit strings under `mobile` → `ui.*` / `showcase.*`.
- All four locales in the same commit.

## Test plan

- Unit (web Vitest): TimeInput (5-min snap / `HH:mm`), MoneyInput (rounding, `,`/`.` separators).
- Unit (mobile Jest): MoneyInput (same cases), TimePicker / DatePicker (value formatting; web fallback
  path mocked or platform-guarded).
- i18n parity / ICU for `shell` and `mobile`.
- `pnpm turbo run lint typecheck test build --filter=...[origin/main]` (or scoped web+mobile+contracts+i18n);
  `expo export --platform web` via mobile `build`.

## Risks and open questions

- datetimepicker has no web implementation — platform-specific modules are required for export.
- Confirm dialog on web is out of scope (mobile-only helper); web uses AlertDialog/Dialog components.

## Implementation notes

- Web kit action labels (`close` / `cancel` / `save` / `delete`) live under `shell.devUi` (not a
  top-level `ui` key) so they do not collide with `mobile.ui` in the packages/i18n collision test.
- Money parse/format helpers ship in `packages/contracts` (`parseMajorToMinor`,
  `formatMinorAsMajor`) and are shared by both MoneyInputs.
- Mobile `TimePicker` / `DatePicker` use Metro platform extensions (`.web.tsx`) so
  `@react-native-community/datetimepicker` is never loaded in the web export.
