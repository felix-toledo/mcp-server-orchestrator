# Domain Context: Public Works System

> **Status: target domain, not yet implemented.** Everything below describes
> the domain this project is being built for — a public-works oversight
> assistant for a provincial government (Argentina) — and the decisions
> already made about it. As of 2026-09-17, none of the roles/permissions/
> tools/tables described here exist in code: the Prisma schema is empty
> (`// Ready for your new models!`) and `services/mcp-server` only has a
> `helloWorldTool` example. This file is a living glossary of domain
> decisions for when this gets built, kept in sync by the `planner` agent via
> the `grill-with-docs` skill — read it before asking a domain question that
> might already be answered here, and update it the moment a new one is
> resolved. Business rules never get invented; if it's not written here or in
> an active spec, it's an Open Question.

## Naming convention for this domain

The real-world system this models is entirely in Spanish (it's an Argentine
provincial government product, and the people using it — governors,
inspectors, area supervisors — speak Spanish). Two different languages serve
two different audiences, and both matter:

- **Code, schema, docs, tool names → English.** Matches the repo-wide
  convention (see [`conventions/naming.md`](./conventions/naming.md)).
- **User-facing content → Spanish.** LLM system prompts, chatbot replies, any
  UI copy, and any data that mirrors real paperwork (e.g. a `Role.name` value
  a government office actually calls a role) stay in Spanish, because the end
  users are Spanish speakers. Translating a role's *display name* to English
  would just make the assistant harder to use for the people it's for.

The table below gives the English term this project should use in code,
paired with the Spanish term a domain expert would recognize.

| Code term (English)                 | Domain term (Spanish)     | What it is                                                                 |
| ------------------------------------ | -------------------------- | --------------------------------------------------------------------------- |
| `Project` / "public work"            | `Proyecto` / "obra"        | The core entity: a public-works project (status, budget, contractor, schedule, location). |
| `User`                                | `Usuario`                  | A person who can query the assistant.                                      |
| `Role`                                | `Rol`                      | A named permission bundle a `User` holds (`Role.name` is real data, not a fixed enum — e.g. ADMIN, GOBERNADOR, INSPECTOR, SUPERVISOR_AREA). |
| `Stage`                               | `Etapa`                    | A phase of a project's schedule (has a planned end date).                   |
| `financialProgress` / `physicalProgress` | `avanceFinanciero` / `avanceFisico` | Two independent progress metrics on a `Project` — see "Delay" below for why the gap between them matters. |
| `category dimension` (`group`/`subgroup`, `tag`, `agency`, `governmentPillar`) | `grupo`/`subgrupo`, `etiqueta`, `organismo`, `ejeGobierno` | Four unrelated ways to categorize a `Project` — see "Category" below. |
| `awardedContractor`                   | `proveedorAdjudicado`      | The contractor awarded a project's bid.                                    |
| `AssistantQueryLog`                   | `ConsultaLog`              | Audit row for one assistant request/response cycle.                        |
| `channel`                             | `canal`                    | Which surface the user is asking from: `telegram`, `web`, (planned) `whatsapp`. |

## Resolved decisions

### User identity and role-based permissions — target design

The orchestrator needs to resolve **who** is asking, not just **which
agent/channel** is calling it (the existing `KAA` header only authenticates
the calling channel/agent, not the person). Target design, to build when this
feature is actually scoped:

- Middleware chain: `validateAgentMiddleware` (exists today, unchanged) →
  a new `resolveUserMiddleware` → the request controller.
