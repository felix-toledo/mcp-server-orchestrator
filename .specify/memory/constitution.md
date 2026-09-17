# Constitution — ALMA

Non-negotiable principles for this project. No agent, human or model may skip
them "to go faster." If a plan or a task tenses against a clause, the tension
gets resolved here, in writing — not in the code.

> **2026-09-17**: this constitution originally governed a "Provincial Public
> Works System" domain. That domain is retired (see `docs/context.md`) in
> favor of ALMA, Felix's actual final degree project. Clauses I–IV are
> domain-agnostic and still apply as written. Clause V was written for a
> role/phone-based multi-tenant system that no longer describes ALMA's
> current single-local-user scope — see the note on Clause V below instead
> of assuming it still applies verbatim.

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

**Why**: a guessed business rule is a bug wearing a feature's clothes —
doubly so once ALMA holds another person's private notes and a guess about
"who can see what" becomes a trust/security bug instead of a UX nitpick.

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

**Why**: "works in my manual test" isn't sufficient evidence for a system
meant to keep working as it grows. Where Vitest is required, the test is the
executable contract.

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

**Currently not applicable**: ALMA is a single-local-user application for
this iteration (see [`docs/context.md`](../../docs/context.md)) — there is
exactly one `User` row and no role model, so there is no tenant boundary to
enforce yet. This clause is kept, not deleted, because the moment ALMA grows
a second real user (multi-user vault, a shared/team deployment — see the
Roadmap in `CLAUDE.md`), the rule below becomes binding again immediately,
without needing a new constitutional amendment:

- Every Prisma query touching another user's data must filter strictly by
  the requesting user's identity.
- There is no "implicit admin" query and no read access without user context
  once a second user exists.
- Identity context is resolved exactly once, near the entry edge
  (middleware/controller), and passed explicitly down to services — never
  re-derived mid-tool or mid-service from partial data.
- Any new tool or service querying user-owned data declares, in its own code
  and in the spec that originated it, which identity filter it applies. If
  the rule isn't defined yet, that's an Open Question (Clause I) — it does
  not get implemented "wide open for now, restricted later."

**Why**: a query without this filter isn't an ordinary bug once ALMA is
multi-user — it's one person reading another person's private notes. Keeping
the clause dormant-but-written means that failure mode gets designed against
from the first line of multi-user code, not bolted on after the fact.

---

## Precedence

`Constitution` > `AGENTS.md` / `CLAUDE.md` > active spec >
`docs/conventions/` > relevant skill > in-the-moment style preference.

If an agent detects it can't complete a task without violating a clause, it
stops and reports it — it doesn't pick whichever clause is most convenient to
break.
