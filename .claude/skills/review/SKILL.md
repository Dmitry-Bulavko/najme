---
name: review
description: Reviews Cursor's work on the Najme `cursor/alpha` branch (ADR-0012) — finds issues in `status:in-review`, reviews each handed-off commit range against the issue, Definition of Done and conventions (checks, UI screenshots), posts the verdict on the issue and sets `status:approved` / `status:changes-requested`; closes a phase (merge commit, epic, grooming). Use when the user says "ревью", "review", "review #N", "проверь задачи", "закрыть фазу", "merge the phase".
argument-hint: '[issue-number…] | phase'
---

# /review — reviewer of Cursor's work

Cursor implements on the long-lived branch `cursor/alpha` and hands tasks off with an issue comment
`Ready for review: <first-sha>^..<last-sha>` (see `AGENTS.md`). You are the independent reviewer:
you do **not** write feature code — findings go back to Cursor. Repository `Dmitry-Bulavko/najme`;
GitHub via the MCP tools (`docs/workflow/github-tooling.md`). Talk to the owner in their language
(Russian); everything on GitHub is English and ends with the Claude Code footer.

Arguments: `$ARGUMENTS` — issue numbers to review (default: every open `status:in-review` task), or
`phase` to close the current phase.

## Review a task

1. **Collect.** `list_issues` with `status:in-review` (or the given numbers). For each: the issue
   body, the latest `Ready for review:` comment (range, deviations, translations), earlier review
   rounds (to check previous findings), and the phase PR (`cursor/alpha → main`) with its CI.
2. **Check out.** `git fetch origin cursor/alpha` into a dedicated worktree (e.g.
   `git worktree add ../najme-review origin/cursor/alpha` or `git -C ../najme-review checkout
--detach origin/cursor/alpha`). Never commit or push there.
3. **Verify the range** belongs to the issue: `git log --oneline <range>` (all subjects carry
   `(#N)`); `git diff --stat <range>`.
4. **Run checks** on the branch head: `pnpm install --frozen-lockfile`, Postgres up
   (`service postgresql start` in the cloud container), `DATABASE_URL` for a scratch DB,
   `pnpm --filter @najme/api db:migrate:deploy`, `pnpm check`. A failing check is a BLOCKER. Also
   read the phase PR's CI for the head commit.
5. **Review** with the checklist of `.claude/agents/reviewer.md` (acceptance criteria one by one,
   correctness, security/authz incl. 404/403 and cross-tenant, contracts, data/migrations,
   i18n in 4 locales, tests, scope/hygiene, API-STD / UI-STD). For size M or security-sensitive
   tasks run the `reviewer` subagent on the range in parallel and merge its findings with yours.
6. **UI tasks:** run the app (`pnpm dev` with a seeded DB) and take headless Chromium screenshots
   (`/opt/pw-browsers/chromium`, global `playwright`) of the touched pages at 1440px and 390px in
   at least two locales, plus the mobile web export (`expo export --platform web` served
   statically) for mobile tasks. Look at them — layout bugs are findings. Send the key screenshots
   to the owner.
7. **Verdict** as an issue comment:

   ```
   ## Review — round <n> (<range>)
   VERDICT: APPROVE | CHANGES_REQUESTED
   CHECKS: pnpm check <pass/fail>; CI <pass/fail>; screenshots <n/a | attached to chat>
   BLOCKER:
   - <path:line> — <problem> → <fix>
   MAJOR:
   - …
   MINOR:
   - …
   PREVIOUS FINDINGS: <each → resolved / not resolved>   (re-review only)
   FOLLOW-UPS: <out-of-scope issues noticed | none>
   ```

   APPROVE only with no BLOCKER/MAJOR and green checks. Labels (send the full set — `issue_write`
   replaces labels): `status:approved` or `status:changes-requested`. Optional inline comments on
   the phase PR for precise spots. Follow-ups worth doing become new issues (`/manager new`).

8. After round 3 without approval → `status:blocked` with a summary; tell the owner.
9. Report to the owner in a few lines per issue: verdict, main findings, what Cursor does next.

## Close a phase (`phase`)

1. Preconditions: every task of the phase is `status:approved` (or closed), no `changes-requested`
   / `in-review` left, the phase PR's `ci` and `smoke` are green on its head, no merge conflict.
2. Verify the epic's exit criteria for real: run the flows locally (API + web; mobile via the web
   export), screenshots in all relevant locales, e2e suites. Anything missing → new issue in the
   same phase, phase stays open.
3. Merge the phase PR with a **merge commit** (`merge_method: merge`, exact `expectedHeadSha`),
   title `Phase <Mx>: <epic title>`. Verify the tasks closed via `Closes #N`; remove `status:*`
   labels from them; close the epic with a summary comment (what shipped, links, follow-ups).
4. Groom the next phase: for each of its `status:backlog` tasks compare the body with the code that
   landed (renamed modules, changed contracts, new helpers), edit bodies where needed, then set
   `status:ready`. Update `docs/roadmap.md` "Current phase" via a small docs PR if needed.
5. Tell the owner the phase is merged and Cursor can sync and start the next phase.

## Never

- Push to `cursor/alpha`, rewrite its history, or fix Cursor's code yourself (exception: the owner
  explicitly asks).
- Merge a phase with red CI, open findings or unverified exit criteria.
- Approve a task whose range you have not read in full.
