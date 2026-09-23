# Tasks — Configurable agents + agent-to-agent invocation

Base: [`plan.md`](./plan.md) §5. Depends on
`orchestrator/001-reasoning-pipeline` being implemented first.

- [x] **T1 — `knowledge-store`: `Agent` schema + service + HTTP surface**:
  the `Agent` Prisma model already existed (landed earlier alongside
  `knowledge-store/003-chat-sessions`/`004`'s combined migration — see that
  spec's T1). Added `AgentService` (`allowedTools`/`allowedSkills`/
  `pipelineSteps`), `agentsController` (full CRUD), routes, `AgentInputSchema`.
  **Real bug found via `tsc`, not a test**: Prisma's `Json?` columns treat a
  plain `null` as ambiguous with `undefined` (leave the field untouched) —
  writing an actual JSON null requires the `Prisma.JsonNull` sentinel
  instead, or `tsc` rejects it outright (`Type 'string[] | null' is not
  assignable to type 'NullableJsonNullValueInput | ...'`). Fixed with a
  `jsonOrNull` helper in `agentService.ts`. Same class of gotcha as the
  `embedding Unsupported` one already documented in CLAUDE.md, now the
  second Json-column pitfall found in this codebase. Tests: 8 in
  `agentService.test.ts`, 9 new route tests in `server.test.ts`. Verified
  live: `allowedTools: null` (unrestricted) and `allowedTools: []`
  (explicitly none) both round-trip correctly through create/update/list,
  delete is idempotent (204 then 404).
- [x] **T2 — `AgentRegistry` skeleton + `toolHandlesFor`**: excludes self
  (AC4). `src/agents/AgentRegistry.ts` — `agentHandleName` slugifies (strips
  accents, snake_cases) a configured agent's name into `askAgent_<slug>`.
  Tests: excludes the caller, includes every other agent, `isAgentHandle`
  recognizes registered vs. arbitrary tool names.
- [x] **T3 — `buildPipelineAgentGraph`**: fixed-sequence graph for
  `pipelineSteps` agents (AC5), `src/agents/buildPipelineAgentGraph.ts` —
  one node per step calling `agentRegistry.invoke(stepAgentId, state)`,
  `START → step1 → step2 → ... → END`, no LLM call of its own. Tests:
  sequence order, each step's reply appended to `messages` so the next step
  sees it, shared iteration counter passed through unchanged.
- [x] **T4 — `AgentRegistry.invoke`**: both graph shapes (full LLM-driven
  vs pipeline), shared iteration state (AC6) — `state` flows into the
  nested `graph.invoke` unchanged, no fresh counter. `getOrBuildGraph`
  memoizes per agent id; a pipeline agent gets `buildPipelineAgentGraph`,
  everything else gets `buildReasoningGraph` scoped to that agent's
  `allowedTools`/`allowedSkills`/`systemPromptAddendum`. Tests per plan §4.
- [x] **T5 — Extend `001`'s `executeToolsOrAgents`/`callLlm` nodes**:
  `executeToolsOrAgents`'s agent-handle dispatch already existed (built
  ahead of this spec, forward-compatible extension point, per its own doc
  comment) — nothing to change there. `callLlm` gained an optional
  `systemPromptAddendum` (AC3: appended, never replaces
  `BASE_SYSTEM_INSTRUCTIONS`) and `buildReasoningGraph` gained
  `availableSkills` (AC1's `allowedSkills` restriction, mirrors the tools
  restriction). `graphRuntime.ts` now fetches configured agents from
  `knowledge-store` (`KnowledgeStoreClient.listAgents`, fail-open to `[]`
  per AC2) every request and builds an `AgentRegistry`; the **root**
  graph's own `tools` becomes `[...mcpTools, ...agentRegistry.toolHandlesFor(null)]`
  — AC4 doesn't exclude the default/no-agent conversation, so the plain
  chat interface can delegate to any configured agent without needing
  `ChatSession.agentId`/a frontend picker (that wiring is
  `frontend/004-chat-shell` AC9's own task list, per plan.md step 6 — not
  this spec's). Tests: AC2 regression (fetch failure/`[]` agents →
  `toolHandlesFor` returns `[]`, byte-identical to `001` alone).
