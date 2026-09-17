# Commit & Branch Conventions

## Commit messages: Conventional Commits

This repo follows [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types in use here:**

| Type       | When                                                              |
| ---------- | ------------------------------------------------------------------ |
| `feat`     | a new capability (a new tool, a new endpoint, a new UI screen)     |
| `fix`      | a bug fix                                                          |
| `docs`     | documentation only (this repo's `docs/`, `CLAUDE.md`, `AGENTS.md`, agent/skill files) |
| `refactor` | code change that changes neither behavior nor its test coverage    |
| `perf`     | a change made specifically for performance                        |
| `test`     | adding or correcting tests, no production code change              |
| `build`    | build system, dependencies, Dockerfiles, `pnpm-workspace.yaml`     |
| `ci`       | CI/CD pipeline config                                              |
| `chore`    | everything else that isn't user-facing and isn't covered above     |
| `revert`   | reverting a previous commit                                        |

**Scope** (optional): the workspace or area affected —
`feat(mcp-server): ...`, `fix(orchestrator): ...`, `docs(context): ...`.

**Breaking changes**: add a `BREAKING CHANGE:` footer, or a `!` after the
type/scope (`feat(orchestrator)!: ...`), describing what breaks and how to
migrate.

**Examples:**

```
feat(mcp-server): add listProjects tool with agencyId scope

fix(orchestrator): stop double-counting tool-call iterations

docs(context): resolve delay ranking definition

chore(ports): move all services to the 30020+ range
```

## Branches

- **`main`** — production-ready code only. Never commit directly.
- **`develop`** — active development, default PR target.
- **Feature branches**: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, matching
  the commit type it's mostly made of.

## Pull requests

- Target `develop`, not `main`.
- PR title follows the same Conventional Commits format as a squash-merge
  commit would.
- A PR that touches a domain decision (roles, permissions, schema) must also
  update [`../context.md`](../context.md) in the same PR — not as a follow-up.
