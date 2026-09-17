# CLAUDE.md

This is the single source of truth for any agent (Claude Code, Codex, or
otherwise) working in this repo. `AGENTS.md` only redirects here — don't
duplicate content there.

**Repo-wide convention: everything in English.** Code, identifiers, comments,
docs, commit messages, and every agent/skill instruction file. The one
exception is user-facing content for ALMA (LLM prompts, chatbot replies,
onboarding copy) — see [`docs/context.md`](docs/context.md#naming-convention-for-this-domain).

## Instruction hierarchy

```
.specify/memory/constitution.md   (highest authority, see below)
        ↓
this file (CLAUDE.md / AGENTS.md)
        ↓
active spec in .specify/specs/
        ↓
docs/conventions/ (architecture, naming, commits, frontend)
        ↓
relevant skill (.claude/skills/)
        ↓
in-the-moment chat preference
```

If a spec, a convention, a skill, or the chat contradicts the constitution,
the constitution wins, and that has to be said out loud, not silently
resolved.

## About the project

**ALMA** is a personal, local-first knowledge assistant: you talk to it, it
writes what it learns as Markdown notes in your own vault on disk, and those
notes get embedded so ALMA can work with them. It's Felix's **final degree
project** (Ingeniería en Sistemas de Información) — the plan is to keep
adding services under `services/` as it grows (see Roadmap below).

> **2026-09-17**: this repo's SDD scaffolding (`constitution.md`,
> `docs/context.md`, `docs/design-patterns.md`'s examples) was originally
> written against a "Provincial Public Works System" domain. That domain is
> retired — ALMA is the actual final project. See
> [`docs/context.md`](docs/context.md) for the current domain glossary and
> the note at the top of `.specify/memory/constitution.md` for what that
> means for each clause. A design-pattern example elsewhere in the docs that
> still talks about projects/roles/contractors is illustrating the *pattern*,
> not describing ALMA's actual domain — don't infer a business rule from it.

**Current state — read this before trusting any architecture description.**
The first ALMA feature (onboarding → chat → create-a-note-via-MCP-tool →
vectorize → browse/edit in a frontend) is specified in
[`.specify/specs/`](.specify/specs/) but not yet built: the Prisma schema is
empty and `mcp-server` only has a `helloWorldTool` example. The "Architecture"
section below describes what actually runs today; the active spec describes
what's being built next.

Growing monorepo (see the active spec for the two services being added):

- **`services/mcp-server`** — exposes MCP tools (today: one example tool).
  Will expose `createKnowledgeEntry` (writes a note to ALMA's vault) once
  that work starts.
- **`services/orchestrator`** — takes a natural-language question, talks to
  an LLM provider (Strategy pattern via `ILlmProvider`), and calls MCP tools
  on its behalf. Auth today is a single shared `KAA` header (per calling
  agent/channel) — there's only one person using ALMA, so no per-user
  identity/session is needed yet (see Clause V's note in the constitution).
- **`packages/shared`** — types/utilities shared between services.

## Pipeline: Spec-Driven Development (SDD)

This repo's methodology is **SDD, not TDD** — specs, not tests, drive scope
and sequencing. `.specify/` runs the pipeline:

```
Constitution → Specify → Clarify → Plan → Tasks → Implement → Verify
```

- `.specify/memory/constitution.md` — non-negotiable project principles
  (spec is the source of truth for business rules, layering, dependency
  injection, tenant/role data isolation). Outranks this file.
- `.specify/specs/` — active feature specs.
- No business rule is ever guessed or inferred. If it isn't written in the
  spec or in `docs/context.md`, it's an **Open Question**, not an `if`
  someone decided looked reasonable.
- **Vitest is used for verification** in the `Verify` step (and encouraged
  during `Implement`) — but writing a failing test before the code isn't a
  hard requirement here, unlike a strict-TDD shop. See `Testing` below for
  which workspaces actually have Vitest wired up.

## Agents (`.claude/agents/`)

The pipeline above is run by dedicated agents, not the general-purpose one:

- **`router`** — routes the SDD pipeline: figures out which stage a request
  is in and delegates. Implements nothing itself.
- **`planner`** — owns specs. Writes/updates specs, resolves domain
  ambiguity via the `grill-with-docs` skill, and **must** follow
  [`docs/conventions/`](docs/conventions/README.md) when writing a plan.
  Never writes executable code.
- **`implementer`** — writes application code. Takes one task at a time from
  `tasks.md`, applies Dependency Injection, follows
  [`docs/conventions/architecture.md`](docs/conventions/architecture.md) and
  [`docs/design-patterns.md`](docs/design-patterns.md). Can't change a spec's
  scope.
- **`tester`** — owns requirement verification. Looks only at a spec's User
  Stories/Acceptance Criteria (never the implementer's reasoning) and writes
  Vitest tests to break the system.
- **`quality-checker`** — owns technical quality: architecture, clean code,
  and compliance with `docs/design-patterns.md`, `docs/conventions/`, and the
  constitution.

## Skills (`.claude/skills/`)

- **`domain-modeling`** — builds and sharpens the domain model; glossary/ADR
  format in `ADR-FORMAT.md`/`CONTEXT-FORMAT.md`. Note: this repo keeps its
  glossary at `docs/context.md` rather than a root `CONTEXT.md` — if this
  skill is invoked, point it at that file.
- **`grill-with-docs`** — relentless interview to resolve a plan or an
  ambiguous domain term. Mandatory for `planner` during the Clarify phase,
  especially for ALMA domain terms not yet settled in `docs/context.md`.
- **`grilling`** — the generic version of the above, for stress-testing any
  plan or decision.

## Workspace layout

```
mcp-server-orchestrator/
├── .specify/                 # spec-kit: constitution.md + specs/
├── .claude/                  # this repo's agents/ and skills/
├── docs/
│   ├── context.md             # domain glossary (ALMA, resolved decisions)
│   ├── design-patterns.md     # Module, Service Layer, DI, Strategy, Factory
│   ├── ports.md                # port registry (30020+)
│   └── conventions/             # architecture, naming, commits, frontend
├── packages/
│   └── shared/                 # shared types/utils (build first)
└── services/
    ├── mcp-server/              # MCP tools — port 30020
    ├── orchestrator/            # LLM ↔ MCP coordination — port 30021
    │                            # specified next (see .specify/specs/):
    │                            # frontend (30022), knowledge-store (30025)
    │                            # planned after (see Roadmap): telegram-bot
    │                            # (30023), whatsapp-bot (30024)
```

## Common commands

This repo uses **pnpm workspaces** (`pnpm-workspace.yaml`) — always `pnpm`,
never `npm`.

### Initial setup

```bash
pnpm install              # Install all workspace dependencies
pnpm run build:shared     # REQUIRED: build shared before the services
pnpm run prisma:generate  # Generate the Prisma client
```

### Development

```bash
pnpm run dev:mcp-server      # MCP server on port 30020
pnpm run dev:orchestrator    # Orchestrator on port 30021
pnpm run dev:shared          # shared package in watch mode

pnpm run start:inspector-mcp # MCP Inspector, for debugging tools
```

### Build & production

```bash
pnpm run build                  # Build all workspaces
pnpm run build:mcp-server
pnpm run build:orchestrator
pnpm run start:mcp-server
pnpm run start:orchestrator
```

### Database (Prisma)

```bash
pnpm run prisma:generate  # Run after any schema change
pnpm run prisma:migrate
pnpm run prisma:studio
```

### Code quality

```bash
pnpm run format      # Prettier, all workspaces
pnpm run lint        # ESLint, all workspaces
pnpm run lint:fix
pnpm run test        # Vitest, workspaces that have it configured (see Testing)
```

### Clean

```bash
pnpm run clean       # Remove node_modules and dist everywhere
```

## Architecture (as it actually runs today)

### MCP Server (`services/mcp-server`)

- **Purpose**: exposes MCP tools. Today: a single `helloWorldTool` example —
  no database-backed tool exists yet.
- **Port**: `30020` (via `PORT` in `services/mcp-server/.env`).
- **Key files**:
  - `src/core/server.ts` — central tool registration (register new tools here)
  - `src/infraestructure/tools/` — tool implementations
  - `prisma/schema.prisma` — currently empty; per the active ALMA spec, the
    real schema is expected to live in `services/knowledge-store` instead of
    here (see `docs/context.md`), so don't fill this one in without checking
    that decision hasn't changed

**Tool registration pattern:**

```typescript
// 1. Create the tool in src/infraestructure/tools/myTool.ts
export function registerMyTool(server: McpServer) {
  server.tool(/* ... */);
}

// 2. Register it in src/core/server.ts
import { registerMyTool } from '../infraestructure/tools/myTool.js';
registerMyTool(server);
```

Tools stay thin (see [`docs/conventions/architecture.md`](docs/conventions/architecture.md)):
validate input with Zod, delegate to a service, format the response. As soon
as a tool needs Prisma or any other real dependency, that dependency is
injected — never `new PrismaClient()` inside the tool or a service.

### Orchestrator (`services/orchestrator`)

- **Purpose**: coordinates the LLM ↔ MCP conversation loop.
- **Port**: `30021` (via `PORT` in `services/orchestrator/.env`).
- **Pattern**: Strategy (`ILlmProvider`) + Factory (`LlmProviderFactory`) for
  interchangeable LLM providers — see
  [`docs/design-patterns.md`](docs/design-patterns.md).
- **Request flow** (`POST /api/inquire`):
  1. `index.ts` — Express entry point.
  2. `validateAgentMiddleware` — checks the `KAA` header against
     `KEY_ALLOWED_AGENTS`. This authenticates the calling **agent/channel**,
     not the person asking — ALMA is single-user for now, so there is no
     per-user identity resolution to do (see Clause V's note in the
     constitution for when that changes).
  3. `inquireController` — validates the request body (Zod), converts
     messages to the active provider's format.
  4. `Orchestrator.processConversation` — connects to the MCP server, fetches
     available tools, and loops (max 10 iterations): send messages to the
     LLM → if it requests tool calls, execute them via `McpClient` and feed
     results back → otherwise return the final answer.
  5. `OpenAIProvider` (or whichever provider `LLM_PROVIDER` selects) —
     implements `ILlmProvider`.
  6. `McpClient` — MCP protocol client (StreamableHTTP transport).

See [`services/orchestrator/ARCHITECTURE.md`](services/orchestrator/ARCHITECTURE.md)
for the full diagram.

**Adding a new LLM provider**:

1. Implement `ILlmProvider`.
2. Add a case for it in `LlmProviderFactory`.
3. Set `LLM_PROVIDER` in `.env`.

**Adding a new MCP tool**: register it in `server.ts`. Once ALMA is
multi-user (see Clause V's note in the constitution), a new tool touching
user data will also need an explicit entry in a role/identity permission map
— fail-closed, not listed means not visible. Not needed yet.

### Shared package (`packages/shared`)

- Minimal today — shared types and utilities.
- **Must be built before the services**: `pnpm run build:shared`.

## Domain, design patterns, and conventions

Kept out of this file so it doesn't grow unbounded — each is a living
document maintained as decisions get made:

- [`docs/context.md`](docs/context.md) — ALMA's domain glossary and resolved
  decisions.
- [`docs/design-patterns.md`](docs/design-patterns.md) — Module Pattern,
  Service Layer, Dependency Injection, Strategy Pattern, Factory Pattern.
- [`docs/conventions/`](docs/conventions/README.md) — naming, architecture,
  commits, and frontend conventions. Binding on `planner`, `implementer`, and
  `quality-checker`.
- [`docs/ports.md`](docs/ports.md) — port registry for every service.

## Environment variables

Port env var names differ by file **on purpose** — see
[`docs/ports.md`](docs/ports.md#rules) for why. Numbers must always match that
registry; if they don't, the config is a bug, not a fact to document around.

### MCP Server (`services/mcp-server/.env`)

```env
DATABASE_URL="postgresql://user:password@host:port/db_name"
PORT=30020
```

### Orchestrator (`services/orchestrator/.env`)

```env
PORT=30021
KEY_ALLOWED_AGENTS=your-secret-key
LLM_PROVIDER=openai        # openai | gemini | deepseek | copilot
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-nano
MCP_SERVER_URL=http://localhost:30020/mcp
```

### Root `.env` (used by `docker-compose.yml` only)

Maps the same values to per-service container env vars
(`MCP_SERVER_PORT`, `ORCHESTRATOR_PORT`, `DATABASE_URL`, ...) — see
`docker-compose.yml` and `.env.template`.

This repo's real `.env` files carry live secrets (API keys, DB credentials).
Never copy their values into a doc, a commit, or a log — quote the variable
name, never the value.

## Git workflow

See [`docs/conventions/commits.md`](docs/conventions/commits.md) for the full
Conventional Commits + branching rules. Short version:

- **`main`**: production-ready code only. Never commit directly.
- **`develop`**: active development, default PR target.
- Feature branches: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`.

## Testing

**Vitest is installed for `services/orchestrator`** (added alongside this
doc pass). It is **not yet installed for `services/mcp-server`** — flagged as
an open gap, since `implementer`/`tester` assume Vitest exists everywhere. It
will also be required for the frontend service once that's scaffolded (see
[`docs/conventions/frontend.md`](docs/conventions/frontend.md)).

```bash
pnpm --filter @mcp-server-sma/orchestrator run test
```

### Health check

```bash
curl http://localhost:30021/health
```

### Exercise the orchestrator with a tool call

```bash
curl -X POST http://localhost:30021/api/inquire \
  -H "Content-Type: application/json" \
  -H "KAA: your-secret-key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Use the hello tool to greet John"}
    ]
  }'
```

More examples in `services/orchestrator/TEST_API.md`, if present.

## Key technical details

- **Node**: v18+
- **Package manager**: **pnpm** (workspace-enabled) — not npm.
- **Modules**: ES Modules (`"type": "module"`).
- **Database**: PostgreSQL via Prisma ORM (schema currently empty).
- **TypeScript**: strict mode.
- **Imports**: use the `.js` extension on relative imports (TS+ESM
  requirement).

## Common issues

1. **Workspace dependency errors**: `pnpm install` at the root, then
   `pnpm run build:shared`.
2. **Prisma client errors**: `pnpm run prisma:generate`.
3. **Port conflicts**: check `PORT` in the real `.env` of the service you're
   running against [`docs/ports.md`](docs/ports.md).
4. **MCP connection errors**: make sure `mcp-server` is running before
   starting `orchestrator`.

## Roadmap: upcoming services

Final-project scope — new services get added under `services/` following the
same pnpm-workspace + `packages/shared` pattern, each claiming the next free
port from [`docs/ports.md`](docs/ports.md):

- **Frontend** (Next.js, port `30022`) — onboarding + chat + vault
  explorer/editor. Layout decided in
  [`docs/conventions/frontend.md`](docs/conventions/frontend.md). **Specified**
  — see the active spec in [`.specify/specs/`](.specify/specs/).
- **`knowledge-store`** (port `30025`) — owns Postgres/pgvector (Prisma) and
  the vault's filesystem I/O; called by `mcp-server` and `frontend`. See
  [`docs/context.md`](docs/context.md) for why this is a separate service
  instead of living inside `mcp-server`. **Specified** — see the active spec.
- **Telegram bot** (port `30023`) — a future channel, same shape as the
  frontend but talking to Telegram instead of a browser. Not scoped in any
  spec yet.
- **WhatsApp bot** (port `30024`) — same channel pattern as Telegram. Not
  scoped in any spec yet.

Every new service goes through the same SDD pipeline (Constitution → Specify
→ Clarify → Plan → Tasks → Implement → Verify) and records its own domain
decisions in [`docs/context.md`](docs/context.md).
