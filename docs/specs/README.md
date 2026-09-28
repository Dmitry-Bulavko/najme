# Specs

Per-issue implementation specs. They are the working memory that survives between review rounds,
CI-fix rounds and sessions.

- **When:** required for `size:M` tasks and anything touching the database schema or public API
  contracts; optional for `size:S`.
- **Who:** the `implementer` writes it _before_ coding and appends implementation notes at the end.
  The `reviewer` reads it to understand intent.
- **Name:** `<issue-number>-<short-slug>.md`, e.g. `12-api-health-endpoint.md`.
- **Template:** [`_template.md`](_template.md).
- **Lifecycle:** specs stay in the repo after merge as a record of why things are the way they are.
  If a later task changes the design, it writes a new spec and links the old one — do not rewrite
  history.
