# Address review

Fix Claude's review findings for an issue labelled `status:changes-requested` (or the issue number
the owner gives).

1. `gh issue view N --comments` — read the **latest** Claude review (VERDICT, BLOCKER / MAJOR /
   MINOR with `file:line`), and any inline comments on the phase PR
   (`gh pr view --comments`, `gh api repos/{owner}/{repo}/pulls/<pr>/comments`).
2. `gh issue edit N --add-label status:in-progress --remove-label status:changes-requested`.
3. Fix every BLOCKER and MAJOR. Fix MINORs when cheap; otherwise explain why not. Add a test for
   every bug finding. Do not rewrite history: new commits only, `fix(<scope>): … (#N)`.
4. `pnpm format` and `pnpm check` green; push to `cursor/alpha`.
5. Hand off again (`status:in-review`) with a comment:

   ```
   Ready for review: <first-new-sha>^..<last-new-sha>
   Findings addressed:
   - <finding> → <what changed, commit>
   Not changed:
   - <finding> → <reason>
   Checks: pnpm check ✅ (<date>)
   ```
