# Spec — Knowledge vectorization & persistence

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-18 (see README), no longer blocked on Clause I |
| **Group** | backend (spans `services/mcp-server` + new `services/knowledge-store`) |
| **Depended on by** | [`frontend/001-onboarding`](../../frontend/001-onboarding/spec.md), [`frontend/002-chat`](../../frontend/002-chat/spec.md), [`frontend/003-explorer`](../../frontend/003-explorer/spec.md) |
| **Open Questions** | Resolved — see [`.specify/specs/README.md`](../../README.md#open-questions-blocking-all-4-specs-resolve-before-any-advances-to-plan) for the log |
| **Constitution clauses in play** | I, III (Vitest, once `knowledge-store` exists), IV (layering/DI), V (dormant) |

## 1. Goal

Give ALMA one capability: turn a piece of text into a persisted, searchable
note — written to the user's local vault as Markdown **and** embedded/
indexed in Postgres/pgvector, in the same operation, so the two never drift
out of sync. This is the foundational spec the other three depend on: none
of onboarding, chat, or the explorer can do anything user-visible without
this existing first.

## 2. Why this is one spec across two services

`services/mcp-server` gets one thin new tool; the real logic (Prisma, vault
filesystem I/O, embeddings) lives in a **new service**,
`services/knowledge-store` — see
[ADR-0001](../../../../docs/adr/0001-knowledge-store-as-separate-service.md)
for why that's a separate service instead of living inside `mcp-server`.
They're one spec because they implement one indivisible capability: the tool
has no behavior of its own beyond calling `knowledge-store`.

## 3. User Story & Acceptance Criteria

**As the orchestrator, acting on ALMA's behalf**, when I decide something
the user told me is worth remembering, I call `createKnowledgeEntry` so it
gets saved to disk and indexed for later.

- **AC1**: Given the LLM calls `createKnowledgeEntry` with `{ title,
  content }`, `mcp-server`'s tool calls `knowledge-store`'s
  `POST /knowledge-entries`, which writes `<slug>.md` under the vault with
  YAML frontmatter (`title`, `createdAt`) followed by `content`, generates
  an embedding for `content`, and inserts a `KnowledgeEntry` row (`path`,
  `title`, `summary`, `embedding`) — file write and DB insert happen as part
  of the same request.
- **AC2**: Given a note with the same slug already exists, the new file gets
  a numeric suffix (`mi-nota-2.md`, `mi-nota-3.md`, ...) — it never silently
  overwrites an existing note.
- **AC3**: Given the embeddings API call fails, the whole operation fails
  (no orphan file without a DB row, no DB row without a file) — the file
  write is rolled back (deleted) if the embedding/DB step fails.
- **AC4**: `summary` is a plain-text excerpt of `content` (first ~200
  characters, Markdown syntax stripped) — **not** a separate LLM-generated
  abstractive summary (see §7.5).
- **AC5**: Given `knowledge-store` is unreachable when the tool is called,
  the tool returns an MCP tool error (not a thrown exception) rather than
  crashing — this is what lets `orchestrator`'s existing per-tool-call
  try/catch turn it into a graceful reply instead of a 500 (see
  [`frontend/002-chat`](../../frontend/002-chat/spec.md) AC4, which is the
  user-visible half of this same failure path).
- **AC6**: `knowledge-store` also exposes the read/write/list operations
  that [`frontend/001-onboarding`](../../frontend/001-onboarding/spec.md)
  and [`frontend/003-explorer`](../../frontend/003-explorer/spec.md)
  consume (`POST /users`, `GET /users/me`, `GET /knowledge-entries`,
  `GET /knowledge-entries/:id`, `PUT /knowledge-entries/:id`) — defined in
  full in §5 so those two specs can reference this contract instead of
  redefining it.

## 4. `mcp-server` — new tool

`createKnowledgeEntry` (camelCase verb-first, per
[`naming.md`](../../../../docs/conventions/naming.md#mcp-tool-names)):

- **Input**: `{ title: string (min 1), content: string (min 1), tags?: string[] }`
- **Behavior**: calls `knowledge-store`'s `POST /knowledge-entries` with the
  same payload; returns the created `{ path, title }` as MCP tool content.
- **Errors**: an HTTP error or network failure from `knowledge-store` is
  returned as an MCP tool error (AC5), never a thrown exception.
- **Folder structure**: one new file,
  `services/mcp-server/src/infraestructure/tools/createKnowledgeEntryTool.ts`,
  registered in `src/core/server.ts` (same pattern as `helloWorldTool.ts`).
- **New env var**: `services/mcp-server/.env` gains
  `KNOWLEDGE_STORE_URL=http://localhost:30025`.

## 5. `knowledge-store` — new service

### 5.1 HTTP API (internal, localhost only, no auth this iteration — see §7.3)

| Method & path | Body | Returns | Notes |
|---|---|---|---|
| `POST /users` | `{ name: string, email: string, purpose: Purpose }` | `201 { id, name, email, purpose, createdAt }` | `409` if a `User` already exists (single-user — consumed by onboarding) |
| `GET /users/me` | — | `200 { id, name, email, purpose }` or `404` | `404` means "show onboarding" |
| `POST /knowledge-entries` | `{ title: string, content: string, tags?: string[] }` | `201 { id, path, title, summary, createdAt }` | AC1–AC4 above |
| `GET /knowledge-entries` | — | `200 [{ id, path, title, summary, updatedAt }]` | sorted `updatedAt` desc — consumed by the explorer |
| `GET /knowledge-entries/:id` | — | `200 { id, path, title, content, summary, updatedAt }` | `content` = live file read — consumed by the explorer |
| `PUT /knowledge-entries/:id` | `{ content: string }` | `200 { id, path, title, summary, updatedAt }` | regenerates `summary`/`embedding` — consumed by the explorer |
| `GET /health` | — | `200 { status: "ok" }` | standard health check, matches `mcp-server`/`orchestrator` |

### 5.2 Prisma schema (`services/knowledge-store/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Purpose {
  PERSONAL_DAILY
  AUTOMATION_PRODUCTIVITY
  PROJECTS_WORK
  SECOND_BRAIN_STUDY
  TEAM_BUSINESS
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  purpose   Purpose
  createdAt DateTime @default(now())

  knowledgeEntries KnowledgeEntry[]
}

model KnowledgeEntry {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  path      String   @unique
  title     String
  summary   String
  embedding Unsupported("vector(1536)")?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Technical notes to carry into `plan.md` (facts, not decisions to
re-litigate):

- Prisma has no native `vector` column type — `Unsupported("vector(1536)")`
  plus raw SQL (`$queryRaw`/`$executeRaw`) is the documented approach, both
  for the migration (`CREATE EXTENSION IF NOT EXISTS vector;` before the
  table) and any future similarity query.
- **Found during Implement, not obvious from the docs**: a required
  `Unsupported` field with no default removes `create` entirely from that
  model's generated Prisma Client delegate (Prisma can't represent it in the
  create input type, so it disables the operation rather than generate
  something unsound). Marking it optional (`?`) restores `create`. The field
  is briefly `null` between `knowledgeEntry.create` and the follow-up
  `$executeRaw` that sets it — both happen inside the same service method
  call, before any response is returned, so nothing ever observes that gap.
- Use a real `prisma migrate` from the start, not `db push` (Clause III) —
  fresh schema, no migration history to preserve.
- `1536` matches `text-embedding-3-small`'s output dimension (§7.1) — change
  together if that default changes.

### 5.3 Folder structure

```
services/knowledge-store/
├── src/
│   ├── index.ts                    # composition root — builds the real deps (PrismaClient, VaultRepository, ...), calls createApp(deps), listens
│   ├── core/
│   │   └── server.ts                # createApp(deps) — wires routes given already-built deps, no `new` here
│   ├── api/
│   │   ├── usersController.ts
│   │   └── knowledgeEntriesController.ts
│   ├── services/
│   │   ├── userService.ts
│   │   ├── knowledgeEntryService.ts  # slugify → write file → embed → Prisma write, AC1–AC3
│   │   └── embeddingsProvider.ts      # Strategy: interface + OpenAI implementation, see §7.1
│   ├── vault/
│   │   └── vaultRepository.ts         # ALL fs reads/writes isolated here (§7.6: the one place to change for cross-platform)
│   └── infrastructure/
│       └── prismaClient.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── Dockerfile                        # future prod packaging — not used in dev, see §7.8
├── package.json
└── tsconfig.json
```

### 5.4 Environment variables

**`services/knowledge-store/.env`** (new):

```env
PORT=30025
DATABASE_URL=postgresql://user:password@localhost:15432/alma
OPENAI_API_KEY=sk-...           # embeddings only — see §7.1
EMBEDDINGS_MODEL=text-embedding-3-small
```

## 6. Architecture

See [`.specify/specs/README.md`](../../README.md#architecture-shared-across-all-4-specs)
for the full diagram. This spec owns everything inside the `knowledge-store`
box plus the `mcp-server → knowledge-store` arrow.

## 7. Defaults & Assumptions (mark any correction inline)

1. **Embeddings provider: OpenAI `text-embedding-3-small`.** `OPENAI_API_KEY`
   is already configured in this repo's environment for the LLM side (even
   though the LLM itself is DeepSeek — see
   [`frontend/002-chat`](../../frontend/002-chat/spec.md)), so reusing it
   for embeddings avoids a third API key. 1536-dimensional vectors.
2. **Service name: `knowledge-store`.** Confirmed 2026-09-18 — the
   mythological module names (`mnemos` etc.) from `docs/context-extended.md`
   are deliberately **not** used as real code/service names, see
   `docs/context.md`'s Origin and vision section.
3. **`knowledge-store` has no auth this iteration.** Never reachable from
   outside `localhost` (only `mcp-server` and `frontend`'s own server
   processes call it) — same trust boundary as calling a local file. Revisit
   the moment ALMA runs anywhere but Felix's own machine.
4. **Slug/filename collision**: numeric suffix (`-2`, `-3`, ...), never
   overwrite (AC2).
5. **`summary` = plain-text truncation**, not an LLM-generated abstract
   (AC4) — keeps `knowledge-store` from needing its own LLM client, only an
   embeddings client.
6. **Vault path hardcoded to `%USERPROFILE%\Documents\alma\vault`, Windows
   only.** Confirmed 2026-09-18 (changed from an earlier `%APPDATA%\.alma`
   default — a `Documents`-visible folder is easier to find). Isolated
   behind `vaultRepository.ts` (§5.3) so it's a small change later if this
   needs to move again.
7. **Dev database**: a new `postgres` (pgvector-enabled image, e.g.
   `pgvector/pgvector:pg16`) container is added for local dev — **not** the
   `DATABASE_URL` currently sitting in `services/mcp-server/.env` /
   `services/orchestrator/.env`, which points at an unrelated project's
   database and must not be reused for ALMA.
8. **Dev workflow**: `knowledge-store` runs natively via `pnpm run
   dev:knowledge-store` (like `mcp-server`/`orchestrator` today), not inside
   Docker — it needs direct access to the real `Documents\alma` folder on
   Felix's machine. `docker-compose.yml` only gains the `postgres` container
   for local dev; a container target for `knowledge-store` itself (for
   eventual prod packaging) is future work.

## 8. Out of Scope — Future Work

- **Retrieval/RAG** — the orchestrator searching the vault's vectors to
  ground an answer (LOGOS's `retrieve_info`, `brain_vault/memory/retrieve_info.md`).
- **ONIROS** — nightly consolidation of a raw interaction log into the vault.
- **Scheduler** (`pg-boss`-backed "remind me tomorrow") skill.
- **Multi-user**: real accounts, per-user vaults, auth/sessions (Clause V
  becomes binding again — see the constitution's note on that clause).
- **Renaming/deleting** a `KnowledgeEntry`.
- **Cross-platform vault path** (macOS/Linux).
