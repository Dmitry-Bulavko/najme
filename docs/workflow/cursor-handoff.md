# Working with Cursor (owner's guide)

Decision record: ADR-0012. Cursor implements, Claude reviews, the owner steers. The implementer's
briefing is `AGENTS.md` + `.cursor/rules/` + `.cursor/commands/`; Claude's protocol is the
`/review` skill (`.claude/skills/review/SKILL.md`).

## Setup (once)

1. Open the repository in Cursor. Make sure `gh auth status` works in Cursor's terminal (the agent
   uses `gh` for issues, labels and the phase PR).
2. Local services: Docker (for `compose.dev.yml`), Node 24, pnpm via corepack. Follow
   `docs/runbooks/local-dev.md` once by hand (`cp .env.example .env`, compose up, migrate,
   `pnpm check`).
3. Create the branch: `git switch -c cursor/alpha origin/main`.
4. In Cursor settings, keep the agent's terminal allow-list conservative: it must never run
   `git push --force`, `git push origin main`, or read `.env` (the rules forbid it; a deny-list is
   a second line of defence).

## Daily loop

1. In Cursor's agent chat run the **`next-task`** command (or paste: _"Follow AGENTS.md: take the
   next task and implement it end to end."_). One task per chat keeps the context clean.
2. When the agent reports "Ready for review", tell Claude: **"ревью"** (or "review #123"). Claude
   reviews every issue in `status:in-review`, answers on each issue and sets `status:approved` or
   `status:changes-requested`.
3. Findings → in Cursor run **`address-review`** for that issue. Otherwise continue with
   `next-task`. Tasks that do not depend on each other can be implemented while a review is pending.
4. When Cursor says "phase complete", tell Claude **"закрыть фазу"** / "merge the phase". Claude
   verifies the epic's exit criteria (running the app, screenshots, e2e), merges the phase PR with a
   merge commit, closes the epic and grooms the next phase to `status:ready`. Cursor then syncs
   (`git fetch && git merge --ff-only origin/main`) and opens the next phase PR (`phase-pr`).

## Statuses you will see

| Label                      | Meaning                                                    | Who acts       |
| -------------------------- | ---------------------------------------------------------- | -------------- |
| `status:ready`             | groomed, can be taken                                      | Cursor         |
| `status:in-progress`       | Cursor is working on it                                    | Cursor         |
| `status:in-review`         | handed off with a commit range                             | owner → Claude |
| `status:changes-requested` | Claude found BLOCKER/MAJOR issues                          | Cursor         |
| `status:approved`          | Claude approved; lands with the phase PR                   | —              |
| `status:blocked`           | question in the last comment (product decision / conflict) | owner + Claude |
| `status:needs-human`       | owner action (accounts, secrets, provider setup)           | owner          |
| `status:backlog`           | later phase, groomed at the phase boundary                 | Claude         |

## Owner actions (needs-human)

Tracked as issues with checklists; the earlier the better:

- **#58** Google OAuth client IDs — enables real Google sign-in in dev (M1).
- **M5 providers** — AWS SES domain verification + production access (takes days), Telegram bots,
  Expo project/FCM credentials.
- **M7 accounts** — final domain, storage and backup buckets, Sentry, uptime monitor, Apple
  Developer / Play Console, EAS token.
- **#18** Lightsail server and production secrets — before the first release.

## Rules of thumb

- Product questions go to the owner through `status:blocked`; Cursor must not guess.
- If CI on the phase PR is red, fixing it is Cursor's next task.
- A task that fails review three times is escalated (`status:blocked`) instead of looping.
- Releases to production (`/manager release`) still need the owner's explicit "yes".
