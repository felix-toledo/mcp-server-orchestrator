# Spec — Reasoning pipeline (RAG top-20 + SkillRouter + reranker + compressor)

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | backend (`services/orchestrator`, extends `services/knowledge-store`'s search endpoint) |
| **Depends on** | [ADR-0003](../../../../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md) (LangGraph), [`knowledge-store/002-retrieval`](../../knowledge-store/002-retrieval/spec.md) (superseded in part — see §2) |
| **Depended on by** | [`orchestrator/002-multi-agent`](../002-multi-agent/spec.md) (agents run as nodes inside this same graph) |
| **Constitution clauses in play** | I, III (Vitest), IV, V (dormant) |

## 1. Goal

Replace `Orchestrator.processConversation`'s flat `while` loop with the
graph Felix specified: a parallel RAG-top-20 + SkillRouter step, a
reranker that narrows 20 candidates to 5, a complexity branch (plan-first
vs direct call), the existing MCP tool loop with a failing-aware iteration
budget, and an in-request compressor that keeps a long complex task from
resending its full transcript every iteration. Built on
[LangGraph](../../../../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md).

## 2. Relationship to `knowledge-store/002-retrieval`

`002-retrieval` shipped first and is **live** (`searchKnowledgeEntries`,
threshold-filtered top-5, always-on). This spec **extends, not replaces,
its endpoint** — same `GET /knowledge-entries/search`, but:

- `limit` can now go up to 20 (was capped at 5) — the raw RAG-top-20 fetch.
- The **reranker becomes the new relevance filter**, replacing the flat
  0.35 cosine-similarity cutoff `002-retrieval` shipped with (that cutoff
  was always an acknowledged placeholder — see its spec §7.1's own note
  that it "isn't a locked business rule"). A cross-encoder reranker scores
  each candidate against the actual query text, which is strictly more
  accurate than raw embedding cosine similarity for "is this really
  relevant" — that's the entire reason rerankers exist.
- `002-retrieval`'s AC1 ("search runs automatically every turn, hidden from
  the LLM's tool list") **carries over unchanged** — restated below as AC1
  so this spec is self-contained, not because it's being re-decided.

## 3. User Story & Acceptance Criteria

**As the orchestrator, acting on ALMA's behalf**, I ground every answer in
the user's vault when there's real information to ground it in, size my own
effort to the task's actual complexity, and keep a long tool-using task from
drowning in its own transcript.

- **AC1** *(carried over from `002-retrieval`)*: retrieval runs
  automatically every turn, is never exposed to the LLM as a callable tool,
  and a failure never blocks the conversation.
- **AC2**: On each user turn, **RAG-top-20** (`knowledge-store`'s search
  endpoint, `limit: 20`) and **SkillRouter**'s skill/complexity
  classification of the raw message run **in parallel** —
  neither waits on the other to start.
- **AC3**: Once RAG-top-20 resolves, the **reranker** (Transformers.js, a
  local cross-encoder, `docs/design-patterns.md`'s Strategy pattern behind
  an interface so the model is swappable later) scores all 20 candidates
  against the query and keeps the top 5 whose score clears a minimum bar
  (§7.1) — below that bar, the candidate is dropped, not just deprioritized.
- **AC4**: **"¿Tenemos información?"** is `true` iff the reranked set is
  non-empty. Both outcomes (info found / not found) converge on the same
  next step (AC5) — there's no separate code path per outcome beyond what
  gets put in the LLM's context (AC7).
- **AC5**: **Complexity branch**, decided by SkillRouter's own
  classification (AC2), independent of AC4's outcome:
  - **Complex** → an LLM call first produces a **plan** (a short ordered
    list of steps, added to context) before the normal call/tool loop
    starts.
  - **Not complex** → the normal call/tool loop starts directly, no
    planning step.
- **AC6**: When AC4 found nothing, the system prompt for the following
  LLM call(s) states explicitly that no relevant note was found — same
  "say so, don't invent" rule `002-retrieval` AC4/AC6 already established,
  now driven by the reranker's output instead of the raw threshold.
- **AC7**: **MCP/agent tool loop** (existing `McpManager` machinery,
  extended by `orchestrator/002-multi-agent` to also route agent-to-agent
  calls through the same decision point — see that spec §3): after each LLM
  call, if it requested a tool (MCP or agent-as-tool), execute it and loop
  back to another LLM call; otherwise proceed to AC8.
- **AC8**: **Iteration budget**: starts at **10**. It becomes **5** the
  moment the run is "failing" — defined as: the most recent tool
  call returned an error, **or** the LLM requested the exact same tool name
  + arguments twice in a row (a naive loop-detector, cheap and sufficient
  for a single-user system). Hitting the active budget ends the run with
  the same graceful "reached the iteration limit" message
  `Orchestrator.ts` already returns today.
- **AC9**: For a **complex** task, after a non-tool-call LLM response, the
  graph checks whether the task is genuinely finished or still in progress
  (§7.2 — the LLM's response includes a structured `status` field for
  complex tasks only; simple tasks are always "finished" after a non-tool
  response, no such field needed).
  - **Still in progress** → the **compressor** (small/fast model, §7.3)
    replaces the current in-flight message list with a short summary + the
    most recent exchange, and the loop continues (AC7) with that compressed
    context instead of the full transcript. **This summary is never
    persisted** — it lives only for the remaining iterations of this one
    request (see `knowledge-store/003-chat-sessions`'s note on why this is
    a different thing from that spec's persisted `ChatMessage` history).
  - **Finished** → the final response is returned, same as today.

## 4. Where inter-agent communication fits

Felix asked where agent-to-agent calls belong in this flow — answered by
AC7: **the same decision point as MCP tools.** From a calling agent's LLM's
point of view, "ask another configured agent to do this part" looks exactly
like a tool it can request — it's just that when the graph goes to execute
that particular "tool," it invokes another agent's compiled subgraph
(`orchestrator/002-multi-agent`) instead of going out over MCP, and feeds
that subgraph's final answer back into the transcript the same way a real
tool's result would be. No second decision branch, no second loop — one
execution node that dispatches to either `McpManager.callTool` or a
sub-agent's `graph.invoke`, based on which kind of handle the LLM requested.
This is also why `002-multi-agent` depends on this spec rather than the
reverse: the single-agent graph has to exist and work first, since a
multi-agent run is just this same graph with more callable handles.

## 5. `knowledge-store` — endpoint extension

`GET /knowledge-entries/search` (existing, `002-retrieval` §4): `limit` max
raised from 5 to **20**. No other contract change — reranking happens in
`orchestrator`, not `knowledge-store` (see §7.4 for why).

**Correction, found while implementing**: this spec originally said the
top-20 fetch is unfiltered. It isn't — `knowledge-store`'s existing
`SIMILARITY_THRESHOLD` (0.35, cosine similarity, `002-retrieval` §7.1)
still applies server-side before `LIMIT 20`, same as it always has for the
top-5 case. Kept deliberately rather than adding a second, unfiltered
search mode: it's a cheap, loose pre-filter (0.35 rarely excludes anything
the reranker — §7.1's real relevance filter — would have kept), and adding
an "unfiltered" variant of this endpoint purely for this one caller wasn't
worth the extra surface. The reranker's `sigmoid(logit) ≥ 0.5` bar is still
what actually decides relevance (AC3/AC4) — the 0.35 embedding threshold
only shapes which 20 candidates get to compete for that decision.

## 6. `orchestrator` — LangGraph structure

```
                     ┌─────────────────┐
        ┌───────────▶│  RAG top-20     │──────┐
        │            └─────────────────┘      ▼
 [user turn]                            ┌──────────────┐     ┌───────────────────┐
        │                               │   reranker   │────▶│ ¿tenemos info?     │──┐
        └───────────▶┌─────────────────┐└──────────────┘     │ (AC4)              │  │
                      │  SkillRouter    │───────────────────▶ └───────────────────┘  │
                      │ (skills+complex)│                                            │
                      └─────────────────┘                                            ▼
                                                                          ┌───────────────────────┐
                                                                          │ ¿tarea compleja? (AC5) │
                                                                          └───────────────────────┘
                                                              complex ──────┘        └────── simple
                                                                 ▼                              ▼
                                                        ┌────────────────┐            ┌──────────────────┐
                                                        │  LLM: hace plan │──────────▶│  LLM call (AC6/7) │◀┐
                                                        └────────────────┘            └──────────────────┘ │
                                                                                                │            │
                                                                              ¿tool/agent call? │           │
                                                                         yes ─────┴───── no      │
                                                                          ▼                       ▼         │
                                                                 ┌──────────────────┐   ┌────────────────────────┐
                                                                 │ ejecutar tool /   │   │ ¿compleja y en curso?   │
                                                                 │ sub-agente (AC7)  │   │ (AC9)                   │
                                                                 └──────────────────┘   └────────────────────────┘
                                                                          │              en curso │      terminada
                                                                          │ (loop, AC8)           ▼            ▼
                                                                          └───────────▶┌──────────────┐  ┌──────────┐
                                                                                        │  compresor   │  │ respuesta│
                                                                                        │  (AC9)       │  │  final   │
                                                                                        └──────────────┘  └──────────┘
                                                                                               │
                                                                                               └── loop back to LLM call
```

### 6.1 Graph state (`src/graph/state.ts`)

```typescript
interface PipelineState {
  messages: LlmMessage[];                 // current in-flight transcript (may be compressed, AC9)
  ragTop20: SearchKnowledgeEntriesResult[];
  rerankedTop5: SearchKnowledgeEntriesResult[];
  hasSufficientInfo: boolean;              // AC4
  skillsToUse: string[];                   // SkillRouter output
  isComplex: boolean;                      // SkillRouter output
  plan?: string;                           // AC5, complex only
  iterationCount: number;
  isFailing: boolean;                      // AC8
  maxIterations: number;                   // 10 | 5, derived from isFailing
  taskStatus?: 'IN_PROGRESS' | 'DONE';     // AC9, complex only
  finalResponse?: LlmMessage;
}
```

### 6.2 New collaborators

```typescript
// src/skills/SkillRouter.ts
export interface SkillRouterDecision { skills: string[]; isComplex: boolean; }
export interface SkillRouter { route(userMessage: string): Promise<SkillRouterDecision>; }

// src/retrieval/Reranker.ts — Strategy, Transformers.js implementation
export interface RerankedResult extends SearchKnowledgeEntriesResult { score: number; }
export interface Reranker { rerank(query: string, candidates: SearchKnowledgeEntriesResult[], topK: number): Promise<RerankedResult[]>; }

// src/llm/SmallLlmProvider — reuses the existing ILlmProvider abstraction (LlmProviderFactory),
// a second, separately-configured instance for SkillRouter's classification call and the compressor.
```

## 7. Defaults & Assumptions (mark any correction inline)

1. **Reranker minimum score bar: sigmoid(raw logit) ≥ 0.5, default 0.5.**
   Calibrated during implementation against this vault's real data — the
   cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2`) scored a genuinely
   relevant note (a "comida favorita" query against the pizza note) at
   **~0.997** and unrelated notes in the same vault at **~0.0016** and
   **~0.00001** — an enormous, clean gap, so `0.5` is a comfortable default
   with real margin either side. **Also found during implementation, not
   obvious from the model card**: the naive approach —
   `pipeline('text-classification', model)`, the documented high-level API
   — silently produced a useless constant `1.0` for every candidate
   regardless of relevance, because that wrapper unconditionally applies
   `softmax` to the model's output as if it were multi-class, and this
   model has a **single** regression logit — `softmax` of one value is
   always exactly `1`. Fixed by using `AutoTokenizer`/
   `AutoModelForSequenceClassification` directly (`tokenizer(query, {
   text_pair: candidateText })` → raw logit → `sigmoid`), bypassing the
   pipeline wrapper entirely. Isolated in one place (`Reranker`'s
   implementation) if this ever needs recalibrating again.
2. **"Still in progress" signal (AC9)**: a `status: 'IN_PROGRESS' | 'DONE'`
   field the LLM is asked to emit as part of a complex-task response
   (via the tool/response schema, not free text parsing) — simple-task
   responses never carry this field and are always treated as `DONE`.
3. **Small/fast model (SkillRouter + compressor)**: reuses the existing
   `ILlmProvider`/`LlmProviderFactory` Strategy — new env vars
   `SMALL_LLM_PROVIDER`/`SMALL_LLM_MODEL`. Default to whichever provider is
   cheapest to add zero new credentials for (`OPENAI_API_KEY` is already
   configured for embeddings, so its smallest/fastest chat-completion tier
   is the pragmatic default) — the exact model string isn't pinned here on
   purpose (model lineups change faster than this doc); confirm the current
   cheapest OpenAI (or provider of choice) tier at implementation time.
4. **Reranking runs in `orchestrator`, not `knowledge-store`.** Transformers.js
   is a reasoning-pipeline concern (it's scoring relevance for THIS
   request's context assembly, same conceptual layer as the SkillRouter and
   the compressor), not a data-store concern — `knowledge-store` stays
   "dumb" vector similarity + CRUD, consistent with `ADR-0001`'s framing of
   what that service owns.
5. **Loop-detection for AC8's "failing" signal is intentionally naive**
   (exact tool name + arguments repeated once) — good enough for a
   single-user system; a smarter detector is future work if it turns out to
   trigger too eagerly/rarely in practice.

## 8. Open Questions — resolved 2026-09-17

- **OQ1 — Small/fast model**: API-based, not local (Ollama) — confirmed,
  keeps this round's infra footprint down; local models stay future work.
- **OQ2 — Compressor's memory scope**: in-request-only, never persisted —
  confirmed, see `knowledge-store/003-chat-sessions` §8 OQ1 for the same
  answer cross-referenced from that spec.
- **OQ3 — Skills: router-selected vs always-on**: router-selected —
  confirmed. **Correction found while implementing this spec**: the
  interview's framing ("today all skill files load into every prompt") was
  wrong. Reading the actual code: `inquireController` only resolves the
  skill names present in the request body's optional `skills` array
  (default `[]`); nothing currently calls `skillManager.list()` to
  auto-populate it, and `services/frontend` never sends that field at all —
  so in the app as it actually runs today, **zero skills are ever
  injected**, not "all of them." The `SkillRouter` isn't replacing an
  always-on default, then — it's what makes automatic skill selection exist
  for the first time. Net effect on this spec's design is the same either
  way (the router decides which skill names to resolve, AC2/AC5), just the
  "before" picture was inaccurate.

## 9. Out of Scope — Future Work

- Calibrating the reranker's score bar against real usage (§7.1) — flagged
  the same way `002-retrieval`'s threshold was, expect a follow-up fix once
  live data exists.
- A local (Ollama) option for the small/fast model.
- Smarter loop detection than exact-repeat (§7.5).
- ONIROS / persisted short-term memory (still a different, unscoped
  concept — see `docs/context.md`).
