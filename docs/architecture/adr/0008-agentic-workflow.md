# ADR-0008: Agentic development workflow

- Status: Accepted
- Date: 2026-09-28

## Context

Most implementation is done by AI agents. We want predictable throughput, low cost, independent
review, and a transparent record of work that a human can steer.

## Decision

- **GitHub Issues are the single source of truth** for work. Roadmap phases are epics
  (`type:epic`) with tasks as sub-issues; state is tracked with labels
  (`docs/workflow/task-tracking.md`).
- **Roles:**
  - `/manager` skill (main session) — owns the backlog: creates and grooms issues, advances the
    roadmap, prepares releases.
  - `/implement` skill (main session) — orchestrator: selects the next task, delegates, opens the
    PR, waits for CI, merges.
  - `implementer` subagent — writes code, tests and specs on the task branch.
  - `reviewer` subagent — independent review against the issue, spec and conventions; read-only.
- **Cost:** subagents run on `sonnet` with `effort: medium` and a minimal tool set (no GitHub/MCP
  tools, so their context stays small). The orchestrator passes them exactly the context they need.
- **Independence:** the reviewer sees the issue, the spec and the diff — never the implementer's
  reasoning.
- **Bounded loops:** at most 3 review rounds and 2 CI-fix rounds per task; then the task is marked
  `status:blocked` with an explanation and a human decides.
- **Artifacts:** medium/large tasks get a spec in `docs/specs/`; decisions go to ADRs; all
  persistent knowledge lives in `docs/`.
- **Merge policy:** the orchestrator squash-merges when the reviewer approves and CI is green.
  Releases to `production` require explicit human approval.

## Consequences

- A task that cannot be expressed as a clear issue with acceptance criteria is not ready for agents;
  `/manager` must refine it first.
- Quality depends on docs staying current — every PR that changes behaviour updates docs.
