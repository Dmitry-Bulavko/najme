# Task tracking

All work is tracked in GitHub Issues of `Dmitry-Bulavko/najme`. No code change without an issue.

## Hierarchy

- **Epic** (`type:epic`, `phase:Mx`) = one roadmap phase (see `docs/roadmap.md`). Holds the goal,
  scope and exit criteria. Never implemented directly.
- **Task** = a sub-issue of an epic. Must be completable in one PR (size S or M).

## Labels

| Group       | Labels                                                                                     | Rule                                 |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| `type:`     | `feature`, `bug`, `chore`, `docs`, `infra`, `epic`                                         | exactly one                          |
| `area:`     | `api`, `web`, `mobile`, `contracts`, `i18n`, `infra`, `agents`                             | one or more                          |
| `priority:` | `P0` (critical path), `P1` (needed for phase exit), `P2` (nice to have), `P3` (someday)    | exactly one on tasks                 |
| `status:`   | `backlog`, `ready`, `in-progress`, `in-review`, `blocked`, `needs-human`                   | exactly one on open tasks            |
| `size:`     | `S` (≤ ~200 lines, one area), `M` (≤ ~600 lines or 2 areas), `L` (too big — must be split) | exactly one on tasks                 |
| `phase:`    | `M0` … `M7`                                                                                | exactly one; matches the parent epic |

Labels are defined in `.github/labels.yml` and synced by the `labels` workflow.

## Status lifecycle

```
backlog ──groom──▶ ready ──/implement claims──▶ in-progress ──PR opened──▶ in-review ──merged──▶ (closed)
                     ▲                              │                         │
                     └──────── unblocked ◀── blocked ◀─────── loop limit / failure
needs-human: waiting for a human action (secrets, accounts, product decision). Agents skip it.
```

- `backlog` — idea captured, not refined. `/manager groom` refines it to `ready`.
- `ready` — has goal, acceptance criteria, size S/M, dependencies listed. Agents may pick it.
- `in-progress` — claimed by `/implement`; branch exists.
- `in-review` — PR open, waiting for CI/merge.
- `blocked` — agent could not finish; the last comment explains why and what is needed.
- `needs-human` — requires the user (secrets, account setup, decision). Checklist in the body.

## Issue body format (tasks)

```markdown
## Goal

One or two sentences: the outcome, from the user's or system's perspective.

## Context

Why now; links to ADRs, docs, related issues.

## Acceptance criteria

- [ ] Observable, testable statement
- [ ] …

## Out of scope

- …

## Technical notes

Hints: files/modules to touch, contracts to add, pitfalls. Optional.

## Dependencies

Blocked by #12
Blocked by #13
(or "None")
```

Bugs use the same sections but replace Goal/Context with **Steps to reproduce / Expected / Actual**.

## Selecting the next task (used by `/implement`)

1. If an open issue has `status:in-progress` (an interrupted run), resume it first.
2. Otherwise list open issues with `status:ready`, excluding `type:epic`, `size:L` and
   `status:needs-human`.
3. Drop issues whose `## Dependencies` section lists `Blocked by #N` where #N is still open.
4. Sort by phase (`M0` first) → priority (`P0` first) → issue number (oldest first).
5. Take the first. If none remain, report that and suggest `/manager groom` or `/manager advance`.

## Pull requests

- Title: Conventional Commit style with the issue number: `feat(api): health endpoint (#12)`.
- Body follows `.github/pull_request_template.md` and contains `Closes #N`.
- Squash-merged by the orchestrator after reviewer approval and green CI.
