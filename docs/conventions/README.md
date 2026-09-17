# Conventions

Standards every agent and every human contributor follows in this repo, so
the codebase reads as one voice regardless of who (or what) wrote a given
file. These are binding, not suggestions:

- [`architecture.md`](./architecture.md) — layering, dependency injection,
  comments policy, error handling, when an abstraction is justified.
- [`naming.md`](./naming.md) — variables, functions, types, files, folders,
  database fields, MCP tool names. Also settles the English-code /
  Spanish-user-content split.
- [`commits.md`](./commits.md) — Conventional Commits, branch naming, PR
  targeting.
- [`frontend.md`](./frontend.md) — Next.js App Router layout, once the
  frontend service exists.

Related, but not part of this set: [`../design-patterns.md`](../design-patterns.md)
(the named patterns — Module, Service Layer, Strategy, Factory) and
[`../context.md`](../context.md) (the domain glossary).

## Binding on agents

`planner` **must** follow these conventions when writing a spec or a plan —
a plan that contradicts `naming.md` or `architecture.md` is a defect in the
plan, not a style nitpick to fix later. `implementer` and `quality-checker`
apply the same files when writing and reviewing code. See each agent's own
file in `.claude/agents/` for how this obligation is phrased for their role.

## Precedence

Same rule as everywhere else in this repo:
`.specify/memory/constitution.md` > `CLAUDE.md`/`AGENTS.md` > active spec >
these conventions > skill defaults > in-the-moment chat preference. A
convention here can be overridden by the constitution, never the reverse.
