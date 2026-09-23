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

## Addendum, 2026-09-18 — broad "¿qué sabés de mí?" queries still came back empty

By this date the orchestrator side of retrieval had moved to
`orchestrator/001-reasoning-pipeline`'s LangGraph pipeline (RAG top-20 →
cross-encoder rerank → top-5), and the vault had grown to 14 real
one-fact-per-note entries (pet, partner, hometown, favorites, etc., plus
`conocimientos.md`, a hand-written summary note). Felix asked ALMA "qué
sabés de mí" through the real chat and got "no tengo una nota tuya con un
perfil... de tu vida personal no sé nada" — even though the facts were
genuinely saved and embedded. Investigated live against the running
services (not simulated):

- `curl .../knowledge-entries/search?q=¿qué sabés de mí?` → `[]`.
- The same endpoint with a specific question ("quién es mi novia",
  "cuál es mi comida favorita") → correct single-note matches at
  0.52/0.55 similarity, well above the 0.35 floor.
- A less generic broad phrasing ("contame todo lo que sepas sobre mí") only
  just cleared the floor for one note (`conocimientos.md`, 0.373) and
  nothing else — confirming this wasn't a bug in one query's phrasing, it's
  that no single atomic-fact note is ever "the nearest neighbor" to a
  question that isn't about one fact.

**Three fixes shipped together** (Felix asked for all three, not a staged
rollout):

1. **Removed the coarse `SIMILARITY_THRESHOLD` gate in
   `KnowledgeEntryService.search()`** (see spec.md §7.1 and plan.md §2.3's
   2026-09-18 corrections for the full reasoning) — it was a second,
   worse-calibrated relevance gate sitting *before* the orchestrator's
   already-calibrated cross-encoder reranker
   (`MINIMUM_SCORE = 0.5`, ~0.997 vs. ~0.001-0.0016 margin verified against
   this same vault) and could veto candidates the reranker would have kept.
2. **Rewrote the same query to `ORDER BY embedding <=> query LIMIT limit`
   per branch** instead of filtering in the `WHERE` clause — the shape
   pgvector's ivfflat/hnsw ANN indexes can actually use. No such index
   exists yet at this vault's size (14 rows, an index would be premature —
   pgvector's own docs warn ivfflat needs real data to build meaningful
   clusters), so this isn't load-bearing today, just no longer actively
   wrong for whenever one gets added.
3. **New `ProfileNoteService`** (`services/knowledge-store/src/services/profileNoteService.ts`):
   every `KnowledgeEntryService.create()` call now also appends a one-line
   bullet (`- <title>: <summary>`) to a single running `perfil.md` note,
   creating it on the first fact. This exists because fix #1 alone cannot
   fully solve the broad-query case: a truly generic "tell me everything"
   question is an aggregation request, not a similarity search, and no
   amount of threshold tuning gives a single atomic fact a strong nearest-
   neighbor match to it. A note that already contains many facts together
   *is* close to that kind of query's embedding. Fails open (try/catch,
   logs and continues) so a profile-note hiccup never blocks the note the
   user actually asked to save — same fail-open convention already used by
   `fetchRagTop20.ts`/`rerank.ts`. Wired into `index.ts`'s composition root
   as a new constructor dependency of `KnowledgeEntryService` (DI, per
   `docs/design-patterns.md`). This is new scope beyond this spec's
   original ACs, called out explicitly here rather than folded in silently
   (`CLAUDE.md`: "no business rule is ever guessed or inferred").

**Verified live** against Felix's real vault and running services, then
cleaned up: created two throwaway entries via `POST /knowledge-entries`,
confirmed `perfil.md` was created on the first and appended-to (not
duplicated) on the second, confirmed the original failing search
(`"¿qué sabés de mí?"`) now returns all 14 real notes ranked by nearest
neighbor instead of `[]`, then deleted both throwaway entries and the
resulting `perfil.md` (no delete endpoint exists for `KnowledgeEntry` yet —
removed directly via the vault file and a raw SQL delete) to leave the vault
exactly as found. `perfil.md` will reappear naturally the next time a real
fact gets saved.