- **Telegram channel**: sends `X-Channel: telegram` + `X-Phone` (the bot asks
  for it once per chat via Telegram's native "share contact" button).
- **Web channel**: sends `X-Channel: web` + `X-Email`, added server-to-server
  by the web backend that already authenticated the user — the shared `KAA`
  secret never reaches the browser.
- `resolveUserMiddleware` looks up the active `User` by phone (matching the
  last 10 digits, since phone formatting in the source data is inconsistent)
  or by email, loads their `Role`s, and attaches `req.user`. No match → 403.
  **There is no anonymous role.**
- Permission model: a table mapping `Role.name` → the list of MCP tools that
  role may see. The MCP client filters the tool catalog before it ever
  reaches the LLM — a role can't see, and therefore can't hallucinate a call
  to, a tool it isn't permitted. The request handler re-validates every tool
  call name against the same permitted set before executing it (defense in
  depth, doesn't trust the pre-filtered catalog alone).
- Data scope: force a `projectType` filter into `listProjects`-style tool
  args when a role has exactly one allowed scope — the LLM can't override it.
  Area-based scope (for an `AREA_SUPERVISOR` role) is still an **open
  question**: no tool accepts an area parameter to filter by yet.
- **Verified fact** (checked against a real database snapshot, `obras-local`,
  on 2026-09-08): 162 of 574 `User` rows had a phone number on file, in loose
  formats (`3794594248`, `+54 9 379 491-3416`, `3794 682077`). A "last 10
  digits" normalization matched all three formats in the sample. A real user
  without a phone on file will get rejected (403) on the Telegram channel —
  that's a data-entry gap to close, not a code bug.

**How to apply**: once this is actually being implemented, "my projects" /
"my area" should work by having the system prompt pass the resolved identity
to the LLM as an implicit filter, not by asking the user again.

### Progress write-back and push notifications — out of scope

- **"Log my latest progress update"**: out of scope. Every tool in this
  system is read-only (`findMany`/`findFirst`/`groupBy`, never a write).
  Reason: without verified user identity in the pipeline, writing to a
  `Progress` table with no way to confirm who submitted it is a data-integrity
  risk, not just a feature gap. Revisit only once a write path is explicitly
  scoped in a spec.
- **"Notify me when a project I follow changes status"**: out of scope. This
  needs a subscription + push mechanism (websocket/email/cron) — it isn't a
  synchronous MCP tool call pattern. Achievable today by re-asking manually.

### "Delay" (for a top-10-most-delayed-projects ranking) = financial vs. physical progress gap

Operational definition: a large positive
`financialProgress - physicalProgress` is the signal — "paid for but not
built" is exactly the management red flag this ranking exists to surface.
This does **not** use a schedule comparison (`Stage.plannedEndDate` vs. today).

**How to apply**: that ranking sorts by this gap, descending — it's a
separate ranking from "largest budget" (sorted by amount, descending).

### "Category" is not a single schema field

A `Project` can be categorized along **four unrelated dimensions**:
`group`/`subgroup` (the primary hierarchical categorization), `tag`
(free-form, many-to-many), `agency` (the responsible department/ministry/
municipality), and `governmentPillar` (a fixed enum: DEVELOPMENT / GENDER /
INCLUSION / MODERNIZATION). The resolved approach is two generic tools
parameterized by a `kind` argument (`listCategories`, `projectsByCategory`)
instead of one tool per dimension — so the conversation "what categories
exist" → "show me projects in category X" works uniformly across all four.

**How to apply**: a fifth categorization dimension appearing later (a
guideline, a master plan, a sustainable-development-goal tag) becomes a new
`kind` case in the categories tool — not a new file per dimension.

### Tool/scope coverage per role — target design

On top of the identity/permissions design above, the target tool catalog
needs to cover the questions each role actually asks (admin, governor,
inspector, area referents) without duplicating tools:

- `listProjects` / `listPendingTasks` need an `agencyId` parameter, so scope
  enforcement can restrict an `AREA_SUPERVISOR` to their own agency.
- `getProjectDetail` needs to include the awarded contractor, amount, term,
  and bidding/award/inauguration dates, plus pending requirements.
- `projectsAssignedToInspector` needs coordinates (for the inspector's visit
  map); scope enforcement forces the requesting inspector's own `userId` —
  they can't query another inspector's assignments.
- `projectsPendingDocumentation` should also flag projects missing an
  assigned owner or missing coordinates ("what data is still missing").
- `usersSummary` (active/inactive/recently-accessed users, groupable by
  ministry — ADMIN only) and `projectImpact` (population reached and jobs
  created, single project or aggregate — GOVERNOR) are net-new tools with no
  overlap with the above.
- **Deliberately not planned as separate tools**: "projects ready to
  inaugurate" / "ready for bidding" / "still in feasibility study" — these
  are just `listProjects(status: ...)` with the right `ProjectStatus` value.
  Same for "aligned to a given policy pillar" — already covered by
  `listCategories`/`projectsByCategory` with `kind: governmentPillar`.

**How to apply**: any new MCP tool must be added to the role→tool permission
map explicitly (fail-closed: not listed = not visible). Agency-based scoping
today only applies to the tools listed above — a new tool needing area scope
must be added to that same enforcement set.

### Assistant query audit trail — target design

Every call to the conversation-processing entry point (success, iteration
limit, or exception) should be logged to an `AssistantQueryLog` table: user,
roles, channel, question, answer, which MCP tools were used (with args and
per-call success/failure), and duration. Logging should be best-effort — a
logging failure must never break the response to the user, only get logged to
the console.

`AssistantQueryLog` deliberately has **no foreign key relation** to `User`:
the log must survive a user being deleted or deactivated.

A `reviewAssistantQueries` tool (ADMIN only) should let the assistant answer
"what went wrong" in natural language — filterable by channel, user, a day
window, and an errors-only flag (covering both a fully failed request and the
subtler case of one failed tool call the LLM recovered from anyway).

**How to apply**: if/when this table is created, do it with a real Prisma
migration from the start (`prisma migrate`, not `db push`) — this repo
currently has no `prisma/migrations/` history to build on, so there's no
"existing migration chain" to preserve.

**Conversation grouping — decided against, for now.** A logged query has no
field grouping it with the rest of the same back-and-forth conversation,
because no channel sends a conversation identifier to the orchestrator today.
If this needs to be approximated later without a schema change: group a
user's logged queries by timestamp gaps under ~10 minutes. If it needs to be
exact: add an optional `conversationId` to the log table plus an optional
`X-Conversation-Id` header — a channel that doesn't send it just doesn't get
grouped, without breaking anything.
