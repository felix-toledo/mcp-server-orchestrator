# Architecture Conventions

These are the rules `quality-checker` enforces and `planner` designs against.
The named patterns behind them (Module, Service Layer, DI, Strategy, Factory)
are documented in [`../design-patterns.md`](../design-patterns.md); this file
is the more mechanical "where does this code go" checklist.

## Layering, top to bottom

1. **Entry point** (`index.ts` per service) — wires up the HTTP server,
   middleware, and starts listening. No business logic.
2. **Tools / controllers** — thin. Validate input (Zod), call one service
   method, format the response. Never build a multi-step Prisma query inline,
   never encode a business rule (e.g. "which role sees which field") here.
3. **Services** — the business logic. Depend only on interfaces and injected
   dependencies (see DI below), never on Express `Request`/`Response` or MCP
   protocol types — a service shouldn't need to know which transport called
   it.
4. **Data access** (Prisma) — called from services only, never from a tool or
   controller directly.

## Dependency Injection is mandatory

`PrismaClient` and every other external client (HTTP client, future
WhatsApp/Telegram SDK client) is constructed once, at each service's
bootstrap, and passed down through constructors. Never `new PrismaClient()`
(or any external client) inside a service or tool body. This is what lets
`tester` swap in a fake for a unit test without touching a real database.

## One MCP server, one orchestrator — don't blur the line

- `services/mcp-server` owns **data access and domain tools**. It never talks
  to an LLM provider.
- `services/orchestrator` owns **the conversation loop and LLM coordination**.
  It never touches Prisma or the database directly — it only calls MCP tools.
- A new capability that needs both (e.g. "summarize this project's history")
  is: a new tool in `mcp-server` that returns the data, called by the
  orchestrator's existing loop — not new direct DB access in `orchestrator`.

## Comments

Default to **no comments**. Code should read clearly enough from good names
and small functions that a comment restating "what" is redundant. Write a
comment only when it captures a **why** that isn't visible in the code itself:
a non-obvious constraint, a workaround for a specific upstream bug, an
intentional deviation from the obvious approach. If deleting the comment
wouldn't confuse the next reader, delete it.

Never write a comment that references a task, a ticket, or "the fix for X" —
that context belongs in the commit message and rots as the code evolves.

## Error handling

- Validate at the boundary (tool/controller input) with Zod; trust internal
  function signatures past that point — don't re-validate the same value
  three layers deep.
- Don't add a `try/catch` for an error condition that can't actually occur
  given the types. A `try/catch` that swallows an error silently (no log, no
  rethrow) is always a `quality-checker` finding.
- Best-effort side effects (e.g. an audit log write) may fail without failing
  the main request — but that failure must still be logged, never swallowed
  silently.

## New dependencies

A new npm package needs a one-line reason in the PR description (what it
replaces, or what it does that would otherwise be non-trivial to write). An
unexplained new dependency is a `quality-checker` finding regardless of how
small it is.

## Abstractions

An interface, factory, or config layer with exactly one real caller is
over-engineering, not "good practice ahead of time" — `quality-checker` flags
it. Introduce the abstraction when the second real case shows up, not before.