New tests: `profileNoteService.test.ts` (4 tests — create-on-first-fact,
append-on-existing, fail-open on vault-write failure, fail-open on
embedding failure), plus updates to `knowledgeEntryService.test.ts` (the new
`profileNotes` constructor dependency, `recordFact` called with
`(userId, title, summary)` on create, skipped when the note being created
is `perfil.md` itself, and the search tests re-worded to no longer assert a
threshold that no longer exists). `services/knowledge-store`: 166/166
passing, `tsc` and `eslint` both clean.

**Correction, same day, a few hours later — fix #3 alone was not enough,
verified live before claiming otherwise.** Felix asked ALMA "que sabes de
mi" through the real chat after all three fixes above and still got "no
tengo nada guardado sobre vos". Root-caused with a throwaway script
(`services/orchestrator/scratch-rerank-check.ts`, deleted after use) that
ran the *actual* `TransformersJsReranker` against the *actual* top-20
candidates for that exact query: **0 of 16 candidates cleared
`MINIMUM_SCORE = 0.5`**, `perfil.md` included — every raw score rounded to
`0.0000`. The MS-MARCO cross-encoder this reranker uses is trained for
query→passage relevance in a search/QA sense; a broad, self-referential
question isn't "relevant" to any passage in that sense, no matter how
complete the passage is. So fix #1 (removing the coarse embedding floor)
was real and correct — it stopped the *first* gate from vetoing candidates
before the reranker ever saw them — but the *second* gate (the reranker
itself) turned out to reject this whole query shape independently. Tuning
either gate's threshold further cannot fix this: it's not a calibration
problem, it's that similarity-based retrieval (embeddings or cross-encoder,
same limitation) doesn't model "tell me everything" as a form of
relevance.

