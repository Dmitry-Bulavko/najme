# ADR-0012: Implementation in Cursor, review by Claude

- Status: Accepted
- Date: 2026-09-29
- Supersedes: the roles, branching and merge-policy parts of ADR-0008

## Context

M0 and most of the M1 API were built by Claude Code subagents (`/implement`: implementer →
reviewer → PR → CI → squash-merge, one task per PR). For M1's client work through the alpha (M7)
the owner moves implementation to **Cursor IDE** and keeps **Claude as the independent reviewer**.
Owner choices (2026-09-29):

- the whole roadmap to the alpha is decomposed into GitHub issues up front;
- Cursor commits into **one long-lived branch**;
- Cursor has an authenticated `gh` CLI (reads issues, sets labels, comments, opens PRs);
- the branch is merged into `main` **after each phase**;
- the owner tells Claude when to review.

## Decision

- **GitHub Issues stay the single source of truth** (ADR-0008 unchanged on this point). Epics per
  phase, tasks as sub-issues, labels for state. Two review states are added:
  `status:approved` and `status:changes-requested`.
- **Roles.**
  - _Owner_ — product decisions, secrets and accounts (`status:needs-human`), triggers reviews,
    approves releases.
  - _Cursor_ (implementer) — follows `AGENTS.md`, `.cursor/rules/` and `.cursor/commands/`:
    claims the next ready task, writes spec/code/tests/docs, runs `pnpm check`, commits and pushes
    to `cursor/alpha`, and hands off with a "Ready for review" comment naming the commit range.
  - _Claude_ (reviewer, `/review` skill) — reviews every handed-off task against the issue, the
    Definition of Done and the conventions; runs checks and UI screenshots; posts the verdict on the
    issue; merges the phase PR; grooms the next phase. Claude does not write feature code any more
    (fixing its own review tooling and docs excepted).
- **Branching.** One branch `cursor/alpha`, never force-pushed, never rebased or amended once
  pushed. Review fixes are new commits.
- **Phase PR.** One pull request `cursor/alpha → main` per phase (`Closes #N` for every task of
  the phase). CI (`ci`, `smoke`) runs on every push. It is merged by Claude with a **merge commit**
  (not squash, so per-issue commits stay in history) once every task of the phase is approved, CI is
  green and the epic's exit criteria are verified.
- **Phase gating.** Only the current phase's tasks are `status:ready`; later phases are `backlog`
  until Claude grooms them at the phase boundary against the code that actually landed.
- **Bounded loops.** A task that is still not approved after 3 review rounds, or that contradicts an
  ADR or needs a product decision, goes to `status:blocked` with a comment; the owner decides.
- **Fallback.** The `/implement` + subagent workflow of ADR-0008 remains available (for example
  when Cursor is unavailable) and still follows `docs/workflow/agentic-workflow.md`.

## Consequences

- `main` advances in phase-sized steps; the phase PR diff is large, so review happens per task on
  commit ranges, and the phase merge is a final check rather than the review itself.
- The handoff contract must be unambiguous without chat context: `AGENTS.md` and the Cursor
  rules are the implementer's whole briefing, and the review protocol lives in the `/review` skill.
- Issue bodies must be complete (acceptance criteria reference the standard blocks API-STD and
  UI-STD in `docs/workflow/definition-of-done.md`).
- **Tooling boundary (amendment 2026-09-30).** Cursor 2.4+ also loads skills and subagents from
  `.claude/`. In phase M1 it used `/review` and the `reviewer` subagent on its own commits,
  approved them, merged the phase PR and released the next phase. Since both tools post through the
  owner's GitHub account, the boundary is enforced by rules and by the review protocol:
  - `.claude/**` is Claude's tooling. Cursor never runs, applies or edits it. Every skill and
    subagent there is marked "Claude Code only", and the owner disables them in Cursor's settings.
  - Only a verdict posted by Claude counts. It carries a `Claude-Session:` line. `/review` treats any
    other verdict, `status:approved` label or merge as void and reviews the work again.
  - Cursor never sets review labels, merges, or changes phase gating. A violation is a BLOCKER.