- [x] **T6 — Manual end-to-end**: configured a real "Traductor" agent
  (translate-only persona) and delegated to it from a plain chat message —
  confirmed live: the root LLM called `askAgent_traductor`, got back a
  correct French translation, and relayed it naturally. Also configured a
  second "Eco" agent instructed to always delegate to Traductor, asked the
  root to talk to Eco — confirmed Eco's own LLM could **not** see a handle
  to call itself (AC4's self-exclusion working end to end, not just in a
  unit test) and the whole exchange terminated gracefully in ~22s with no
  hang. A plain "hola, como estas" with agents configured but not
  addressed still answered normally (AC2 sanity — configuring agents
  doesn't hijack unrelated turns). Cleaned up both test agents afterward.
  **Real bug found live, not from a test**: delegating from the root to
  Traductor first failed with the exact same class of error T6 in
  `001-reasoning-pipeline/tasks.md` already documented once
  (`400: An assistant message with 'tool_calls' must be followed by tool
  messages...`) — but a genuinely new instance of it, not a regression of
  the old fix. `executeToolsOrAgents` calls `agentRegistry.invoke(name,
  state)` *while* it's still in the middle of resolving that very tool
  call, so `state.messages` still ends with the caller's own assistant
  message carrying the **unresolved** `tool_calls` entry for this
  delegation (its matching tool-result message is this call's own job to
  produce). Handing that straight to the sub-agent's `callLlm` sent the
  dangling `tool_calls` message to the LLM API as-is. **Fixed** in
  `AgentRegistry.invoke` — strips a trailing assistant message with
  unresolved `toolCalls` before invoking the sub-agent's graph
  (`stripDanglingToolCall`), so the sub-agent only ever sees the
  conversation up to the point of delegation. Regression test added in
  `AgentRegistry.test.ts`.

## Addendum, 2026-09-18 — real bug: unbounded agent-to-agent recursion

Felix, using the real "juancho market" team (CEO/CTO/marketing, CEO as
coordinator): "podes preguntarle a los agentes de juancho como viene el
negocio" put ALMA into a visible loop — "dale le pregunto a los dos,
desaparece, vuelve, le pregunto, desaparece, vuelve." Not a UI glitch:
reproduced live against the real running services and let it run — still
going after 150+ seconds with no end in sight. Root-caused with temporary
`console.warn` tracing added to `callLlm`/`executeToolsOrAgents`/
`checkTaskStatus` (removed after, not left in): every single hop logged
`iter=0/10` — the shared `iterationCount`/`maxIterations` budget
(AC6/AC8, this spec) was never actually being spent by agent-to-agent
delegation itself, only by a single graph's own internal tool-call loop.
The real trace showed the CEO delegating to CTO *and* marketing, and each
of those, on being asked, delegating right back — including to whoever
had just asked them — instead of ever answering. Genuine unbounded
recursion across separate `AgentRegistry.invoke()` → `graph.invoke()`
calls, not a loop inside one graph.

**First fix attempt (kept only as a lesson in this file, not in the
code): spend one unit of the *existing* shared `iterationCount` budget
eagerly, before recursing.** Sounded right, and it does technically
terminate — but caught by a new regression test hanging past its own
120s timeout: every `iterationCount >= maxIterations` check in
`buildReasoningGraph.ts` only runs on the way *out* of a loop iteration
(a conditional edge after a node completes), never on the way in. A
bumped-past-the-cap count still let `callLlm` run once more and produce
yet another delegating tool call, which `executeToolsOrAgents` would
still dutifully execute before its own out-edge ever got a chance to
check anything — the number climbed, but nothing was actually stopping a
new recursive call from *starting*. Widened the check to run upfront in
`AgentRegistry.invoke` itself (the one place every hop passes through)
and it did terminate, but far too loosely reusing the general 10-round
budget: each retry within a calling agent's own budget could spawn a
whole fresh nested subtree, so total real LLM calls grew combinatorially
with depth, not linearly (125 calls in the regression test with a
generous depth allowance — bounded, but still minutes long against the
real API).

**Actual fix — two parts, both needed** (confirmed by the regression test
count dropping from 125 → 20 → passing only once both landed):

1. **`AgentRegistry`'s new `MAX_DELEGATION_DEPTH` (= 2)** — a *separate*,
   deliberately small, dedicated cap on delegation depth specifically,
   independent of the general `iterationCount`/`maxIterations` tool-call
   budget (which stays exactly as AC6 originally specified, and reverted
   to that once this landed). Checked upfront in `invoke()` before ever
   calling `graph.invoke()` again; returns
   `finalizeResponse.ts`'s existing `ITERATION_LIMIT_MESSAGE` (now
   exported, reused rather than duplicated) so the user sees one
   consistent "I hit a limit" message regardless of which loop shape
   caused it.
2. **`executeToolsOrAgents.ts` treats a maxed-out delegation as a
   `failed` tool result**, not an ordinary one — a delegated agent/team
   hitting the depth cap comes back as a normal (non-thrown) message, and
   without this, the *calling* agent's own retry budget kept spawning
   fresh, fully-depthed subtrees before ever noticing anything was wrong.
   Marking it `failed` engages the already-existing `isFailing` shrink
   (10→5 rounds, AC8) immediately instead of only after a second repeat
   is detected — this is what actually keeps the total call count small,
   not the depth cap alone.

New state field: `PipelineState.delegationDepth` (default 0, set once
per `invoke()` hop) — deliberately *not* reusing `iterationCount` for
this, see above for why that was tried and found insufficient.

**Verified live again after the fix**: the exact same real request
("podes preguntarle a los agentes de juancho como viene el negocio")
now completes in ~25 seconds instead of running unbounded — and lands on
a genuinely useful answer, not just a canned cutoff: ALMA correctly
explains both sub-agents kept hitting their limit, offers to retry with
narrower per-agent questions, and offers to check whether something's
actually misconfigured. Test session deleted afterward.

New/changed tests: `AgentRegistry.test.ts` — a new regression test
(two agents endlessly delegating back to whoever just asked them,
asserts termination and a real upper bound on LLM calls, not just "it
resolves"); AC6 and AC8's existing tests reverted to their original
`iterationCount: 9, maxIterations: 10` values (the eager-`iterationCount`
attempt had required moving them off the exact boundary — no longer
needed once the fix moved to the separate `delegationDepth` field, which
those two tests never touch). `services/orchestrator`: 148/148 passing,
`tsc` and `eslint` both clean (one new complexity warning introduced
along the way, in `executeOneToolCall`, fixed by extracting
`dispatchToolCall`/`hitDelegationLimit` helpers rather than suppressed).
