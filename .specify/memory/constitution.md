# Constitution — MCP Server & Provincial Public Works System

Non-negotiable principles for this project. No agent, human or model may skip
them "to go faster." If a plan or a task tenses against a clause, the tension
gets resolved here, in writing — not in the code.

This file outranks `CLAUDE.md`, any agent's `AGENTS.md`, and any loose
instruction in chat. If something conflicts, the constitution wins, and the
reason is stated explicitly.

---

## I. Spec as Source of Truth

No business rule is ever guessed.

- If `planner` (or any agent) can't find a business rule written explicitly
  in the spec, **it doesn't infer it or copy it from a similar case** — it
  writes it into the spec's "Open Questions" section and leaves it pending a
  human answer.
- A spec with unanswered Open Questions **does not advance** to Plan, and
  those questions **are never answered in code** (i.e., "resolving" an
  ambiguity by writing the `if` that seemed reasonable and moving on is
  forbidden).
- Code is never the source of truth for a business rule. The spec is. If code
  and spec disagree, the spec wins (or the spec gets corrected, explicitly,
  with a human in the loop).

**Why**: in a system that gates access to public-works data by role and
phone number, a guessed business rule is a security or institutional-trust
bug wearing a feature's clothes.

## II. Encode Every Correction

If an error slips through a gate (lint, test, typecheck, human review), the
fix isn't just fixing the symptom — it includes strengthening the gate that
let it through.

- A bug that breaks an already-documented rule → add or reinforce the test
  that makes it impossible next time.
- A pattern lint doesn't catch → add or adjust a lint rule.
- A type too loose to have prevented the error → narrow the type.
- Naming the gate that was added/reinforced is part of reporting the
  correction — not optional, not a "nice to have" for later.
- A gate is never disabled just to get a green build. If a gate is
  legitimately in the way, it gets discussed and adjusted with the human, not
  bypassed with `--no-verify`, an unjustified `eslint-disable`, or a skip.

**Why**: without this, the team (human + agents) relearns the same mistake
every few weeks. Every correction should leave the system structurally harder
to break the same way twice.

## III. Spec-Driven Development, Verified with Vitest

The project's methodology is **SDD (Spec-Driven Development)**, not strict
TDD: scope and sequencing come from the spec's pipeline
(`Constitution → Specify → Clarify → Plan → Tasks → Implement → Verify`), not
from a test-first discipline applied to every line of code.

- **Vitest is the verification tool for the `Verify` step**, currently
  required in `services/orchestrator` and (once it exists) the Next.js
  frontend — see [`docs/ports.md`](../../docs/ports.md) and the roadmap in
  `CLAUDE.md`. It is **not yet required** in `services/mcp-server`; that's a
  tracked gap, not a silent exception.
- A test doesn't have to be written before the implementation, but every
  Acceptance Criterion in a spec must end up covered by a Vitest test before
  a feature is considered done in a workspace where Vitest is required.
- `implementer` cannot mark a task done, in a Vitest-covered workspace,
  without its corresponding test passing.
- `tester` writes tests to break the system (empty state, wrong or
  insufficient role, unauthorized/unrecognized phone number, network error,
  edge-case limits), not to confirm the happy path `implementer` already
  wrote.
- A test that has never been seen to fail proves nothing — it might be
  written wrong and passing vacuously. When a test is added, run it against
  the pre-fix code first (or a deliberately broken version) to confirm it
  fails for the right reason.

**Why**: in a system with role/phone-based access control, "works in my
manual test" isn't sufficient evidence. Where Vitest is required, the test is
the executable contract.

## IV. Layer Separation

Strictly follows what's documented in
[`docs/design-patterns.md`](../../docs/design-patterns.md) and
[`docs/conventions/architecture.md`](../../docs/conventions/architecture.md):
Module Pattern, Service Layer, Dependency Injection, Strategy Pattern.

- **MCP tools** (`src/infraestructure/tools/`) are thin: they receive input,
  validate it (Zod), call a service, and format the response for the MCP
  protocol. No heavy business logic, no inline complex Prisma queries, no
  business rules computed here.
- **Business logic** lives in the service layer (`src/services/` or
  equivalent), as classes or functions that receive their dependencies
  injected.
- **`PrismaClient` is injected**, never instantiated with `new PrismaClient()`
  inside a service or a tool. It's created once (at the core/bootstrap layer)
  and passed down. This is what makes the service layer testable without a
  real database.
- When behavior varies by platform or entity type (a channel type, a project
  type, a role), use the Strategy Pattern instead of a growing `if/else` tree
  inside a service. When a Strategy has more than one real implementation,
  centralize its construction in a Factory (see
  [`docs/design-patterns.md`](../../docs/design-patterns.md)).

**Why**: without this separation, every tool ends up with its own copy of
business logic and data access, impossible to unit test, and easy to break
the tenant/role isolation rule inconsistently between tools.

## V. Tenant/Role Isolation

Every Prisma query touching public-works data must filter strictly by the
requesting user's role and phone number/identity, once that identity
resolution exists (see [`docs/context.md`](../../docs/context.md) for the
target design — not yet implemented as of this writing).

- There is no "implicit admin" query and no read access without user context
  on the `/api/inquire` path once identity resolution ships.
- Role/identity context is resolved exactly once, near the entry edge
  (middleware/controller), and passed explicitly down to services — never
  re-derived mid-tool or mid-service from partial data.
- Any new tool or service querying public-works data declares, in its own
  code and in the spec that originated it, which role/identity filter it
  applies. If the rule for what a role can see isn't defined yet, that's an
  Open Question (Clause I) — it does not get implemented "wide open for now,
  restricted later."

**Why**: this is the project's actual domain. A query without this filter
isn't an ordinary bug — it's a data leak in a provincial system holding
sensitive public-works and project data.

---

## Precedence

`Constitution` > `AGENTS.md` / `CLAUDE.md` > active spec >
`docs/conventions/` > relevant skill > in-the-moment style preference.

If an agent detects it can't complete a task without violating a clause, it
stops and reports it — it doesn't pick whichever clause is most convenient to
break.
