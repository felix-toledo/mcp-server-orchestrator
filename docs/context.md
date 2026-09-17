# Domain Context: ALMA

> **Status: active domain.** This file replaces the previous "Provincial
> Public Works System" domain glossary (superseded 2026-09-17 — see git
> history if that content is ever needed again). ALMA is Felix's final
> degree project (Ingeniería en Sistemas de Información): a personal,
> local-first knowledge assistant. You talk to it, it writes what it learns
> as Markdown notes on your own disk, and those notes get embedded so ALMA
> (and, later, you) can find them again. This is a living glossary of domain
> decisions, kept in sync by the `planner` agent — read it before asking a
> domain question that might already be answered here, and update it the
> moment a new one is resolved. Business rules never get invented; if it's
> not written here or in an active spec, it's an Open Question.

## `docs/context-extended.md` — confirmed authoritative (2026-09-18)

`docs/context-extended.md` is the PFG master document: two-person team
(Felix + Facundo Peloso, with Lic. Silvina Podestá as course instructor), a
4-table long-term data model, a SkillRouter+RAG+reranker reasoning engine,
CHRONOS (a scheduler module not previously mentioned in `brain_vault/`),
RAFT pilot, WhatsApp/Cloudflare infra. Felix confirmed it directly and
intentionally added it to the repo (2026-09-18) — it's tracked in git, not
gitignored. Two of its recommendations were explicitly **overridden** for
this PoC rather than adopted as-is — see "Origin and vision" below and
[Resolved decisions](#resolved-decisions) — everything else in it (the
long-term vision, the eventual 4-table model, the reasoning engine) is real
context for *where this PoC is headed*, not something this PoC implements
yet. Treat it the same way as `brain_vault/`: useful background, not a spec.

## Origin and vision (`brain_vault/memory/` + `docs/context-extended.md`)

Before this repo had any ALMA-specific spec, Felix sketched the intended
shape of ALMA as a set of "skills" in `brain_vault/memory/`, later expanded
into the full PFG master document at `docs/context-extended.md` (see above —
confirmed authoritative). Both describe the same four conceptual pillars —
worth reading once for context, not themselves a spec for this PoC:

