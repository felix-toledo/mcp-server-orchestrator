# Tasks — Chat retrieval (semantic search over the vault)

Base: [`plan.md`](./plan.md) §7 build order. Vitest required in
`knowledge-store`, `mcp-server`, and `orchestrator` (`CLAUDE.md`'s Testing
section — `mcp-server` closed 2026-09-18, no longer a gap) — each task's
test(s) named below (Clause III).

- [x] **T1 — `KnowledgeEntryService.search`**: `search` method + `SIMILARITY_THRESHOLD`
  constant (plan §2.3). 4 new tests in `knowledgeEntryService.test.ts`
  covering AC2, AC3 (no `content` field in the shape), AC4 (empty on no
  match), and the no-current-user edge case.
- [x] **T2 — `knowledge-store` HTTP surface**: `SearchKnowledgeEntriesQuerySchema`,
  `search` controller handler, route registered **before**
  `GET /knowledge-entries/:id` (plan §2.1). 4 new tests in
  `core/server.test.ts`, including one that specifically asserts `/search`
  isn't swallowed by the `/:id` route.
- [x] **T3 — `mcp-server`: `searchKnowledgeEntriesTool`**:
  `KnowledgeStoreClient.searchKnowledgeEntries` (3 new tests in
  `knowledgeStoreClient.test.ts`) + `searchKnowledgeEntriesTool.ts` (3 new
  tests in `searchKnowledgeEntriesTool.test.ts`, mirrors
  `createKnowledgeEntryTool.test.ts`), registered in `core/server.ts`.
- [x] **T4 — `orchestrator`: `formatRetrievalContext`**: new pure function +
  5 tests (`formatRetrievalContext.test.ts`) — empty array, non-empty
  formatting, MCP tool error treated as "nothing found," malformed JSON,
  missing/undefined result.
- [x] **T5 — `orchestrator`: wire retrieval into `processConversation`**:
  extracted as `Orchestrator.searchVaultForContext` (kept out of
  `processConversation`'s body to avoid pushing its already-pre-existing
  cyclomatic-complexity lint warning any higher — confirmed via `git stash`
  that the warning predates this spec, 18 both before and after this
  change) — calls `searchKnowledgeEntries` with the last user message,
  merges into `extraInstructions`, filters the tool out of what the LLM
  sees, swallows a failing search (AC7). Plus the system-prompt sentence
  (plan §4.1, AC8). 3 new tests in `Orchestrator.test.ts` (AC1, AC5, AC7),
  9/9 passing in that file, 33/33 across `services/orchestrator`.
- [x] **T6 — End-to-end manual verification, 2026-09-17**: saved "tengo un
  perro que se llama Firulais y es de raza labrador" in one request, asked
  "tengo alguna mascota? como se llama y de que raza es?" in a separate
  request — first attempt came back `[]` / "no tengo ese dato" even though
  the note existed, which is what led to the threshold recalibration below.
  After that fix: correct answer ("Sí, tenés un perro. Se llama Firulais y
  es de raza labrador."), no mention of the tool/vault/file/path (AC8).
  Also checked: "qué conocimientos tenés de mí" now surfaces real saved
  facts (name/email/purpose) instead of "no tengo ningún conocimiento
  previo" (the original bug report); an unrelated general-knowledge question
  ("cuál es la capital de Francia") still answers normally instead of
  wrongly claiming "no tengo ese dato" — confirms the AC4 "say so
  explicitly" rule is scoped to vault-grounded claims, not general
  knowledge.

**Real bug found and fixed during T6, not originally in this task list**:
spec §7.1's original `SIMILARITY_THRESHOLD = 0.75` default rejected every
genuine match — text-embedding-3-small's cosine similarity for the
Firulais example above landed at only **0.496**, well under 0.75. Every
save made through this whole session's testing prior to the fix is
retrievable now; nothing needed re-saving. Recalibrated to **0.35**
(`knowledgeEntryService.ts`, `spec.md` §7.1, `plan.md` §2.3 all updated to
match) — the next most-similar *unrelated* note in the same vault scored
≤ 0.23, so 0.35 keeps a real margin without needing to be as loose as
"basically unfiltered."

All three touched workspaces verified green after the fix:
`services/knowledge-store` (42/42), `services/mcp-server` (13/13),
`services/orchestrator` (33/33) — tests, lint, and `tsc --noEmit` all clean
(the one pre-existing lint warning on `Orchestrator.processConversation`'s
complexity, and one pre-existing unrelated lint error in
`services/mcp-server/scripts/similarityCalculation.ts`, both predate this
spec — confirmed via `git stash`, not introduced here).
