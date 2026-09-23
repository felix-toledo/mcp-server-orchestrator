# Tasks — Reasoning pipeline (LangGraph)

Base: [`plan.md`](./plan.md) §7. This was the largest single task list in
this round — it took real time, per ADR-0003's own warning not to treat
LangGraph as a drop-in, and surfaced three genuine bugs live (below), not
just the usual "write it, test it" work.

- [x] **T1 — `knowledge-store`**: raise `search`'s `limit` cap 5 → 20 on
  both `knowledge-store`'s Zod schema and `mcp-server`'s tool schema (the
  latter wasn't in the original plan's wording, but the MCP tool has its
  own independent Zod validation — missing it meant the graph's `limit: 20`
  request got rejected with a `400` at the MCP layer even after the
  knowledge-store endpoint itself was fixed; found live, see T8's log).
- [x] **T2 — `PipelineState` + pure nodes**: `checkSufficientInfo` (AC4),
  `checkTaskStatus` (AC9, plus stripping the `[STATUS: ...]` marker out of
  the message before it can reach the user — not originally spelled out in
  the plan, added once the marker's own text made it obvious it would leak
  otherwise). Tests: both branches each.
- [x] **T3 — `SkillRouter` + small-model provider**: `LlmProviderFactory.createSmall()`
  (new) + `DefaultSkillRouter`, structured-output classification (skills +
  complexity) via prompt + defensive JSON parsing (no native structured-output
  mode assumed, since `ILlmProvider` is provider-agnostic). Tests: mocked
  small-model response parsing, markdown-wrapped JSON, malformed-output
  fallback, invented-skill-name filtering.
- [x] **T4 — `Reranker` (Transformers.js)**: `TransformersJsReranker`.
  **Real bug found live, not from a test**: the documented high-level API
  (`pipeline('text-classification', model)`) silently returned a useless
  constant `1.0` for every candidate, because `Xenova/ms-marco-MiniLM-L-6-v2`
  has a single regression logit and that pipeline wrapper always applies
  `softmax` — `softmax` of one value is always `1`. Fixed by using
  `AutoTokenizer`/`AutoModelForSequenceClassification` directly and
  `sigmoid`-normalizing the raw logit myself. Real calibration data from
  this vault: a true match scored ~0.997, unrelated notes ~0.0016/~0.00001
  — `0.5` minimum score bar has real margin. See spec §7.1 for the full
  writeup.
- [x] **T5 — Remaining nodes**: `fetchRagTop20`, `rerank`, `makePlan`,
  `callLlm`, `executeToolsOrAgents` (AC7/AC8), `compress` (AC9),
  `finalizeResponse`. One test file per node, 26 tests total across the
  graph package.
- [x] **T6 — `buildReasoningGraph`**: wired per plan §3.
  **Real bug found live, not from a test**: `checkSufficientInfo` has two
  predecessors (`rerank`, `runSkillRouter`) at *unequal* depth from
  `START` (2 hops vs. 1). LangGraph does not wait for all predecessors
  before running a node — it runs once per predecessor that completes, in
  whatever superstep that predecessor finishes in. With unequal depths,
  `checkSufficientInfo` (and everything downstream, including `callLlm`)
  ran **twice** per request: once as soon as `runSkillRouter` finished
  (with `rerankedTop5` still empty), and again once `rerank` actually
  finished. This is what caused the very real, user-visible symptom of a
  tool-call being requested without ever getting a matching tool-result
  message appended before the next LLM call, which OpenAI/DeepSeek's API
  correctly rejected (`400: An assistant message with 'tool_calls' must be
  followed by tool messages...`). **Fixed** by adding a `noop` pass-through
  node (`runSkillRouter → awaitSkillRouter → checkSufficientInfo`) so both
  branches are the same depth and land in the same superstep — see
  `buildReasoningGraph.ts`'s `noop` doc comment for the full explanation.
  This is a load-bearing LangGraph gotcha worth remembering for
  `orchestrator/002-multi-agent`'s graph work too.
- [x] **T7 — `inquireController` cutover**: swapped in
  `graph/graphRuntime.ts` (new composition root), removed
  `Orchestrator.ts`/`Orchestrator.test.ts`/`formatRetrievalContext.ts`
  (superseded by `formatRerankedContext.ts`). **A third real bug found
  live**: `graphRuntime.ts`'s first draft set an `initialized` boolean to
  `true` *before* the async MCP-connect work actually finished. The
  background pre-warm call in `index.ts` isn't awaited by the request path,
  so the very first real request landed in the window between that flag
  flipping and the connection actually completing, saw "already
  initialized," skipped waiting, and got `mcpManager === null` — the "no
  tools available" fallback message, even though MCP wasn't actually down,
  just still connecting. Fixed by replacing the boolean with a single
  shared in-flight `Promise` every caller awaits.
- [x] **T8 — Manual regression**: re-ran `002-retrieval`'s verified
  scenarios end to end against the new graph (all three bugs above were
  found *during* this step, not before it) — confirmed: automatic
  retrieval still grounds answers (a "comida favorita" query correctly
  surfaced an unrelated-topic note via the reranker), saves via
  `createKnowledgeEntry` work and persist to disk, the assistant stays
  silent about internal mechanics (AC1/AC6), and a conflicting existing
  note makes it ask for clarification instead of silently overwriting
  (reads as sensible LLM behavior grounded in retrieved context, not a bug).

**A fourth bug, unrelated to this spec's own logic**, surfaced during T8's
testing and is logged in `knowledge-store/004-vault-folders-and-llm-summaries`'s
`tasks.md` instead (an unhandled-rejection crash in `knowledge-store`'s
Express routes) — noted here only so the cross-reference isn't lost.

**Investigation note (2026-09-17), not a pipeline bug**: a live test of the
reranker appeared to return 0 results for a query that scored 0.94 in an
isolated script with "the same" input. Added logging inside `Reranker.rerank`
itself and found the incoming `query` string had `U+FFFD` replacement
characters in place of `é`/`ó`, while the knowledge-store-sourced candidate
text was fine. Root cause: my own `curl -d "..."` test commands, typed with
accented characters inline in the Git-Bash/Windows shell invocation — argv
encoding got mangled before curl ever sent the request. Not a real bug in
this codebase. Fixed the test method (write the JSON payload to a file, then
`curl --data-binary @file`) and confirmed the pipeline was correct all
along. Debug logging removed from `Reranker.ts`, `rerank.ts`,
`checkSufficientInfo.ts`. Worth remembering for future live testing on this
machine — never type non-ASCII characters directly into an inline `curl -d`
argument here.

**A fifth, real gap found live during the same round**: asked the assistant
to save a fact that contradicted an already-saved note ("mi color favorito
es el verde esmeralda" when a `color-favorito-verde.md` note already said
"rosado"). Confirmed via the orchestrator log that `createKnowledgeEntry`
was never called, yet the assistant replied "Tu color favorito es el verde
esmeralda." as if it had been saved — a fake-success case matching exactly
the class of bug this session's system instructions were meant to prevent.
Root cause: the LLM has no `updateKnowledgeEntry` MCP tool (only
`createKnowledgeEntry`, which always makes a new file), and
`systemInstructions.ts` had no guidance for the "new info conflicts with
retrieved context" case, so the model just verbally agreed instead of
acting. **Fixed at the prompt level** (no new tool built — out of this
spec's scope, and a real `updateKnowledgeEntry` tool is its own future
capability): added an explicit rule to `BASE_SYSTEM_INSTRUCTIONS` that a
contradiction must never be confirmed as saved without a real tool call —
ask the user to confirm the update first, then persist it via
`createKnowledgeEntry` (accepting that this creates a new note rather than
editing the old one in place, since no update tool exists yet). Verified
live: re-asking the same question now gets "No tengo el verde esmeralda
anotado... ¿Querés que lo actualice?", and after confirming, a new
`color-favorito-verde-esmeralda.md` note is created that explicitly says it
supersedes the old rosado value. **Known limitation, not fully solved**:
the vault now accumulates one file per correction instead of updating in
place, and retrieval could surface both the stale and current note for the
same fact — a real `updateKnowledgeEntry` tool (with the old note either
overwritten or archived) is future work, not scoped to this spec.

## Amendment (2026-09-18) — live status while the graph runs

Felix's ask: "si estan trabajando a full todos los agentes, quiero poder
ver en que estan, que me den estados, no mandar y tener que esperar 10
minutos... como que en el medio quiero ir viendo que estan haciendo."
Confirmed during clarification (same round as the team-hierarchy/team-chat/
Projects amendments elsewhere): **polling, not token-by-token streaming** —
reuses the existing request/response shape, no new SSE/WebSocket layer.

- **`graph/inquireStatusStore.ts`** (new) — a plain in-memory
  `Map<requestId, {label, updatedAt}>`, single-process by design (matches
  this whole service's single-instance deployment). `NODE_LABELS` maps each
  real graph node name to a short, lowercase, Spanish status line matching
  ALMA's voice (`docs/context.md`'s naming-convention note — user-facing
  copy is the one place this repo writes non-English).
- **`runReasoningGraph` switched from `graph.invoke()` to `graph.stream()`**
  (`streamMode: 'updates'`) — yields `{ [nodeName]: partialUpdate }` per
  completed node, which is exactly what's needed to update the status
  store; only `finalizeResponse`'s own update ever sets `finalResponse`, so
  that one key is what the final reply is pulled from (no change to the
  reply itself, same `LlmMessage` either way). Split into two small helpers
  (`invokeTeamChat`, `runRootGraphWithStatus`) specifically to keep
  `runReasoningGraph`'s own cyclomatic complexity under ESLint's threshold
  — the straightforward inline version hit 16 against a max of 10.
  - **Known limitation, accepted**: a nested agent/team delegation
    (`executeToolsOrAgents` calling into `AgentRegistry.invoke`/
    `invokeTeam`) runs on a *different* compiled graph's own `.invoke()`,
    not through the root's `.stream()` — so the status stays on
    "usando herramientas o consultando a otros agentes…" for the whole
    duration of a nested delegation, not node-by-node inside it. Honest
    (never wrong), just coarser than the top-level graph's own status.
- **`requestId`, not `sessionId`, is the polling key** — generated
  client-side (`crypto.randomUUID()`) *before* the blocking `POST
  /api/inquire` call even starts, so the frontend can poll
  `GET /api/inquire/status/:requestId` immediately, including for the very
  first message of a brand-new session (which has no `sessionId` yet).
  Cleared in `inquireController.ts`'s `finally` block — a finished request
  (success, error, or the onboarding-gate early exit) has nothing left to
  poll for.
- **Frontend**: `ChatPanel.tsx` and `TeamChatPanel.tsx` each poll every 2s
  (`setInterval` in a `useEffect` keyed on `isSending`/`pendingRequestId`)
  and show the label as a small italic line above the composer while
  sending. Duplicated rather than extracted into a shared hook —
  `TeamChatPanel` is deliberately self-contained (see its own doc comment)
  and the polling logic is short enough that the duplication costs less
  than a new shared-hooks convention would.
- **Verified live**: fired a real `/api/inquire` call in the background and
  polled `/api/inquire/status/:requestId` while it was running — watched
  the label progress from "revisando tu bóveda…" to "pensando…", then
  confirmed it returned to `null` immediately after the reply came back.
  Repeated for the team-chat branch (`teamId` given) — status showed
  "consultando al equipo…" for the real "empresa de algo" team, cleared
  after. Both test sessions deleted afterward; the real team was untouched.

## Addendum, 2026-09-18 — profile-note label + a Telegram equivalent

Two follow-ups the same day this amendment's own knowledge-store/002 fix
landed:

1. **New node label**: `knowledge-store/002-retrieval`'s 2026-09-18
   correction added a `fetchProfileNote`/`awaitProfileNote` pair to the
   graph's parallel fan-out (always-fetch the profile note, not a search).
   `NODE_LABELS` in `inquireStatusStore.ts` got a matching
   `"revisando tu perfil…"` entry for both — otherwise that hop would
   silently report nothing while it ran, an honest-but-incomplete status
   the rest of this feature explicitly tries to avoid.

2. **Telegram had no equivalent at all** — Felix pointed out that waiting
   on a Telegram reply gave zero feedback, unlike the web app. Investigated
   first (not assumed): confirmed the web mechanism itself was already
   fully wired and working live (`ChatPanel.tsx` polling
   `GET /api/inquire/status/:requestId` every 2s, verified again with a
   fresh live poll showing "revisando tu perfil…" → "pensando…" → "armando
   un plan…" for a real request) — Telegram genuinely had nothing, not a
   bug in the web path.

   Built the Telegram equivalent reusing the *same* backend mechanism, no
   new orchestrator surface: `telegram-bot`'s `OrchestratorClient` gained
   `requestId` on `inquire()` and a mirrored `getInquireStatus()` (same
   shape as `frontend`'s own client). `ChannelService.handleIncomingMessage`
   now sends a placeholder message immediately ("pensando…"), polls status
   every 2s editing that same message in place only when the label actually
   changes (Telegram rejects a no-op edit, and re-editing unchanged text
   every 2s would waste rate-limit budget for nothing visible), and lands
   on the real answer as its last edit instead of sending a second message.
   `TelegramSender.sendMessage` had to start returning `{ messageId }`
   (previously `void`) so there's something to edit, and gained
   `editMessage`. `handleIncomingMessage`'s signature grew a leading
   `chatId` param — it now owns delivery end to end, so
   `telegramBot.ts`'s `bot.on('message:text', ...)` handler no longer calls
   `ctx.reply()` itself, it would double-send otherwise.

   **Verified live, not just unit-tested**: ran `ChannelService` directly
   against the real running `orchestrator`/`knowledge-store` (a fake
   `TelegramSender` that only logged, no real Telegram message sent) and
   watched the actual edit sequence — placeholder → "revisando tu
   bóveda…" → "pensando…" → the real final answer, all through the same
   live status store the web app uses. Caught a real side effect from that
   same verification run: `getTelegramLink()` returned Felix's *actual*
   configured link (a real bot is already set up — `chatId`/
   `currentSessionId` are real), so the test question got appended into
   his real Telegram session's history in `knowledge-store`. Not caught
   until after the fact — no `ChatMessage`-level delete endpoint exists, so
   the two injected rows were removed with a direct `DELETE` on just those
   two ids, leaving the rest of that session's real history untouched.
   **Lesson for next time**: exercising `ChannelService` against live
   services needs a throwaway `chatId` *and* a knowledge-store instance
   with no real `TelegramLink` configured, or an explicit fake
   `knowledgeStoreClient` — reaching the real one during manual
   verification isn't safe by default the way it is for the web chat path
   (which always starts a fresh `ChatSession`, never resumes a real one by
   accident).

   New/changed tests: `orchestratorClient.test.ts` (telegram-bot) gained
   `requestId`-forwarding and `getInquireStatus` coverage;
   `channelService.test.ts` updated every `handleIncomingMessage` call site
   for the new `chatId` param, and added three new tests (placeholder →
   edit-into-final-answer, polls-and-edits-only-on-change using fake
   timers, and the empty-final-answer fallback). `services/telegram-bot`:
   40/40 passing, `tsc` and `eslint` both clean.

3. **The web app's own status line turned out to be silently broken the
   whole time** — Felix confirmed Telegram now showed "pensando…." but the
   web `ChatPanel` showed nothing, "debe ser algún problema de ui". Didn't
   guess: drove the real running app with Playwright (`chromium` via
   `@playwright/test`, already a frontend dependency for its own e2e
   suite) against `http://localhost:30022`, sent a real message, and
   logged every network request. Root cause, visible directly in the
   network log: **Next.js App Router runs Server Actions from the same
   page through a single client-side action queue, one at a time** — the
   `getInquireStatus` action calls (fired every 2s by `ChatPanel`'s
   `useEffect`) never actually left the browser until the concurrent
   `sendChatMessage` action had *already resolved*, several seconds late,
   then all fired in a burst — completely defeating the point of polling
   *during* the wait. This is a real, documented Next.js behavior (its
   action queue exists to keep router state consistent across actions,
   not a bug specific to this app), not something tunable from this
   codebase's side.

   **Fix**: moved status polling off the Server Action path entirely, onto
   a plain Next.js Route Handler (`app/api/inquire-status/[requestId]/route.ts`)
   — a Route Handler is an ordinary HTTP endpoint, outside the action
   queue, so a client-side `fetch` to it runs genuinely concurrently with
   an in-flight Server Action. This is already `docs/conventions/frontend.md`'s
   documented alternative to a Server Action ("Talking to the backend"),
   not a new pattern introduced here. Both `ChatPanel.tsx` and
   `TeamChatPanel.tsx` (same duplicated-on-purpose polling shape, see that
   component's own doc comment) now call a shared `lib/fetch-inquire-status.ts`
   helper instead of the old `actions/get-inquire-status.ts` Server Action,
   which was deleted (nothing else used it).

   **Verified live again after the fix**, same Playwright script, same
   real message: `GET /api/inquire-status/:requestId` requests now fire
   every ~2s *while* `sendChatMessage`'s action is still pending, and the
   status line renders and updates in the actual DOM ("pensando…" →
   "armando un plan…") before the final answer replaces it — screenshotted
   both mid-wait and on completion. Cleaned up the three throwaway chat
   sessions this diagnostic pass created in the real `knowledge-store` (it
   goes through the real backend, not a mock — same caution as the
   Telegram verification above).

   New/changed tests: `lib/fetch-inquire-status.test.ts` (3 tests) and
   `app/api/inquire-status/[requestId]/route.test.ts` (2 tests), replacing
   `actions/get-inquire-status.test.ts` (deleted with the action itself).
   `services/frontend`: 93/93 passing, `eslint` clean (build intentionally
   skipped per this repo's own `CLAUDE.md` warning — never run
   `build`/`build:frontend` while `dev:frontend` is running, it corrupts
   the shared `.next` folder).

4. **Web live typing, same day** — Felix's actual ask: "no podemos hacer
   que me escriba para responderme? tipo solo en web ir viendo de a poco
   ya a medida que va respondiendo, tipo streaming", explicitly web-only
   ("en telegram esta bien porque no se puede"). Reuses everything already
   built for points 1–3 rather than adding a new transport — the polling
   mechanism was a deliberate choice from this feature's original
   clarification ("polling, not token-by-token streaming... not a new
   pub/sub or SSE layer", `inquireStatusStore.ts`'s own doc comment), so
   this extends that same store/endpoint with a second, orthogonal field
   instead of relitigating SSE.

   - **`ILlmProvider`** gained an optional `streamResponse(messages, tools,
     onChunk)` method — same return shape as `generateResponse`, calls
     `onChunk` per `content` delta as it arrives. Optional so callers
     degrade to `generateResponse` when a provider doesn't implement it.
   - **`OpenAIProvider`** (DeepSeek's own provider — see
     `LlmProviderFactory.create`'s `'deepseek'` case, it's a thin config
     wrapper around this exact class) implements it: `stream: true` on the
     same request, tool-call deltas accumulated by `index` since a
     response can request more than one in parallel and each one's
     `arguments` streams as fragmented partial JSON text (extracted into a
     `mergeToolCallDelta` helper + an `accumulateStream` helper, split out
     specifically to keep the method's own cyclomatic complexity under
     ESLint's threshold — same reasoning already used elsewhere in this
     codebase for that exact warning). **Not implemented for
     Gemini/Copilot** — out of scope, the active provider is DeepSeek, same
     "single active provider, revisit if this becomes a problem" pattern
     already used throughout this repo (e.g. the embeddings provider
     choice in `001-vectorization`).
   - **`inquireStatusStore.ts`** gained `partialText` alongside `label` on
     the same per-`requestId` entry, plus `resetPartialText`/
     `appendPartialText`. `inquireStatusController` forwards both fields
     now.
   - **`PipelineState`** gained `requestId: string | undefined` — set once
     at the initial `graph.stream(...)`/`invokeTeam(...)` call (same
     per-invocation-not-per-graph-build pattern already established for
     `currentTeamId`, see that field's own doc comment: a delegated
     agent's compiled subgraph is cached and reused across many requests
     in `AgentRegistry`, so anything request-specific has to travel
     through `state`, never through `ReasoningGraphDeps`'s build-time
     closure). This is what lets `callLlm.ts` know which store entry to
     stream into — and, as a side effect, a delegated agent's own final
     answer streams too, since `state` (including `requestId`) flows
     through nested `AgentRegistry.invoke`/`invokeTeam` calls unchanged.
   - **`callLlm.ts`**: when `streamResponse` exists on the active provider
     and `state.requestId` is set, resets that request's `partialText` and
     streams into it; otherwise falls back to `generateResponse` exactly
     as before (e.g. most unit tests, which call the node without a
     `requestId`). No special-casing for tool-calling turns — a pure
     tool-call response just streams no `content` deltas, harmless.
   - **Frontend**: `fetchInquireStatus` now returns `{ label, partialText
     }`; `ChatPanel.tsx`/`TeamChatPanel.tsx` render the growing
     `partialText` as a live `MessageBubble` once it's non-empty,
     otherwise still show the status label as before. Poll interval
     dropped from 2000ms to 300ms on both (cheap for a single local user)
     so the growing answer reads as typing rather than a stop-motion
     status update — chunkier than true character-by-character SSE, a
     known trade-off of staying on the polling mechanism, not attempted to
     be hidden.

   **Verified live, twice, not just unit-tested**: (1) a Node script
   polling `GET /api/inquire/status/:requestId` every 200ms against the
   real running orchestrator while asking for the full profile — watched
   `partialText.length` grow 0 → 33 → 282 → 407 → 576 → final 806 chars
   before the request finished; the very first attempt at this (a short
   answer, curl-based polling with ~580ms real intervals due to per-loop
   process-spawn overhead) showed nothing, since a short DeepSeek reply
   can finish streaming inside one polling gap — not a bug, just too
   coarse a test, redone with a tighter Node-based poll and a longer
   answer to actually observe it. (2) The real browser again, via
   Playwright: DOM-queried `.message-bubble__content` text length over
   time (constant at 88 — the user's own bubble — for ~5.7s, then 152 →
   431 → 669 → final 806), plus a mid-stream and a final screenshot,
   confirming the same growth visually, not just via the DOM query.
   Cleaned up every throwaway chat session this round of verification
   created in the real `knowledge-store`, same caution as every other
   live-verification pass in this file.

   New/changed tests: `ILlmProvider.ts` needed no test (interface-only
   change); `OpenAIProvider.test.ts` (new file — this class had *no* test
   coverage before, a pre-existing gap not otherwise backfilled here, but
   the new `streamResponse` method got 3 tests: content-delta accumulation
   and `onChunk` calls, fragmented tool-call-delta accumulation by index,
   and a no-content turn never calling `onChunk`); `inquireStatusStore.test.ts`
   gained 3 tests for `partialText`; `inquireController.test.ts` gained 1
   for forwarding it; `callLlm.test.ts` gained 3 (streams when available,
   falls back without `streamResponse`, falls back without `requestId`);
   the same ~10 `orchestrator` test files that hand-construct a full
   `PipelineState` literal needed `requestId: undefined` added (same
   mechanical update this file's already documented twice today for
   `profileNote`). Frontend: `orchestrator-client.test.ts` and
   `fetch-inquire-status.test.ts` updated for the new `{ label,
   partialText }` shape, `route.test.ts` likewise.
   `services/orchestrator`: 145/145. `services/frontend`: 95/95. Both
   `tsc`/`eslint` clean (frontend build still intentionally skipped, same
   reason as point 3).
