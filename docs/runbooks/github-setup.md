# GitHub repository setup (one-time, human)

These settings make the agentic workflow safe. Do them once after the bootstrap PR is merged.

## 1. Branch protection for `main`

Settings → Branches (or Rules → Rulesets) → add a rule for `main`:

- Require a pull request before merging (0 required approvals — the reviewer agent's approval lives
  in the PR body; the orchestrator merges).
- Require status checks to pass: select the `ci` job from the **CI** workflow.
- Block force pushes and deletions.

## 2. Branch protection for `production`

- Create the branch once: `production` from `main` (after M0 is complete — see `deploy.md`).
- Rule: require a pull request, require the `ci` check, block force pushes. Only `/manager release`
  PRs target it.

## 3. General settings

- Settings → General → Pull Requests: enable **Allow squash merging** and **Allow merge commits**;
  enable **Automatically delete head branches**.
- Settings → Actions → General → Workflow permissions: **Read and write** (needed for label sync and
  GHCR pushes); allow GitHub Actions to create pull requests: not needed.

## 4. Environment `production`

Settings → Environments → New environment `production`:

- Deployment branches: only `production`.
- Secrets and variables: see the table in `docs/conventions/env-vars.md` and the steps in
  `docs/runbooks/deploy.md`.

## 5. Packages (GHCR)

After the first deploy workflow run, the images `najme-api` and `najme-web` appear under the
account's Packages. Keep them private; the server pulls with `GHCR_READ_TOKEN`.

## 6. Labels

Labels are defined in `.github/labels.yml` and synced automatically by the **Labels** workflow on
every push to `main` that changes that file. To force a sync: Actions → Labels → Run workflow.