**Actual fix**: stopped trying to make retrieval find the profile note and
instead always fetch it directly, unconditionally, every turn — a new
`GET /knowledge-entries/profile` (`KnowledgeEntryService.getProfileNote`,
direct lookup by the well-known `perfil.md` path, no `search()` involved),
a new `fetchProfileNote` graph node run in the same parallel fan-out as
`fetchRagTop20`/`runSkillRouter` (with its own `awaitProfileNote` no-op hop
to keep equal depth — see `noop`'s comment in `buildReasoningGraph.ts`),
and its content merged into the system context unconditionally in
`callLlm.ts` via `formatProfileNoteContext`, separate from and in addition
to the reranked search results. This is the same shape other assistants'
"memory" features actually use (always-included context, not RAG) — RAG
was never the right tool for "what do you know about me" in the first
place, it's for "what do you know about X."

Also threaded through: `AgentRegistry`'s `baseGraphDeps` now carries
`knowledgeStoreClient` too, so every delegated agent/team subgraph gets the
same profile context for free (it already spreads `baseGraphDeps` into
each sub-agent's `buildReasoningGraph` call — no new plumbing needed there).
`inquireStatusStore.ts`'s live-status labels got `fetchProfileNote`/
`awaitProfileNote` entries ("revisando tu perfil…") so the polling UI
stays meaningful. `systemInstructions.ts` got one added paragraph telling
the LLM this context is always-available, unlike the search results.

**Verified live again after the real fix**: same exact query ("que sabes de
mi") through the real running `/api/inquire` now returns a complete,
accurate answer — name, hometown, partner, pet, favorites, dentist
appointment, and even the unrelated "Emilio"/"Juancho" notes, all
correctly attributed. Test chat session created during verification was
deleted afterward (`DELETE /chat-sessions/:id`) to leave no test residue.

New/changed tests: `fetchProfileNote.test.ts` (2), `formatProfileNoteContext.test.ts`
(2), `getProfileNote` tests in `knowledgeEntryService.test.ts` (3),
`stripFrontmatter.test.ts` (2), `getProfileNote` tests in
`knowledgeStoreClient.test.ts` (orchestrator, 3), plus the ~10 test files
across `orchestrator` that hand-construct a full `PipelineState` literal
now including `profileNote: null`. `services/knowledge-store`: 176/176.
`services/orchestrator`: 132/132. Both `tsc` and `eslint` clean (the
pre-existing, unrelated lint errors in `index.ts`/`CopilotProvider.ts`/
`GeminiProvider.ts`/`McpClient.ts`/`McpManager.ts` predate this session —
confirmed via `git stash`).

**Third correction, same day — the profile note reaching the system
prompt still wasn't enough against a real, long conversation.** Felix
tried it for real over Telegram and got the old denial again. Reproduced
deterministically *outside* the graph (a standalone script calling
`OpenAIProvider`/DeepSeek directly with the real message history pulled
from his actual Telegram `ChatSession`): one single stale turn earlier in
that same conversation — where the assistant, correctly, had once said "no
tengo nada guardado" before the profile note existed — was enough to make
the model repeat that denial on the next turn, *even with the fresh
profile context present in the system prompt, and even after three
escalating rewrites of that instruction* (a plain note, an explicit
"trust this over what you said before," and a maximally forceful "you are
PROHIBITED from denying this" version — all three failed identically).
This is conversational anchoring: a system prompt sitting at the very
front of a long history loses to what the conversation itself has been
repeating, independent of how forcefully it's worded.

**What actually worked, verified the same way**: appending a *second copy*
of the profile context as the literal last message before generation —
recency beats position-at-the-front. Implemented in `callLlm.ts`: after
building `conversationMessages` as before, a synthetic trailing
`{ role: 'system', content: '<profile context> + a short don't-repeat-old-
denials line' }` is appended only when `state.profileNote` is non-empty,
and — important — it's appended only to the array sent to the LLM for
*this* call, never merged into what the node returns for persisted state
(`{ messages: [...nonSystemMessages, response.assistantMessage] }` is
unchanged), so it can never leak into history or get echoed back next
turn. Verified against the real graph, not just the isolated script: the
exact same failing replay (full real history + "que dabes de mi") now
gets a complete, correct answer 3/3 times, versus 0/3 before.

**Provider-specific, noted not "fixed everywhere"**: this relies on the
active LLM actually weighing a trailing `system`-role message by recency —
confirmed working for `OpenAIProvider` (DeepSeek's own active default, and
literally already what that provider does on its own — see next
paragraph). `GeminiProvider.convertMessages` merges every `system`-role
message into one `systemInstruction` string regardless of where it sits in
the array, so this specific mitigation would lose its positional advantage
if `LLM_PROVIDER=gemini`. Not fixed here — out of scope of what was asked,
and the active provider is DeepSeek — but worth knowing before assuming
this generalizes across a provider switch.

**Unrelated thing noticed while in this file, flagged not fixed**:
`OpenAIProvider.generateResponse` (`services/orchestrator/src/llm/OpenAIProvider.ts`)
already appends its own hardcoded trailing system message —
`{ role: 'system', content: 'Rol: Eres un Especialista en todo' }` — on
*every* call, unconditionally, undocumented anywhere in this repo's specs
or `CLAUDE.md`. Looks like leftover scaffolding from before ALMA's actual
persona (`BASE_SYSTEM_INSTRUCTIONS`) was written, and it's generic/mildly
contradictory with it. It didn't block this fix (confirmed the new
trailing reminder still lands as the true last message before it), so left
untouched — flagged for Felix to decide, not silently removed, since it's
unclear whether it was intentional.

**Separate, pre-existing data-quality nuance also surfaced (not fixed,
Felix's own vault content)**: the `Emilio – datos personales y rutina`
note (a friend, from real earlier testing) sits in `perfil.md` with no
relational framing (unlike `Melisa — mi novia`, which is unambiguous). In
the 3/3 verification above, one of the three answers correctly hedged
("no me queda claro si es sobre vos o sobre otra persona"), but another
confidently misattributed it ("tu nombre es Emilio"). Not something to fix
by silently rewriting Felix's own note — flagged for him; a relational
title (e.g. "Emilio — un amigo") would likely resolve it if he wants it
addressed.

New/changed tests: `callLlm.test.ts` gained 3 tests for the trailing
reminder (appended when `profileNote` is set, absent when it isn't, never
leaks into persisted `state.messages`). `services/orchestrator`: 135/135.
