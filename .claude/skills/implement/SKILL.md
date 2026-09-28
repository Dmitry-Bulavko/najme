---
name: implement
description: Orchestrates implementation of the next Najme task (or a given issue) end to end — selects the highest-priority ready GitHub issue, claims it, delegates coding to the implementer subagent and review to the reviewer subagent, opens the PR, waits for CI and squash-merges. Use when the user says "implement the next task", "take the next issue", "work on #N", "имплементируй следующую задачу", "возьми следующую задачу", "сделай задачу #N".
argument-hint: '[issue-number] [--dry-run]'
---

# /implement — task orchestrator

You are the orchestrator. You own GitHub communication, git branch/push/PR/merge and the loop
between the `implementer` and `reviewer` subagents. You do **not** write product code yourself —
if something needs changing, send it back to the implementer. Keep your own context lean: pass
subagents the issue text and paths, not file dumps.

Arguments: `$ARGUMENTS` — optional issue number; `--dry-run` = only report which task would be
picked and why, change nothing.

References (read once per run, only the parts you need):
`docs/workflow/task-tracking.md`, `docs/workflow/agentic-workflow.md`,
`docs/workflow/github-tooling.md`. Repository: `Dmitry-Bulavko/najme`.

## Step 0 — Preflight

1. `git status --porcelain` must be empty. If not, stop and tell the user what is uncommitted.
2. `git fetch origin main`.
3. Detect GitHub tooling: `mcp__github__*` tools (cloud) or `gh` (local, `gh auth status`). If
   neither works, stop and say so.
4. Detect the branch policy: if this session was assigned a designated branch (cloud sessions state
   it in the system prompt), you must use that branch. Otherwise use `task/<N>-<slug>`.

## Step 1 — Select the task

- If an issue number was given: read it; it must be open, not `type:epic`, not `size:L`, not
  `status:needs-human`, and its `Blocked by #N` dependencies must be closed. Otherwise explain and
  stop.
- Otherwise apply the selection algorithm from `docs/workflow/task-tracking.md`:
  1. resume any open `status:in-progress` issue first (check for an existing branch/PR for it);
  2. else open `status:ready` issues, excluding `type:epic`, `size:L`, `status:needs-human`;
  3. drop issues with open `Blocked by #N` dependencies (check each referenced issue's state);
  4. sort: phase (M0 first) → priority (P0 first) → issue number;
  5. none left → report the state of the backlog and suggest `/manager groom` or
     `/manager advance`; stop.
- `--dry-run`: print the chosen issue (number, title, labels) and the runner-ups with the reason
  they were skipped; stop.

## Step 2 — Claim

1. Set labels: replace the `status:*` label with `status:in-progress` (write the full label list).
2. Comment on the issue: `🤖 Claimed by /implement. Branch: <branch>.`
3. Branch:
   - `git switch -c task/<N>-<slug> origin/main` (slug: 3–5 words from the title, kebab-case); or
   - designated branch: `git switch <branch>` and `git reset --hard origin/main` **only if** that
     branch has no unmerged commits of its own (check `git log origin/main..<branch>`; if its
     previous PR is merged, the leftovers are already in main). If it has unmerged work, stop and
     ask the user.
   - When resuming an in-progress task, check out its existing branch instead and continue from the
     appropriate step.

## Step 3 — Implement

Launch the `implementer` subagent (foreground) with a prompt containing:

```
Issue #<N>: <title>
Labels: <labels>
Branch: <branch> (already checked out)
Round: <k>
Spec: <docs/specs/<N>-<slug>.md if it exists, else "none — create one if size:M or schema/contract change">

<full issue body>

[Round > 1 only] Reviewer findings to address:
<verbatim BLOCKER/MAJOR/MINOR list>
[CI fix only] Failing CI checks and log excerpt:
<job name, failing step, last ~80 relevant log lines>
```

Read the report. If the subagent stopped at its turn limit without delivering the report format,
send one follow-up message to the same agent asking it to deliver its report now; escalate only if
that also fails to produce one. If `STATUS: BLOCKED`, go to **Escalate**. Verify commits exist:
`git log --oneline origin/main..HEAD`.

## Step 4 — Review (max 3 rounds)

Launch the `reviewer` subagent with: issue number/title/body, spec path, base `origin/main`, round
number, and on re-review the previous findings plus the previous reviewed HEAD sha. If it stops at
its turn limit without a verdict, send one follow-up message asking it to deliver its report now;
escalate only if that also fails to produce one.

- `VERDICT: APPROVE` → Step 5.
- `CHANGES_REQUESTED` → back to Step 3 with the findings (round + 1).
- After round 3 still not approved → **Escalate**.

If you strongly disagree with a finding (e.g. it contradicts an ADR or the issue), you may drop it —
but record the reasoning in the PR body under "Review notes".

## Step 5 — Pull request

1. `git push -u origin <branch>` (retry with backoff on network errors only).
2. Create the PR against `main`:
   - Title: Conventional Commit style + issue: `feat(api): health endpoint (#N)`.
   - Body (from `.github/pull_request_template.md`): summary, `Closes #N`, changes by area, how it
     was verified (checks from the reports), acceptance criteria checklist, review summary
     (rounds, verdict, MINOR findings not addressed), translations to verify, follow-ups.
3. Labels: `status:in-progress` → `status:in-review`.

## Step 6 — CI (max 2 fix rounds)

- Local: `gh pr checks <PR> --watch --fail-fast`.
- Cloud: `subscribe_pr_activity` for the PR and end the turn with a one-line status; continue from
  here when the CI event arrives.
- Green → Step 7.
- Red → fetch the failing job logs (`docs/workflow/github-tooling.md`), run Step 3 in "CI fix" mode,
  then a delta review (Step 4, reviewing only the new commits), push. After 2 failed fix rounds →
  **Escalate**. Never re-run CI just hoping for a flake more than once, and never skip or disable
  tests.

## Step 7 — Merge and report

1. Confirm: reviewer approved the current HEAD (re-review if commits were added after approval), CI
   green on the current HEAD, PR mergeable.
2. Squash-merge (`merge_method: squash`; locally `gh pr merge <PR> --squash --delete-branch`),
   commit title = PR title.
3. The issue closes via `Closes #N`; make sure it is closed and remove the `status:*` label.
4. If the issue was the last open sub-issue of its epic, mention that `/manager advance` is due.
5. Report to the user (in the user's language), briefly: issue, PR link, what was built, review
   rounds, anything needing their attention (translations to verify, follow-ups, needs-human items).
6. If the user asked to keep going ("and continue", "do the next ones"), start again at Step 0.
   In a cloud session with a designated branch, continuing is allowed because Step 2 resets the
   branch onto the fresh `origin/main`.

## Escalate

1. Labels: set `status:blocked` (or `status:needs-human` when only a human can resolve it — secrets,
   accounts, product decisions).
2. Comment on the issue: what was attempted (rounds), the exact blocker, what decision or input is
   needed, and the branch/PR where the work lives.
3. Push the branch (so work is not lost) and, if a PR exists, leave it open as a draft-quality
   record.
4. Tell the user in one short paragraph. Stop — do not pick another task automatically.
