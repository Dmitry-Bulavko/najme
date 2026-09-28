# GitHub tooling reference

Skills must work both in cloud sessions (GitHub MCP tools, no `gh`) and locally (`gh` CLI). Detect
once per run: if `mcp__github__*` tools are available, use them; otherwise use `gh` (check
`gh auth status`). Repository: owner `Dmitry-Bulavko`, repo `najme`.

| Operation              | GitHub MCP tool                                                               | `gh` CLI                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| List issues by label   | `list_issues` (`labels`, `state: OPEN`, `fields`)                             | `gh issue list -l status:ready --state open --json number,title,labels,body`                         |
| Read issue             | `issue_read` (`method: get`)                                                  | `gh issue view N --json number,title,body,labels,state`                                              |
| Issue comments         | `issue_read` (`method: get_comments`)                                         | `gh issue view N --comments`                                                                         |
| Sub-issues of an epic  | `issue_read` (`method: get_sub_issues`)                                       | `gh api repos/{owner}/{repo}/issues/N/sub_issues`                                                    |
| Create issue           | `issue_write` (`method: create`, `labels`, `parent_issue_number`)             | `gh issue create -t … -b … -l …` then `gh api -X POST …/issues/EPIC/sub_issues -F sub_issue_id=<id>` |
| Update labels/state    | `issue_write` (`method: update`, full `labels` list)                          | `gh issue edit N --add-label … --remove-label …`; `gh issue close N`                                 |
| Comment on issue/PR    | `add_issue_comment`                                                           | `gh issue comment N -b …` / `gh pr comment N -b …`                                                   |
| Create PR              | `create_pull_request`                                                         | `gh pr create -B main -H <branch> -t … -b …`                                                         |
| Read PR / checks       | `pull_request_read` (`get`, `get_check_runs`, `get_status`)                   | `gh pr view N --json …`; `gh pr checks N`                                                            |
| Wait for CI            | `subscribe_pr_activity`, then end the turn and resume on the CI event         | `gh pr checks N --watch --fail-fast`                                                                 |
| CI logs                | `get_job_logs` (`run_id`, `failed_only: true`, `return_content: true`)        | `gh run view <run-id> --log-failed`                                                                  |
| Merge PR               | `merge_pull_request` (`merge_method: squash` for tasks, `merge` for releases) | `gh pr merge N --squash --delete-branch` / `--merge`                                                 |
| Workflow runs (deploy) | `actions_list` (`list_workflow_runs`, `resource_id: deploy.yml`)              | `gh run list -w deploy.yml`; `gh run watch <id>`                                                     |

## Notes

- `issue_write` with `labels` **replaces** the whole label set: read current labels, change the
  `status:` label, write the full list back.
- The sub-issue API needs the issue **id** (not the number); `issue_write create` with
  `parent_issue_number` avoids that — but it fails if any of the labels does not exist yet in the
  repo. Labels come from `.github/labels.yml`; if one is missing, create the issue without a parent
  (plain create auto-creates labels) and then attach it with `sub_issue_write add` using the
  returned `id`. `sub_issue_write` returns the whole parent issue — expect a large response.
- Keep PR/issue bodies free of secrets and environment details.
- Search tools in MCP are semantic; for exact label filtering always use `list_issues`.
