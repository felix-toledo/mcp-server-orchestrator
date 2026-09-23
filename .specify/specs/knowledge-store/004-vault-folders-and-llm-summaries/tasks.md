# Tasks — Vault folders + LLM-generated summaries

Base: [`plan.md`](./plan.md) §8.

- [x] **T1 — Prisma schema**: `VaultFolder`, `KnowledgeEntry.folderId`,
  `Agent`, `TelegramLink`, `ChatSession`/`ChatMessage` all landed in one
  migration together with `knowledge-store/003-chat-sessions`'s tables
  (efficiency call made during implementation — one migration instead of
  several small ones for tables that all needed adding around the same
  time). `onDelete: Cascade` added on `KnowledgeEntry.folder` and
  `VaultFolder.parent` in a small follow-up migration — Prisma's default for
  an optional relation is `SET NULL`, not what AC7's cascade delete needs.
- [x] **T2 — `VaultRepository.ensureFolder`/`deleteFolder`**: tests.
- [x] **T3 — `SummaryProvider` + `generateSummary`**: tests (success +
  fallback). Verified live: a real note's summary is a genuine LLM
  paraphrase, not a truncation.
- [x] **T4 — `VaultFolderService`**: create/list/delete/recomputeAndPropagate.
  Tests: AC1–AC3, propagation stops at root. Also extended
  `KnowledgeEntryService.search`'s SQL to `UNION` `VaultFolder` into the
  ranked results (not originally in this task list) — a folder embedding
  that's never queried anywhere would be dead weight; confirmed live that a
  query surfaces both the matching note and its containing folder(s).
- [x] **T5 — `KnowledgeEntryService` changes**: `folderPath` support,
  summary generation swapped to `generateSummary`. Tests, including
  regression on existing AC1–AC4 from `001-vectorization`.
- [x] **T6 — `vaultFoldersController` + routes**: tests.
- [x] **T7 — `mcp-server`**: `createVaultFolderTool` +
  `KnowledgeStoreClient.createVaultFolder`, extend
  `createKnowledgeEntryTool`'s schema with `folderPath`. Tests.
- [x] **T8 — Manual end-to-end**: verified live via real chat — "creá una
  carpeta llamada recetas dentro de cocina" → "guardá en cocina/recetas una
  nota de tarta de manzana" — folder + note on disk, real LLM summaries,
  both folder and note embeddings updated and propagated to the parent,
  everything searchable together.

**Real, unrelated bug found and fixed during this round's broader live
testing (2026-09-17), not scoped to this spec's own ACs but surfaced by
`generateSummary`'s new external API call**: `knowledge-store`'s Express
routes had no error handling at all — a controller's rejected promise (e.g.
`SummaryProvider`'s OpenAI call returning a transient 404) became an
unhandled promise rejection and **crashed the entire Node process**, not
just that one request, taking every other in-flight request down with it.
Confirmed live twice during this session's testing. Fixed with a new
`core/asyncHandler.ts` wrapper (`.catch(next)` on every route) plus a
final Express error-handling middleware in `core/server.ts` that returns a
clean `500` instead. Regression test added in `server.test.ts`. Checked
`mcp-server` and `orchestrator` for the same class of bug — both already
safe (every MCP tool already wraps its own logic in try/catch and returns
`isError: true` instead of throwing; `inquireController`'s one route
already had a top-level try/catch) — this was specific to
`knowledge-store` never having had one.
