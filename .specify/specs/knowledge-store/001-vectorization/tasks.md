# Tasks — Knowledge vectorization & persistence

Base: [`plan.md`](./plan.md) §11 build order. One task at a time for
`implementer`. Vitest is required for `knowledge-store` (plan §10) — each
task below names the test(s) that must pass before it's done (Clause III).
`mcp-server`'s tasks (8–9) have no dedicated test, per plan §2/§9.

- [x] **T1 — Docs**: update Clause III (`.specify/memory/constitution.md`)
  and `CLAUDE.md`'s Testing section to require Vitest in
  `services/knowledge-store`.
- [x] **T2 — Scaffold `services/knowledge-store`**: `package.json`
  (workspace member, name `@mcp-server-sma/knowledge-store`),
  `tsconfig.json`, `vitest.config.ts` (mirror `services/orchestrator`'s),
  `.env.example`, `src/index.ts`. Root `package.json` gained
  `dev:knowledge-store`/`build:knowledge-store`/`start:knowledge-store`.
- [ ] **T3 — Prisma schema + first migration**: schema written (`prisma/schema.prisma`,
  §5.2 — note: `embedding` had to become `Unsupported("vector(1536)")?`,
  **optional**, not the originally-specced required field — see the "Found
  during Implement" note in spec §5.2's technical notes). `prisma generate`
  runs clean. **The actual `prisma migrate dev` has NOT been run** — this
  dev machine's Docker Desktop engine wasn't running, so there's no live
  Postgres to migrate against yet. Remaining: start Docker Desktop, `docker
  compose up postgres`, then `pnpm run prisma:migrate` from the repo root —
  remember the first migration needs `CREATE EXTENSION IF NOT EXISTS
  vector;` added to its generated SQL before `embedding`'s column type will
  work (plan §5.2's technical note).
- [x] **T4 — `resolveVaultPath` + `VaultRepository`**: done, 4 tests passing
  (`resolveVaultPath.test.ts`, `vaultRepository.test.ts`).
- [x] **T5 — `EmbeddingsProvider` + `OpenAiEmbeddingsProvider`**: done, 2
  tests passing (`embeddingsProvider.test.ts`).
- [x] **T6 — `plainTextExcerpt`** + **`slugify`** (the latter wasn't broken
  out as its own task originally but is its own file/test pair, plan §8):
  done, 3 + 4 tests passing.
- [x] **T7 — `UserService` + `KnowledgeEntryService`**: done, 3 + 9 tests
  passing, covering AC1–AC4 (including both rollback paths — embeddings
  failure and Prisma insert failure).
- [x] **T8 — Controllers + composition root + `index.ts`**: done, with one
  refinement over the original plan — `createApp` takes its dependencies as
  a parameter instead of constructing them (the real construction moved to
  `index.ts`), specifically so this task's integration test
  (`core/server.test.ts`, 9 tests, one per endpoint × status code) could
  inject fakes without a real database. Added `supertest`/`@types/supertest`
  as devDependencies for this (justification: HTTP-level route testing
  without a real listening socket).
- [x] **T9 — `mcp-server`: `KnowledgeStoreClient` + `createKnowledgeEntryTool`**:
  done (`src/infraestructure/http/knowledgeStoreClient.ts`,
  `src/infraestructure/tools/createKnowledgeEntryTool.ts`, registered in
  `core/server.ts`). `mcp-server` builds and lints clean. **Not yet manually
  verified end-to-end** via `pnpm run start:inspector-mcp` — needs T3's live
  DB first (the tool would successfully call `knowledge-store`, but
  `knowledge-store` itself needs Postgres up to actually persist anything).
- [x] **T10 — `docker-compose.yml`**: added a dev-only `postgres`
  (`pgvector/pgvector:pg16`) service + a `postgres-data` volume. Postgres's
  own port isn't in the 30020+ app registry (`docs/ports.md`), so no row was
  added there — only app services get one, per that file's own rules.

**Also done, not originally in this task list**: removed
`services/mcp-server`'s dead `@prisma/client`/`prisma` dependencies and
empty `prisma/` folder — real, not hypothetical: both packages depending on
`@prisma/client@6.16.2` collided in pnpm's shared virtual store (whichever
service's `prisma generate` ran most recently silently overwrote the
other's generated output), and `mcp-server` never actually used Prisma to
begin with (`ADR-0001`). `CLAUDE.md` and this spec were both updated to
match. Root `package.json`'s `prisma:generate`/`prisma:migrate`/
`prisma:studio` scripts now point at `knowledge-store`, not `mcp-server`.

**2026-09-17, verified live end to end** (Docker running, real Postgres):

- **T3 done, with a caveat**: the schema is applied and correct (verified:
  `\d "KnowledgeEntry"` shows the `vector(1536)` column,
  `CREATE EXTENSION IF NOT EXISTS vector;` ran). It was applied by hand
  (`docker exec ... psql -f migration.sql`), not via `prisma migrate dev` —
  that command (and even `prisma db execute`, and the app's own runtime
  Prisma Client) reliably failed with `P1010: User was denied access on the
  database (not available)` specifically on host port 5433, for reasons
  never fully root-caused (TCP connects fine per a raw Node socket test;
  Postgres's own connection log never shows the attempt arriving at all —
  something below the wire protocol swallows it, specific to that port on
  this Windows machine). Port 5432 was already taken by an unrelated
  project's Postgres. **15432 works** — `docker-compose.yml` and every env
  file now use it. If you ever touch `POSTGRES_PORT`, retest with `npx
  prisma db execute --schema prisma/schema.prisma --stdin <<< "SELECT 1;"`
  from `services/knowledge-store` before trusting a new value.
- **T9 done and verified live**: `createKnowledgeEntry` exercised through
  the real chain (curl → `knowledge-store` directly, and separately
  orchestrator chat → LLM tool call → `mcp-server` → `knowledge-store`) —
  file written to the vault, row + embedding persisted, slug collision
  produces `-2`/`-3` suffixes as specced.
- **A second real bug found and fixed while verifying this**, in
  `services/orchestrator` (not this spec's code, but this spec's tool is
  what exposed it): `McpClient.sanitizeSchema` recursively stripped a
  disallow-list of JSON-Schema keys (`title`, `default`, etc. — meant to
  drop schema *metadata* some LLM providers reject) without distinguishing
  metadata from an actual property *named* one of those words. Since
  `createKnowledgeEntry` has a required `title` field, that field was
  silently deleted from the schema the LLM ever saw, so it never sent one —
  the tool call always failed with "Required: title," which read like a bug
  in this spec's own code until the schema the model actually received was
  inspected. Fixed to only sanitize metadata, never `properties`' own keys;
  see the fix and its regression test in
  `services/orchestrator/src/mcp/McpClient.test.ts`. Would have broken any
  future tool with a parameter literally named `title`, `default`, or
  `examples`.

All 4 services (`knowledge-store`, `mcp-server`, `orchestrator`, `frontend`)
verified running together with real onboarding/chat/explorer data flowing
through a live Postgres — see the top-level session summary for exact
commands.
