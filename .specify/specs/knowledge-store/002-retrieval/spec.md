# Spec — Chat retrieval (semantic search over the vault)

| | |
|---|---|
| **Status** | Implemented and verified live 2026-09-17 (see §7.1 for a real calibration correction found during that verification) |
| **Group** | backend (spans `services/knowledge-store` + `services/mcp-server` + `services/orchestrator`) |
| **Depends on** | [`knowledge-store/001-vectorization`](../001-vectorization/spec.md) (needs `KnowledgeEntry.embedding` populated) |
| **Open Questions** | Resolved — see §8 |
| **Constitution clauses in play** | I, III (Vitest in `knowledge-store`), IV (layering/DI), V (dormant) |

## 1. Goal

Right now ALMA can only write to the vault, never read from it during a
conversation — confirmed live 2026-09-17: asked "qué conocimientos tenés de
mí" right after saving a note, it answered "no tengo ningún conocimiento
previo." This spec closes that gap: **every chat turn, before the LLM
answers, ALMA searches the vault by semantic similarity to the user's
message and grounds its answer in whatever it finds** — the retrieval half
of RAG that `001-vectorization` only built the write/embed half of. This was
explicitly out of scope there (see that spec's §8) and is deliberately
scoped down from the full `docs/context-extended.md` vision (no SkillRouter,
no reranker, no RAFT — those stay future work, §9) to what the current
architecture can support today: one new search endpoint, one new MCP tool,
one new step in the orchestrator's existing loop.

## 2. Why this is one spec across three services

Same reasoning as `001-vectorization` §2: one indivisible capability that
happens to touch three services because of this repo's layering rule
("orchestrator never touches Prisma/the filesystem — only calls
`mcp-server`'s tools", `CLAUDE.md`). `knowledge-store` owns the actual
pgvector query, `mcp-server` gets one thin new tool exposing it, and
`orchestrator` gets a new step in `Orchestrator.processConversation` that
calls that tool on every turn and feeds the result in as grounding context.

## 3. User Story & Acceptance Criteria

**As the orchestrator, acting on ALMA's behalf**, before I answer any user
message, I search the vault for notes related to what the user just said, so
I can ground my answer in what's already known instead of saying "no sé
nada de vos" right after being told to remember something.

- **AC1**: Given a user message arrives in `POST /api/inquire`,
  `Orchestrator.processConversation` calls the new `searchKnowledgeEntries`
  MCP tool with that message as the query — **unconditionally, every user
  turn**, no length/keyword heuristic to skip trivial messages (confirmed
  2026-09-17: simplicity and reliability over saving one embeddings call on
  a greeting — ALMA is single-user, the cost is negligible).
- **AC2**: `searchKnowledgeEntries` calls `knowledge-store`'s new
  `GET /knowledge-entries/search?q=<text>&limit=5`, which embeds `q` with
  the existing `EmbeddingsProvider`, ranks all of the current user's
  `KnowledgeEntry` rows by cosine similarity (pgvector `<=>`), keeps only
  those at/above the similarity threshold (§7.2), and returns **at most 5**
  (confirmed 2026-09-17, matches the limit already written down in
  `brain_vault/memory/retrieve_info.md`), sorted most-similar first.
- **AC3**: Each result carries `{ id, title, summary, path }` —
  **never the full note content** (matches the modeling note already
  written in `docs/context-extended.md` §5: only the summary + vector travel
  for retrieval; the full file is fetched separately if something ever needs
  it, which nothing in this spec does).
- **AC4**: Given no `KnowledgeEntry` clears the similarity threshold (either
  because the vault is empty, or because nothing stored is actually related
  to the message), `GET /knowledge-entries/search` returns `200 []` — not a
  404 or an error. The orchestrator then tells the LLM explicitly that
  nothing relevant was found (not silence, not an empty string it might
  ignore) — confirmed 2026-09-17, matches the principle already written in
  `docs/context-extended.md` §4: "si el sistema no encuentra información
  relevante, lo dice explícitamente en vez de inventar una respuesta." AC6
  makes this concrete.
- **AC5**: `searchKnowledgeEntries` is **not** offered to the LLM as a
  tool it can choose to call — `Orchestrator` calls it directly via
  `McpManager`/`McpClient` and filters it out of the `tools` array passed to
  `llmProvider.generateResponse`. Reasoning: AC1 already guarantees it runs
  every turn; also listing it as LLM-callable would let the model call it a
  second time redundantly, or (worse) decide not to call it at all and fall
  back to "no tengo ese dato" the way it did today, which is the exact bug
  this spec exists to close.
- **AC6**: The results (or their absence) are injected into the system
  message using the **existing** `extraInstructions` mechanism
  `Orchestrator.processConversation` already has for skills (the
  `[CONTEXTO ADICIONAL — ...]` block) — reused, not duplicated. When results
  come back empty, that block says so explicitly (e.g. "no se encontró
  ninguna nota relacionada con este mensaje"), satisfying AC4's second half.
- **AC7**: Given `knowledge-store` is unreachable or the search call fails,
  the conversation still proceeds — the failure is swallowed the same way
  `Orchestrator.processConversation`'s existing tool-call loop already
  swallows a failing tool call (log it, continue without that turn's
  grounding context) — a down search path must never block the user from
  chatting at all.
- **AC8**: The system prompt's existing "don't narrate saving" rule (see
  `Orchestrator.ts`'s `systemInstructions`, fixed 2026-09-17) gets a sibling
  rule: don't narrate searching either — no "dejame buscar en tu bóveda",
  no mentioning "encontré 3 notas", no repeating `path`/`id` back to the
  user. The retrieved notes are working context for the LLM, not something
  to announce, same reasoning as AC8's sibling rule for saves.

## 4. `knowledge-store` — new endpoint

`GET /knowledge-entries/search?q=<string>&limit=<number>` (query params;
`limit` optional, default and max both 5 per AC2 — a caller asking for more
than 5 still gets 5, this iteration has no pagination for search):

- `200 [{ id, path, title, summary, similarity }]` — `similarity` (0–1,
  `1 - cosine distance`) included for debugging/logging, not required by
  any caller yet.
- `400` if `q` is missing/empty.
- Scoped to the current single `User` (same `userService.getCurrent()`
  pattern `KnowledgeEntryService.create` already uses) — forward-compatible
  with multi-user even though Clause V is still dormant.

## 5. `mcp-server` — new tool

`searchKnowledgeEntries` (camelCase verb-first, per
[`naming.md`](../../../../docs/conventions/naming.md#mcp-tool-names)):

- **Input**: `{ query: string (min 1), limit?: number }`.
- **Behavior**: calls `knowledge-store`'s
  `GET /knowledge-entries/search`; returns the array as MCP tool content
  (JSON-stringified, same pattern `createKnowledgeEntry` already uses for
  its result).
- **Errors**: network/HTTP failure → MCP tool error (`isError: true`),
  never a thrown exception — same as `createKnowledgeEntryTool` (AC7 relies
  on this being catchable).
- **File**: `services/mcp-server/src/infraestructure/tools/searchKnowledgeEntriesTool.ts`,
  registered in `src/core/server.ts` next to
  `registerCreateKnowledgeEntryTool`.
- Registered as a normal MCP tool (so `Orchestrator` can call it through the
  same `McpManager.callTool` path everything else uses) but excluded from
  the tool list the LLM sees (AC5) — the filtering happens in
  `Orchestrator`, not by hiding it from `mcp-server`'s own `tools/list`
  (MCP has no per-caller visibility; hiding it in the one place that
  actually assembles the LLM-facing list is simpler than adding one).

## 6. `orchestrator` — new step in the conversation loop

`Orchestrator.processConversation`, right after it fetches `tools` from
`mcpManager` and before it builds `systemContent`:

1. Take the last message in `messages` where `role === 'user'`.
2. Call `mcpManager.callTool('searchKnowledgeEntries', { query, limit: 5 })`
   directly (not through the LLM tool-call loop) — AC1/AC5.
3. Format the result into a text block for `extraInstructions` — a short
   list of `title`/`summary` pairs, or the explicit "nothing found" line
   (AC4/AC6) — and merge it with any existing `extraInstructions` (skills)
   before it reaches `systemContent`, reusing the current merge logic
   as-is.
4. Filter `searchKnowledgeEntries` out of `tools` before it's passed to
   `llmProvider.generateResponse` (AC5).
5. If step 2 throws, log it and continue with `extraInstructions` unchanged
   (AC7) — the rest of `processConversation` doesn't change.

No new tool-call iteration is spent on this — it happens once, before the
LLM's first turn, not inside the existing `while (iteration < maxIterations)`
loop.

## 7. Defaults & Assumptions (mark any correction inline)

1. **Similarity threshold: cosine similarity ≥ 0.35** (i.e. pgvector
   `embedding <=> query_embedding <= 0.65`), applied server-side in
   `knowledge-store` before the `limit` cap. **Originally specced at 0.75,
   recalibrated 2026-09-17 during live end-to-end verification (§8's AC6
   check)**: a note "tengo un perro que se llama Firulais y es de raza
   labrador" against the query "tengo alguna mascota? como se llama y de
   qué raza es?" — about as clean a true positive as this feature will ever
   see — only scored **0.496** cosine similarity with
   `text-embedding-3-small`. 0.75 rejected it outright (search returned
   `[]`, the exact bug this spec exists to fix, just moved one layer down).
   The next most-similar *unrelated* notes in the same vault scored ≤ 0.23,
   so 0.35 keeps a real margin above that noise floor while actually
   admitting genuine matches. Still not a locked business rule — isolated in
   one `const` in `knowledgeEntryService.search`, revisit with more real
   vault content.

   **Correction, 2026-09-18 — the const is gone, not just recalibrated
   again.** A real question ("¿qué sabés de mí?") against a real vault with
   14 atomic one-fact-per-note entries returned `[]` even at 0.35: a broad
   self-referential query's embedding isn't close to any single atomic fact
   ("mi perro se llama Firulais"), no matter how loose the floor. Meanwhile
   `orchestrator/001-reasoning-pipeline` had, by this point, added its own
   second relevance gate downstream — a calibrated cross-encoder reranker
   (`orchestrator/src/retrieval/Reranker.ts`, `MINIMUM_SCORE = 0.5`,
   verified against this same vault: ~0.997 for a genuine match vs.
   ~0.001-0.0016 for unrelated notes) — that never got a chance to run,
   because this coarser, worse-calibrated gate killed the candidates first.
   Removed entirely: `search()` now returns the nearest `limit` neighbors by
   cosine distance with no floor, and the reranker is the sole precision
   filter. See `knowledge-store/002-retrieval/tasks.md`'s 2026-09-18
   addendum for the full investigation and the two companion fixes that
   shipped alongside it.
2. **`limit` default and hard cap: 5** — confirmed (§3 AC2).
3. **Embeddings for the query text reuse the same `EmbeddingsProvider`**
   already injected into `KnowledgeEntryService` (`001-vectorization` §5) —
   no second embeddings client.
4. **No caching of query embeddings or results** — every turn re-embeds the
   user's latest message. Acceptable for a single user; revisit if
   embeddings latency/cost ever becomes a problem (out of scope here).
5. **No reranker** (`docs/context-extended.md`'s "RAG top 20 → reranker top
   5" is future work) — this spec's ranking is a single pgvector
   nearest-neighbor query, ordered by cosine distance, thresholded, capped
   at 5. See §9.

## 8. Open Questions — resolved 2026-09-17

- **OQ1 — Trigger mechanism.** → **Automatic, every turn**, not an
  LLM-decided tool call. Confirmed by Felix: matches
  `brain_vault/memory/retrieve_info.md`'s own description ("el orquestador
  primero dispara esta skill") and is more reliable than hoping the LLM
  remembers to call a search tool (it didn't, today, when asked directly
  "qué conocimientos tenés de mí").
- **OQ2 — Result limit.** → **5**, per `retrieve_info.md`'s own
  recommendation ("limitarlo a 3 o 5").
- **OQ3 — Skip trivial messages?** → **No, always search, no heuristic.**
  Simplicity over a marginal embeddings-cost saving; single user.
- **OQ4 — Filter by relevance, or always return the top-5 regardless of
  match quality?** → **Filter by a similarity threshold, cap at 5 among
  what passes; if nothing passes, tell ALMA explicitly that nothing relevant
  turned up** rather than forcing a connection to an unrelated note. Matches
  `docs/context-extended.md` §4's own stated principle about not inventing
  an answer when there's no real information behind it.

## 9. Out of Scope — Future Work

- **SkillRouter** deciding *which* skill(s) to invoke per message —
  currently there's exactly one retrieval path, always run.
- **Reranker** (cross-encoder top-20 → top-5) — this spec's ranking is raw
  cosine similarity only.
- **RAFT** — unrelated to retrieval at request time.
- **Short-term conversation log / ONIROS** — retrieval here only ever
  searches `KnowledgeEntry` (long-term vault notes). There is no persisted
  conversation history table yet (`prisma/schema.prisma` has only `User` and
  `KnowledgeEntry`), so a message like "qué charlamos ayer" has nothing to
  retrieve from — that needs the log/ONIROS work `001-vectorization` §8
  already deferred, not this spec.
- **Caching / debouncing** repeated searches (§7.4).
- **Multi-user data isolation** beyond the `userId` scoping already in
  place — Clause V stays dormant.
