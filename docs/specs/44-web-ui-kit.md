# #44 — Web UI kit (shadcn/ui on design tokens) and app shell

- Issue: https://github.com/Dmitry-Bulavko/najme/issues/44
- Status: Implemented
- Related: ADR-0003 (Update: shadcn/ui on web), ADR-0004, owner decision R7

## Goal

Give `apps/web` a reusable component kit (shadcn/ui, restyled to `@najme/ui-tokens`) and a real app
shell (header, navigation, footer) so every M1 screen is composed from consistent components.

## Approach

- The shadcn CLI needs network and is interactive, so components are hand-written following shadcn's
  "new-york" source (same file layout under `src/components/ui/`, same APIs, `cn()` in
  `src/lib/utils.ts`, `components.json` committed so the CLI can add more later).
- **Tokens stay the source of truth.** `globals.css` defines shadcn's semantic variables (`--primary`,
  `--radius`, `--border`, ...) as aliases of token variables; `@theme inline` only adds the names the
  tokens do not define (`foreground`, `card`, `popover`, `muted`, `destructive`, `border`, `input`,
  `ring`). Brand `accent` (coral) is kept as a brand colour; hover surfaces use `secondary`.
- Dependencies: individual `@radix-ui/react-*` primitives (slot, dialog, dropdown-menu, avatar,
  separator, label), `class-variance-authority` (variants), `clsx` + `tailwind-merge` (`cn`),
  `lucide-react` (icons), `sonner` (toasts), `tw-animate-css` (Radix enter/exit animations),
  `react-hook-form` (FormField wiring, per ADR-0003).
- Shell: `SiteHeader` (wordmark, `MainNav`, `MobileNav` Sheet below `md`, language dropdown, account
  slot with a "Sign in" button), `SiteFooter`, skip-to-content link, `<main id="content">`, `Toaster`.
- `/[locale]/dev/ui` renders every component; the page calls `notFound()` when
  `NODE_ENV === 'production'`.

## Changes

| Area / path                                           | Change                                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/ui/*`                        | Button, Input, Label, FormField, Card, Alert, Sonner, Avatar, DropdownMenu, Sheet, Separator, Skeleton (+ tests) |
| `apps/web/src/components/shell/*`                     | Header, footer, main/mobile nav, wordmark, account slot                                                          |
| `apps/web/src/features/locale`                        | Language switcher restyled as a dropdown                                                                         |
| `apps/web/src/features/home`, `app/[locale]/page.tsx` | Hero with search placeholder, category chips                                                                     |
| `apps/web/src/app/[locale]/{discover,bookings}`       | Placeholder pages so the nav resolves                                                                            |
| `apps/web/src/features/dev`, `app/[locale]/dev/ui`    | Dev-only showcase                                                                                                |
| `apps/web/src/proxy.ts`                               | Forwards the URL locale as `x-next-intl-locale` (see notes)                                                      |
| `apps/web/tsconfig.json`                              | Pins `react` types to web's copy (see notes)                                                                     |
| `packages/i18n`                                       | New `shell` namespace (nav, shell, home, devUi) in 4 locales                                                     |

### UI and i18n

New namespace `shell` (`packages/i18n/src/catalogs/<locale>/shell.json`), merged at the top level with
`common` in `src/i18n/request.ts`. Root keys: `nav`, `shell`, `home`, `devUi`. Key parity and ICU
validity are tested for every namespace.

## Test plan

- Unit: Button (variants, loading, asChild), FormField (aria wiring, react-hook-form errors), Sheet,
  DropdownMenu, Alert, Avatar, language switcher, proxy header, i18n key parity for `shell`.
- Manual: production build; `/en` renders in all locales, `/en/dev/ui` is 404; dev server serves it.

## Risks and open questions

- Dark mode is out of scope; variables are structured so a `.dark` override can be added later.
- The Sign in button is inert until the auth tasks wire it.

## Implementation notes

- **Pre-existing bug fixed:** without next-intl's middleware, server components always fell back to
  `en` regardless of the URL locale (only `<html lang>` and client messages were right). `proxy.ts`
  now sets the `x-next-intl-locale` request header for supported locales.
- **TypeScript:** `apps/mobile` pins `@types/react` 19.2, so pnpm hoists that copy for Next's
  `styled-jsx` types, producing two `React` namespaces and false errors on `ComponentProps<'div'>`.
  `tsconfig.json` `paths` pin `react` to web's own `@types/react`.
- `next dev` generates `apps/web/AGENTS.md`/`CLAUDE.md`; not committed.
