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
[`.specify/specs/`](.specify/specs/) and built end to end, minus one manual
step: the actual Postgres migration hasn't been run on this dev machine yet
(Docker Desktop wasn't running when it was implemented — see
`.specify/specs/knowledge-store/001-vectorization/tasks.md` T3). Once that's
done, `pnpm run dev:knowledge-store`, `dev:mcp-server`, `dev:orchestrator`,
and `dev:frontend` should give a working app end to end.

Four-service monorepo:

- **`services/mcp-server`** — exposes MCP tools: `helloWorldTool` (example)
  and `createKnowledgeEntry` (writes a note to ALMA's vault via
  `knowledge-store`).
- **`services/orchestrator`** — takes a natural-language question, talks to
  an LLM provider (Strategy pattern via `ILlmProvider`), and calls MCP tools
  on its behalf. Auth today is a single shared `KAA` header (per calling
  agent/channel) — there's only one person using ALMA, so no per-user
  identity/session is needed yet (see Clause V's note in the constitution).
- **`services/knowledge-store`** — owns Postgres/pgvector and the vault's
  filesystem I/O. See its own subsection below.
- **`services/frontend`** — Next.js: onboarding, chat, and the vault
  explorer/editor. See its own subsection below.
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
    ├── frontend/                # Next.js — onboarding, chat, explorer — port 30022
    ├── knowledge-store/         # Postgres/pgvector + vault fs I/O — port 30025
    │                            # planned next (see Roadmap): telegram-bot
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
pnpm run dev:knowledge-store # Knowledge store on port 30025
pnpm run dev:frontend        # Next.js frontend on port 30022
pnpm run dev:shared          # shared package in watch mode

pnpm run start:inspector-mcp # MCP Inspector, for debugging tools
```

Run all four in separate terminals for a working end-to-end setup — start
`knowledge-store` and `mcp-server` first (`orchestrator` and `frontend` both
call things that expect them to already be up).

### Build & production

```bash
pnpm run build                  # Build all workspaces
pnpm run build:mcp-server
pnpm run build:orchestrator
pnpm run build:knowledge-store
pnpm run build:frontend
pnpm run start:mcp-server
pnpm run start:orchestrator
pnpm run start:knowledge-store
pnpm run start:frontend
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

- **Purpose**: exposes MCP tools. Has no database of its own — it never
  touches Prisma (see [ADR-0001](docs/adr/0001-knowledge-store-as-separate-service.md)),
  it calls `services/knowledge-store` over HTTP instead.
- **Port**: `30020` (via `PORT` in `services/mcp-server/.env`).
- **Key files**:
  - `src/core/server.ts` — central tool registration (register new tools here)
  - `src/infraestructure/tools/` — tool implementations (`helloWorldTool.ts`,
    `createKnowledgeEntryTool.ts`)
  - `src/infrastructure/knowledgeStoreClient.ts` — thin HTTP client for
    `knowledge-store`, injected into tools that need it

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

### Knowledge Store (`services/knowledge-store`)

- **Purpose**: owns Postgres/pgvector (Prisma) and all filesystem I/O on
  ALMA's vault — the single source of truth `mcp-server` and (later)
  `frontend` both go through. See
  [ADR-0001](docs/adr/0001-knowledge-store-as-separate-service.md) and
  [`.specify/specs/knowledge-store/001-vectorization/`](.specify/specs/knowledge-store/001-vectorization/).
- **Port**: `30025` (via `PORT` in `services/knowledge-store/.env`).
- **Layering**: `api/` (controllers, thin) → `services/` (`UserService`,
  `KnowledgeEntryService`, business logic) → `vault/` (`VaultRepository`,
  filesystem) + Prisma (`core/server.ts` is the only place `PrismaClient` is
  `new`'d — see [`docs/design-patterns.md`](docs/design-patterns.md)).
- **Vitest required** here from the start (unlike `mcp-server`) — see
  Clause III and the Testing section below.
- **`embedding` is `Unsupported("vector(1536)")?` in the Prisma schema —
  optional is load-bearing, not stylistic.** Prisma Client excludes
  `Unsupported` fields from generated types entirely, and if the field is
  *required* with no default, Prisma removes `create` from that model's
  delegate altogether (found during Implement — not documented anywhere
  obvious). Reading/writing the actual vector goes through
  `$executeRaw`/`$queryRaw` (`KnowledgeEntryService.setEmbedding`), never the
  normal `create`/`update` calls — the row exists with a `null` embedding
  for the brief moment between `knowledgeEntry.create` and the follow-up
  raw `UPDATE`, both inside the same service call.
- **First migration needs `CREATE EXTENSION IF NOT EXISTS vector;`** run
  before Prisma's own migration SQL — pgvector isn't enabled by default even
  on the `pgvector/pgvector:pg16` image's fresh database.

### Frontend (`services/frontend`)

- **Purpose**: onboarding, chat, and the vault explorer/editor — see
  [`.specify/specs/frontend/`](.specify/specs/frontend/) (3 specs:
  `001-onboarding`, `002-chat`, `003-explorer`).
- **Port**: `30022` — hardcoded in `package.json`'s `dev`/`start` scripts
  (`next dev -p 30022`), not read from `PORT` at runtime like the Express
  services — Next's CLI needs the port as a flag.
- **Own `tsconfig.json`, does NOT extend the repo root one** — Next's build
  needs `moduleResolution: "bundler"` + `jsx: "preserve"`, incompatible with
  the other 3 services' shared `NodeNext` config. Relative imports inside
  `services/frontend/src/` therefore do **not** use the `.js` extension
  (unlike every other service) — Next's bundler resolution doesn't want it.
- **No Tailwind/component library** — one hand-written `app/globals.css`.
  Deliberate, for a PoC this size; revisit if the UI grows.
- **Never run `pnpm run build`/`build:frontend` — including the root
  `pnpm run build` that builds every workspace — while `dev:frontend` is
  running.** They write to the same `services/frontend/.next` folder;
  running both corrupts it (confirmed twice in one session: root
  `pnpm run build` alone was enough, not just `build:frontend` directly).
  Symptom: `Cannot find module './NNN.js'` /
  `__webpack_modules__[moduleId] is not a function` — looks like a real app
  bug, isn't. Fix: stop whatever's listening on 30022 (`next dev` forks a
  `next-server` child with a *different* command line — find it by port,
  e.g. `Get-NetTCPConnection -LocalPort 30022 -State Listen`, not by
  grepping for "next dev"), `rm -rf services/frontend/.next`, restart
  `dev:frontend`. (`e2e/`'s Playwright server doesn't hit this — it builds
  into `.next-e2e` instead, see `docs/conventions/frontend.md`.)
- **Layering**: `app/` (routes only) → `actions/` (Server Actions) →
  `lib/` (framework-agnostic HTTP clients: `knowledge-store-client.ts`,
  `orchestrator-client.ts`) — see
  [`docs/conventions/frontend.md`](docs/conventions/frontend.md). Chat goes
  through `orchestrator`'s `/api/inquire`; onboarding and the explorer call
  `knowledge-store` directly (ADR-0001's deliberate exception to "always
  through the orchestrator").
- **Vitest required** here (Clause III) — `lib/` and `actions/` are tested
  (mocked `fetch`/mocked clients); components are not (no jsdom/
  testing-library this iteration — see each frontend spec's plan.md for why).

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
PORT=30020
KNOWLEDGE_STORE_URL=http://localhost:30025
```

`mcp-server` never touches Prisma or `DATABASE_URL` directly — see
[ADR-0001](docs/adr/0001-knowledge-store-as-separate-service.md). Its
`prisma/` folder and `@prisma/client`/`prisma` dependencies were removed
once that stopped being theoretical: two packages both generating
`@prisma/client@6.16.2` collide in pnpm's shared virtual store (whichever
`prisma generate` ran last silently overwrites the other's output) — a real
failure hit during Implement, not a hypothetical.

### Orchestrator (`services/orchestrator/.env`)

```env
PORT=30021
KEY_ALLOWED_AGENTS=your-secret-key
LLM_PROVIDER=deepseek      # openai | gemini | deepseek | copilot
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
MCP_SERVER_URL=http://localhost:30020/mcp
```

### `knowledge-store` (`services/knowledge-store/.env`)

```env
PORT=30025
DATABASE_URL=postgresql://alma:alma@localhost:15432/alma
OPENAI_API_KEY=sk-...           # embeddings only
EMBEDDINGS_MODEL=text-embedding-3-small
```

### Frontend (`services/frontend/.env`)

```env
PORT=30022
ORCHESTRATOR_URL=http://localhost:30021
KNOWLEDGE_STORE_URL=http://localhost:30025
KEY_ALLOWED_AGENTS=your-secret-key   # must match orchestrator's value
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

**Vitest is installed and required in every workspace**:
`services/orchestrator`, `services/knowledge-store`, `services/mcp-server`
(closed 2026-09-18 — previously a tracked gap), and `services/frontend`
(`lib/`/`actions/` only — no component-render tests, see each `frontend/*`
spec's plan.md; **`services/frontend/e2e/` has Playwright instead**, driving
a real browser against the real Next.js app with the two backend services
mocked at the network boundary — see `docs/conventions/frontend.md`).

```bash
pnpm run test                                          # every workspace's Vitest
pnpm --filter @mcp-server-sma/orchestrator run test
pnpm --filter @mcp-server-sma/mcp-server run test
pnpm --filter @mcp-server-sma/knowledge-store run test
pnpm --filter @mcp-server-sma/frontend run test

pnpm --filter @mcp-server-sma/frontend run test:e2e     # Playwright, needs `npx playwright install` once
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
- **Database**: PostgreSQL + pgvector via Prisma ORM, owned exclusively by
  `services/knowledge-store` — `mcp-server` and `orchestrator` never touch it.
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

- **Telegram bot** (port `30023`) — a future channel, same shape as the
  frontend but talking to Telegram instead of a browser. Not scoped in any
  spec yet.
- **WhatsApp bot** (port `30024`) — same channel pattern as Telegram. Not
  scoped in any spec yet.

Every new service goes through the same SDD pipeline (Constitution → Specify
→ Clarify → Plan → Tasks → Implement → Verify) and records its own domain
decisions in [`docs/context.md`](docs/context.md).
