# Agentic workflow

Decision record: ADR-0008. This document is the operating manual.

## Roles

| Role          | Where                                    | Model                 | Responsibilities                                                |
| ------------- | ---------------------------------------- | --------------------- | --------------------------------------------------------------- |
| Human (owner) | GitHub + chat                            | —                     | Product decisions, secrets, approving releases, unblocking      |
| `/manager`    | skill, main session                      | session model         | Roadmap, epics, creating/grooming issues, releases              |
| `/implement`  | skill, main session (orchestrator)       | session model         | Pick task, claim, delegate, PR, CI, merge, status updates       |
| `implementer` | subagent `.claude/agents/implementer.md` | sonnet, effort medium | Spec (M), code, tests, local checks, commits on the task branch |
| `reviewer`    | subagent `.claude/agents/reviewer.md`    | sonnet, effort medium | Independent read-only review → `APPROVE` / `CHANGES_REQUESTED`  |

Subagents have no GitHub access; the orchestrator is the only one that talks to GitHub during a
task. This keeps subagent context small and the audit trail in one place.

Turn budgets: `implementer` has `maxTurns: 80` and is prompted to stop around turn 70, commit what
is green, and report `STATUS: BLOCKED` with what remains if unfinished. `reviewer` has
`maxTurns: 50` and is prompted to stop around turn 40 and deliver its verdict, listing anything
unverified under `CHECKS`. Both must always hand back their fixed report format before the limit.
If a subagent still stops at its turn limit without a report, the orchestrator sends it one
follow-up message asking for the report (continuing the same agent) before escalating.

## The loop

```
user: "implement next task"  (/implement [N])
  │
  ▼
[1] preflight: clean tree, fetch origin/main, detect GitHub tooling
[2] select task (docs/workflow/task-tracking.md#selecting-the-next-task)
[3] claim: status:in-progress, comment, create branch from origin/main
  │
  ▼
[4] implementer ──report──▶ [5] reviewer
        ▲                         │
        └── CHANGES_REQUESTED ────┘   (max 3 rounds)
                                  │ APPROVE
                                  ▼
[6] push, open PR (Closes #N), status:in-review
[7] wait for CI ── red ──▶ implementer (with logs) ──▶ reviewer (delta) ──▶ push   (max 2 rounds)
                  │ green
                  ▼
[8] squash-merge, report to user, optionally continue with the next task
```

## Handoffs

**Orchestrator → implementer** (prompt contains):

- issue number, title, full body, labels;
- branch name (already checked out);
- round number and, on rework, the reviewer's findings verbatim or the failing CI log excerpt;
- path of the spec file if one exists.

**Implementer → orchestrator** (fixed report format, see the agent file): summary, files changed,
commands run with results, commit SHAs, deviations and open questions.

**Orchestrator → reviewer**: issue number/title/body, spec path, base ref (`origin/main`), round
number, previous findings (for re-review).

**Reviewer → orchestrator**: `VERDICT: APPROVE | CHANGES_REQUESTED` and findings grouped as
`BLOCKER`, `MAJOR`, `MINOR`, each with `file:line` and a concrete fix suggestion.

Approval rule: no `BLOCKER` and no `MAJOR` findings. `MINOR` findings are listed in the PR body; if
worth doing later, `/manager` turns them into issues.

## Escalation

The orchestrator stops, sets `status:blocked` and comments on the issue when:

- review does not converge after 3 rounds, or CI stays red after 2 fix rounds;
- the implementer reports that the issue is ambiguous, contradicts an ADR, or needs a product
  decision;
- the task needs something only a human can provide (secrets, accounts, paid services) — in that
  case use `status:needs-human` with a checklist instead.

## Artifacts

| Artifact                        | Written by   | Purpose                                           |
| ------------------------------- | ------------ | ------------------------------------------------- |
| `docs/specs/<N>-<slug>.md`      | implementer  | Plan and implementation notes for size-M tasks    |
| ADR in `docs/architecture/adr/` | implementer  | Any new architectural decision                    |
| Issue comments                  | orchestrator | Claim, blockers, final summary                    |
| PR body                         | orchestrator | What changed, how it was verified, review summary |
| `docs/roadmap.md`               | manager      | Phase status                                      |

## Cloud vs local sessions

- **Local** (Claude Code CLI with `gh` authenticated): branches `task/<N>-<slug>`; CI is awaited
  with `gh pr checks --watch`.
- **Cloud** (claude.ai/code): the session has one designated branch — use it for the task. Force-push
  is never used (and is denied by `.claude/settings.json`). If its previous PR was merged, update it
  with a no-op-content merge instead of a reset: `git fetch origin main && git switch <branch> &&
git merge --no-edit origin/main`, verify `git diff --stat origin/main HEAD` is empty, then push
  normally (fast-forward). If it still has unmerged commits of its own, stop and ask the user. When
  the previous PR is only waiting on CI, pipeline the next task on a local `task/<N>-<slug>` branch
  cut from the designated branch's HEAD, then once that PR merges, update the designated branch as
  above and `git cherry-pick <base>..task/<N>-<slug>` the task commits onto it (no rebase of pushed
  commits), regenerating `pnpm-lock.yaml` via `pnpm install` on conflicts. One task landed on the
  designated branch at a time; use `git worktree add` for a second concurrent checkout. CI is awaited
  by subscribing to PR activity; the session wakes on CI events.
- Tool mapping for both: `docs/workflow/github-tooling.md`.
