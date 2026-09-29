# #45 — Mobile UI kit (primitives on design tokens) and app shell

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/45
- Status: Implemented
- Related: ADR-0003, ADR-0004, `docs/conventions/i18n.md`

## Goal

Give the Expo app a set of accessible primitives built only on `@najme/ui-tokens`, a styled tab
shell and restyled placeholder screens, so all M1 mobile screens share one look.

## Approach

Own primitives (no shared UI with web, ADR-0003) in `apps/mobile/src/components/ui/`. No hard-coded
colours or spacing: everything reads `tokens`. Fonts use per-weight family names (`Manrope-Bold`
etc.) because `fontWeight` does not pick custom font weights on Android. Text scales with dynamic
type, capped at 1.6x. Touch targets are at least 44dp. `Banner` uses a neutral surface with a
coloured accent bar and icon (tokens have no tinted backgrounds).

## Changes

| Area / path                          | Change                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/components/ui/*`                | Text, Button, TextField, FormField, Card, Banner, Avatar, Divider, ListItem/ListGroup, Screen, dev showcase |
| `src/components/empty-state.tsx`     | Shared empty-state card for Discover / Bookings                                                             |
| `src/app/(tabs)/*`                   | Tab shell with Ionicons, token tints, i18n titles, shared header style                                      |
| `src/app/ui-showcase.tsx`, `_layout` | `__DEV__`-only showcase route (route and Account link both guarded)                                         |
| `src/features/*`                     | Language switcher and API status rebuilt on `ListItem`                                                      |
| `packages/i18n`                      | New `mobile` namespace, all four locales, parity + ICU tests extended                                       |
| `apps/mobile/package.json`           | `react-hook-form` (FormField)                                                                               |

### UI and i18n

New namespace `mobile` (`packages/i18n/src/catalogs/<locale>/mobile.json`): `ui.*` (password toggle
labels), `account.*`, `showcase.*`, `empty.*`. Existing `common` keys (tabs, screens, apiStatus,
languageSwitcher) are reused.

## Test plan

- Unit (RNTL): Button (press, loading, disabled), TextField (helper/error, secure toggle), tab
  shell titles/icons/tint.
- i18n: `mobile` namespace key parity and ICU validity for all locales.
- `expo export --platform web` in `pnpm check`.

## Risks and open questions

- `@hookform/resolvers` not added: `FormField` needs only `Controller`; add with the first zod form.
- Sign-in button is a placeholder until the auth task.

## Implementation notes

`Screen` uses `SafeAreaView` from `react-native-safe-area-context` (position-aware, so it composes
with navigator headers and tab bars); its Jest mock is registered in `jest.setup.ts`.
The showcase is loaded via a `__DEV__`-guarded `require`, which Metro constant-folds away in
production bundles.
