# Plan — Reasoning pipeline (LangGraph)

Base: [`spec.md`](./spec.md), [ADR-0003](../../../../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md).
Contracts below are signatures only.

## 1. File layout (`services/orchestrator/src/`)

```
graph/
├── state.ts                 # PipelineState (spec §6.1)
├── buildReasoningGraph.ts    # assembles the StateGraph, exported factory
└── nodes/
    ├── fetchRagTop20.ts
    ├── runSkillRouter.ts
    ├── rerank.ts
    ├── checkSufficientInfo.ts
    ├── makePlan.ts
    ├── callLlm.ts
    ├── executeToolsOrAgents.ts   # AC7 — dispatches McpManager vs sub-agent
    ├── checkTaskStatus.ts        # AC9
    └── compress.ts
skills/
└── SkillRouter.ts             # spec §6.2
retrieval/
└── Reranker.ts                 # spec §6.2, TransformersJsReranker implementation
llm/
└── SmallLlmProvider.ts         # thin wrapper choosing the small-model ILlmProvider instance
```

`Orchestrator.ts` (existing) is retired — `buildReasoningGraph` +
`graph.invoke(initialState)` become the new entry point `inquireController`
calls. `McpManager`/`McpClient` (existing) are reused as-is inside
`executeToolsOrAgents.ts`, not rewritten — LangGraph changes *how nodes are
sequenced*, not the MCP transport underneath them.

## 2. Node contracts

```typescript
// nodes/fetchRagTop20.ts
export async function fetchRagTop20(state: PipelineState, deps: { mcpManager: McpManager }): Promise<Partial<PipelineState>>;
// calls mcpManager.callTool('searchKnowledgeEntries', { query: lastUserMessage, limit: 20 })

// nodes/runSkillRouter.ts
export async function runSkillRouter(state: PipelineState, deps: { skillRouter: SkillRouter }): Promise<Partial<PipelineState>>;

// nodes/rerank.ts
export async function rerank(state: PipelineState, deps: { reranker: Reranker }): Promise<Partial<PipelineState>>;
// only runs once ragTop20 is populated — LangGraph edge ordering enforces this, not an in-node wait

// nodes/checkSufficientInfo.ts — pure, no deps
export function checkSufficientInfo(state: PipelineState): Partial<PipelineState>; // AC4

// nodes/makePlan.ts
export async function makePlan(state: PipelineState, deps: { llmProvider: ILlmProvider }): Promise<Partial<PipelineState>>; // AC5, complex only

// nodes/callLlm.ts
export async function callLlm(state: PipelineState, deps: { llmProvider: ILlmProvider; tools: LlmToolDefinition[] }): Promise<Partial<PipelineState>>;
// builds systemContent per spec AC6 (explicit "nothing found" when !hasSufficientInfo), includes state.plan if present

// nodes/executeToolsOrAgents.ts
export async function executeToolsOrAgents(
  state: PipelineState,
  deps: { mcpManager: McpManager; agentRegistry?: AgentRegistry }, // agentRegistry from 002-multi-agent, optional until that spec lands
): Promise<Partial<PipelineState>>;
// AC7/AC8: routes each requested tool call to mcpManager.callTool or agentRegistry.invoke
// based on whether the name matches a registered agent handle; updates iterationCount/isFailing

// nodes/checkTaskStatus.ts — pure
export function checkTaskStatus(state: PipelineState): Partial<PipelineState>; // AC9

// nodes/compress.ts
export async function compress(state: PipelineState, deps: { smallLlmProvider: ILlmProvider }): Promise<Partial<PipelineState>>;
// replaces state.messages with [system, summary-as-assistant-note, ...last 2 real messages] — AC9
```

## 3. Graph assembly (`buildReasoningGraph.ts`)

```typescript
export function buildReasoningGraph(deps: {
  mcpManager: McpManager;
  llmProvider: ILlmProvider;
  smallLlmProvider: ILlmProvider;
  skillRouter: SkillRouter;
  reranker: Reranker;
  agentRegistry?: AgentRegistry;
}): CompiledGraph<PipelineState>;
```