- **Memory/materialization** (`brain_vault/` calls this MNEMOS) — ALMA
  writes its thoughts to Markdown files in a local vault (data sovereignty —
  nothing lives only in someone else's cloud), with YAML frontmatter and
  `[[WikiLinks]]` toward a future knowledge graph. **This iteration's
  `createKnowledgeEntry` MCP tool + `knowledge-store` service are this
  pillar's first real implementation** — see
  [`.specify/specs/knowledge-store/001-vectorization`](../.specify/specs/knowledge-store/001-vectorization/spec.md).
- **Reasoning/orchestration** (MNEMOS's counterpart there, LOGOS) — decides
  intent, and (in a future iteration) searches the vault's vectors before
  answering so personal context shapes the reply, per
  `context-extended.md`'s SkillRouter+RAG+reranker design. **Retrieval is
  out of scope this iteration.**
- **End-of-day consolidation** (ONIROS) — `context-extended.md` §5 now gives
  this pillar concrete, non-negotiable-once-built rules (never deletes
  long-term knowledge; an explicit "remember this" bypasses it entirely and
  goes straight to `KnowledgeEntry`; everything else gets curated at day's
  end by its own judgment; it also generates next-day insight summaries).
  **Out of scope this iteration** — no `Conocimientos diarios`/logs table
  exists yet (see the simplified-schema decision below).
- **Scheduling** (CHRONOS in `context-extended.md` — new, wasn't in
  `brain_vault/`) — a persistent queue for calendar/reminder/async actions
  (`pg-boss` was `brain_vault/`'s specific suggestion for the mechanism).
  **Out of scope this iteration.**

**How to apply — naming, confirmed 2026-09-18**: Felix explicitly doesn't
want the mythological names (LOGOS/MNEMOS/CHRONOS/ONIROS) used as real
module/service names in code, even though `context-extended.md` itself says
to keep them "tal cual" — that recommendation is **overridden** for this
codebase. Code uses plain descriptive names instead: `orchestrator`,
`knowledge-store`, `createKnowledgeEntry`, and (whenever a scheduler service
actually gets scoped) something like `scheduler` or `task-queue`, not
`chronos`. The mythological names stay fine to use in conversation/the PFG
report when talking about the four conceptual pillars above — just not in
`services/*` folder names, class names, or table names.

## Naming convention for this domain

Same reasoning as before, different audience: ALMA's only user (for this
iteration) is Felix himself, a Spanish speaker, and the onboarding copy he
already wrote is in Spanish.

- **Code, schema, docs, tool names → English.** Matches the repo-wide
  convention (see [`conventions/naming.md`](./conventions/naming.md)).
- **User-facing content → Spanish.** Onboarding copy, chat replies, and any
  system prompt text stay in Spanish. This is now ALMA's carve-out from the
  repo-wide English convention (the Public Works carve-out it replaces is
  gone along with that domain).

## Glossary

| Code term (English)     | What it is                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `User`                   | The single local person using this ALMA instance (see [Resolved decisions](#resolved-decisions) — not multi-tenant this iteration). |
| `Purpose`                | The onboarding answer to "what do you want ALMA for" — a fixed enum, see below.                          |
| `KnowledgeEntry`         | One row of metadata (path, title, summary, embedding) for a Markdown note living in the vault. The full content lives only in the `.md` file, never duplicated into the row. |
| `vault`                  | The folder of Markdown files ALMA reads/writes, `%USERPROFILE%\Documents\alma\vault` for this iteration (Windows-only, see Resolved decisions). |
| `knowledge-store`        | The new service owning Postgres/pgvector access **and** vault filesystem I/O — the single source of truth every other service goes through (see Resolved decisions). |
| `createKnowledgeEntry`   | The MCP tool the orchestrator calls to make ALMA write a new note.                                       |

`Purpose` enum values (English name → the Spanish onboarding option it maps
to):

| Enum value                | Onboarding option (Spanish)                                    |
| -------------------------- | ---------------------------------------------------------------- |
| `PERSONAL_DAILY`            | día a día personal (recordatorios, notas, organización)         |
| `AUTOMATION_PRODUCTIVITY`   | automatizaciones y productividad                                 |
| `PROJECTS_WORK`             | proyectos y trabajo                                              |
| `SECOND_BRAIN_STUDY`        | segundo cerebro / estudio e investigación                        |
| `TEAM_BUSINESS`             | uso en equipo o empresa                                          |

## Resolved decisions

### Single local user, no authentication — this iteration

ALMA runs on Felix's own machine for one person. Confirmed 2026-09-17:

- Onboarding creates **at most one** `User` row. If a `User` already exists,
  the frontend skips onboarding and goes straight to the chat/explorer view.
- There is no login, no session token, no password. The `KAA` header
  (`validateAgentMiddleware`) keeps authenticating the *frontend as a
  calling channel* to the orchestrator, same as today — it has nothing to do
  with per-person identity, because there's only one person.
- Multi-user (separate vaults, real accounts) is explicitly a future
  concern, not scoped here — see the active spec's Out of Scope section.

**How to apply**: no tool or endpoint in this iteration needs a `userId`
parameter from its caller. `knowledge-store` resolves "the one user" itself.

### `knowledge-store` is the single source of truth for both DB and vault files — target architecture

Confirmed 2026-09-17: rather than mcp-server owning Prisma directly, ALMA
gets a **new, separate service** (`services/knowledge-store`) that owns:

- The Postgres/pgvector connection (Prisma) — `User` and `KnowledgeEntry`.
- All filesystem I/O on the vault (`%USERPROFILE%\Documents\alma\vault`) —
  reading, writing, and listing `.md` files.
- Embedding generation (calls an external embeddings API — see the active
  spec for the provider default) whenever a note is created or edited.

**Why**: Felix's own reasoning — the frontend (for the explorer/editor) and
the orchestrator (for future retrieval) will both need this data too, not
just mcp-server. A single service owning both halves (row + file) keeps them
from drifting out of sync, instead of duplicating that sync logic in every
caller.

**How to apply**: `services/mcp-server`'s `createKnowledgeEntry` tool is a
thin remote caller of `knowledge-store`'s HTTP API — it does not touch
Prisma or the filesystem itself. `services/frontend` calls `knowledge-store`
directly for vault browsing/editing (this supersedes the old "frontend only
talks to the orchestrator" rule, which was written for the Public Works
domain's LLM-mediated-everything model); `services/frontend` still talks to
`services/orchestrator` for chat. This is a deliberate, hard-to-reverse
architecture choice — see [`../adr/`](./adr/) once the ADR for it is written.

### Retrieval (RAG over the vault) and write-back to existing notes from chat — out of scope this iteration

- The orchestrator can make ALMA **create** a new note via
  `createKnowledgeEntry`. It cannot yet **search** the vault's vectors to
  ground an answer — that's LOGOS's future job (`retrieve_info` in
  `brain_vault/`), scoped in a later spec.
- Chat cannot edit an existing note. Editing is a frontend-only action (open
  a file in the explorer, change it, save) this iteration.

### Vault path — Windows-only, fixed location, this iteration

`%USERPROFILE%\Documents\alma\vault` is hardcoded for this iteration
(Felix's own machine) — confirmed 2026-09-18, changed from an earlier
`%APPDATA%\.alma\vault` default specifically because a `Documents`-visible
folder is easier to find, matching `context-extended.md`'s own reasoning for
recommending a home-visible location over an OS-standard one. `alma` (not
`.alma`) is the root folder name; `vault` is the one subfolder this PoC
needs — `context-extended.md`'s config/backups subfolders are deferred, not
decided against.

Cross-platform path resolution (macOS/Linux equivalents) is explicitly
deferred — see [`knowledge-store/001-vectorization`](../.specify/specs/knowledge-store/001-vectorization/spec.md)
for how this is isolated behind one function (`vaultRepository.ts`) so it's
a small change later, not a scattered one.

### Data model: 2-table PoC schema is deliberate, not accidental

`context-extended.md`'s eventual data model has 4 tables (`Usuario` with a
password hash, `Conocimientos`, `Logs de conversaciones`, `Conocimientos
diarios` for ONIROS's staging). This PoC intentionally implements only
`User` (no password — see the no-auth decision above) and `KnowledgeEntry`,
confirmed 2026-09-18: the goal right now is to prove the create → embed →
browse/edit loop works end to end, not to build the full long-term schema
ahead of the features that would use it. The other two tables
(conversation logs, daily staging) have no reason to exist before ONIROS or
conversation-history persistence are actually scoped — adding them now would
be exactly the kind of speculative, unused schema
[`docs/conventions/architecture.md`](./conventions/architecture.md#abstractions)
warns against.
