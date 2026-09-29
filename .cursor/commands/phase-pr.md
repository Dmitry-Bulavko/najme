# Phase PR

Create or update the phase pull request `cursor/alpha → main` so CI runs on every push.

1. `gh pr list --head cursor/alpha --state open` — if one exists, update its body (step 3) and stop.
2. Otherwise create it as a **draft**:
   `gh pr create --draft --base main --head cursor/alpha --title "Phase <Mx>: <epic title>" --body-file <file>`.
3. Body (follow `.github/pull_request_template.md` sections):
   - Summary: the phase goal (from the epic) and `Part of #<epic>`.
   - One `Closes #N` line per task of the phase that has commits on the branch.
   - Checklist of the phase's tasks with their status label.
   - Verification: CI status; how to try it locally.
4. Check CI: `gh pr checks <pr>`. A red check caused by your commits is fixed before the next task.
   Do not re-run jobs hoping for a flake; do not merge — Claude merges the phase PR.