Edges (LangGraph `StateGraph` API — `addNode`, `addEdge`,
`addConditionalEdges`):

- `START` → `fetchRagTop20` **and** `START` → `runSkillRouter` (parallel —
  LangGraph fans out automatically when two nodes both have `START` as
  their only predecessor and no edge between them).
- `fetchRagTop20` → `rerank` → `checkSufficientInfo`.
- `runSkillRouter` and `checkSufficientInfo` both → a join point
  (`complexityBranch`, conditional edge on `state.isComplex`) → `makePlan`
  (if complex) or straight to `callLlm` (if not); `makePlan` → `callLlm`.
- `callLlm` → conditional edge on "did the response request a tool/agent
  call": → `executeToolsOrAgents` (yes) or → `checkTaskStatus` (no).
- `executeToolsOrAgents` → conditional edge on `iterationCount >=
  maxIterations`: → `finalizeResponse` (limit hit, AC8's graceful message)
  or → `callLlm` (loop, AC7).
- `checkTaskStatus` → conditional edge on `taskStatus`: → `compress` →
  `callLlm` (still in progress, AC9) or → `finalizeResponse` (done).
- `finalizeResponse` → `END`.

## 4. `inquireController` integration

Replaces today's `globalOrchestrator.processConversation(...)` call with:

```typescript
const graph = buildReasoningGraph({ mcpManager, llmProvider, smallLlmProvider, skillRouter, reranker, agentRegistry });
const result = await graph.invoke({ messages: conversationMessages, iterationCount: 0, isFailing: false, maxIterations: 10 });
// result.finalResponse is what today's response.content was
```

`knowledge-store/003-chat-sessions`'s session persistence (that spec's
plan §3.1) wraps this call the same way it wraps today's
`processConversation` — unaffected by this spec's internals.

## 5. Design patterns applied

- **Strategy**: `Reranker` (Transformers.js today, swappable later — same
  reasoning `001-vectorization` used for `EmbeddingsProvider`), `SkillRouter`
  (one implementation now, interface first because a second — a cheaper
  heuristic-only router — is plausible future work, unlike speculative
  Strategy uses `docs/design-patterns.md` warns against).
- **Dependency Injection**: every node takes its collaborators via `deps`,
  never constructs them — `buildReasoningGraph`'s caller (`index.ts`) is the
  one composition root, same discipline as every other service.
- LangGraph's `StateGraph` itself *is* this spec's Module/pipeline pattern
  — no additional custom pipeline abstraction on top of it.

## 6. Test strategy (Vitest)

| Target | Covers |
|---|---|
| Each node function, in isolation (mocked `deps`) | AC2–AC9, one test file per node |
| `buildReasoningGraph` (mocked node deps, real LangGraph wiring) | end-to-end shape: parallel fan-out actually happens, conditional edges route correctly for complex/simple, info-found/not-found, failing/not-failing |
| `TransformersJsReranker` | real model, small fixed input set — pin expected relative ordering, not exact scores (a model detail, exact float values are brittle) |
| `SkillRouter`'s default implementation | mocked small-model `ILlmProvider`, parses its structured output correctly |

## 7. Build order (→ `tasks.md`)

1. `knowledge-store`: raise `search`'s `limit` cap to 20 (spec §5).
2. `PipelineState` + pure nodes (`checkSufficientInfo`, `checkTaskStatus`).
3. `SkillRouter` + `SmallLlmProvider` + tests.
4. `Reranker` (Transformers.js) + tests.
5. Remaining nodes (`fetchRagTop20`, `rerank`, `makePlan`, `callLlm`,
   `executeToolsOrAgents`, `compress`) + tests.
6. `buildReasoningGraph` wiring + integration tests.
7. `inquireController` cutover from `Orchestrator.processConversation` to
   the graph; delete `Orchestrator.ts`/`Orchestrator.test.ts` once the graph
   demonstrably covers everything they tested (AC1's carried-over behavior
   especially).
8. Manual end-to-end regression pass against `002-retrieval`'s existing
   verified scenarios (Firulais example, etc.) — this spec must not
   regress what already worked.
