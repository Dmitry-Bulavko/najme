# Najme docs — index for agents

This folder is the shared memory of the project. Agents read it instead of re-discovering context,
and write back to it when they make decisions. Keep documents short, factual and current — a stale
doc is worse than no doc.

## Read first (every task)

1. `../CLAUDE.md` — golden rules and commands.
2. `workflow/definition-of-done.md` — what "done" means.
3. The issue itself, plus any spec in `specs/` that it links.

## Then read by task area

| Task touches…                   | Read                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Product behaviour, naming       | `product/vision.md`, `product/glossary.md`                                                |
| Anything architectural          | `architecture/overview.md`, relevant `architecture/adr/*`                                 |
| API endpoints / DTOs            | `conventions/api.md`, ADR-0002                                                            |
| Database schema / booking logic | `architecture/data-model.md`, ADR-0005, ADR-0009                                          |
| Web or mobile UI                | ADR-0003, `conventions/i18n.md`, ADR-0004                                                 |
| Tests                           | `conventions/testing.md`                                                                  |
| New env var / secret            | `conventions/env-vars.md`                                                                 |
| CI, Docker, deploy              | ADR-0007, `runbooks/deploy.md`                                                            |
| Notifications / background jobs | ADR-0006                                                                                  |
| Issues, labels, PR process      | `workflow/task-tracking.md`, `workflow/agentic-workflow.md`, `workflow/github-tooling.md` |

## Layout

```
docs/
├── README.md                 ← you are here
├── roadmap.md                ← phases M0–M7, owned by /manager
├── product/                  ← what we build and why
│   ├── vision.md
│   ├── glossary.md
│   └── open-questions.md     ← undecided product questions (ask the user, then record the answer)
├── architecture/
│   ├── overview.md
│   └── adr/                  ← Architecture Decision Records (NNNN-title.md)
├── conventions/              ← how we write code
├── workflow/                 ← how work flows through issues, agents and PRs
├── specs/                    ← per-issue implementation specs (written by the implementer)
└── runbooks/                 ← operational how-tos for humans and agents
```

## Writing rules

- English, Markdown, wrapped at ~100 chars, formatted by Prettier.
- One topic per file. Link, don't duplicate.
- Decisions go to an ADR; open questions go to `product/open-questions.md`; task-level design goes
  to `specs/`.
- When code and docs disagree, fix whichever is wrong in the same PR.
