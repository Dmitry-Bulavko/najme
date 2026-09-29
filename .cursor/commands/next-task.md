# Next task

Implement the next Najme task end to end, following `AGENTS.md` ("Your task cycle") exactly.

1. Sync `cursor/alpha` (`git switch cursor/alpha && git pull --ff-only`; create it from
   `origin/main` if it does not exist). The working tree must be clean.
2. Select the task:
   - any open issue with `status:changes-requested` → run the `address-review` command instead;
   - else an open `status:in-progress` issue you started;
   - else the first `status:ready` task by phase → priority → number whose `Blocked by #N` issues
     are closed or `status:approved`, skipping `type:epic` and `status:needs-human`
     (`gh issue list --label status:ready --state open --limit 100 --json number,title,labels`,
     then `gh issue view N --comments` for the dependencies).
     If none: say "Phase complete — ask Claude to review and merge the phase PR" and stop.
3. Claim it (`gh issue edit N --add-label status:in-progress --remove-label status:ready`, comment
   `Claimed by Cursor on cursor/alpha.`).
4. Read the issue with comments, the docs for its areas (`docs/README.md`), the named ADRs and the
   code to change. Ambiguity or conflict with an ADR → `status:blocked` + a precise question, then
   pick another task.
5. Spec (`docs/specs/<N>-<slug>.md`) for size M or schema/contract changes.
6. Implement: contracts → API → web/mobile, with tests, 4-locale strings and doc updates. Apply
   API-STD / UI-STD when the issue references them.
7. `pnpm format`, then `pnpm check` until green (Postgres/Mailpit via `compose.dev.yml`,
   `DATABASE_URL` exported for API e2e).
8. Commit (Conventional Commits with `(#N)`, explicit staging) and `git push origin cursor/alpha`.
9. Ensure the phase PR exists and is green (`phase-pr` command).
10. Hand off: `gh issue edit N --add-label status:in-review --remove-label status:in-progress` and
    comment the handoff block from `AGENTS.md` (`Ready for review: <first-sha>^..<last-sha>` …).
11. Report to the owner: issue, commit range, what to look at, and the next task you would take.
