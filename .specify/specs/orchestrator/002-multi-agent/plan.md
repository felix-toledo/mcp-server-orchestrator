# Plan — Configurable agents + agent-to-agent invocation

Base: [`spec.md`](./spec.md), builds on
[`orchestrator/001-reasoning-pipeline`](../001-reasoning-pipeline/plan.md)'s
graph. Contracts below are signatures only.

## 1. `knowledge-store`

Standard CRUD shape, same as `KnowledgeEntryService`/`ChatSessionService`:
`AgentService` (`src/services/agentService.ts`) +
`agentsController.ts` + routes, `AgentInputSchema` in `schemas.ts`. Null-vs-
empty-array mapping (spec §5.1) lives in `AgentService`, not the controller
— Prisma's `String[]` column can't natively express "unset," so
`AgentService.create`/`update` translate an absent/`null` field in the
request body to a **sentinel** the graph-building side (`orchestrator`)
reads back as "no restriction": store `null` isn't possible for a
non-nullable `String[]` column, so instead: **`allowedTools` is nullable in
Prisma** (`String[]?` isn't valid Postgres array syntax either — Prisma
represents "no restriction" as the column being absent from a join table
instead). Simplify: use a **nullable JSON column**
(`allowedTools Json?`) storing `string[] | null` directly — avoids the
Prisma-array-nullability issue entirely and keeps the "null = unrestricted"
semantics exact.

```prisma
model Agent {
  id                   String   @id @default(cuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id])
  name                 String
  systemPromptAddendum String
  allowedTools         Json?    // string[] | null
  allowedSkills        Json?    // string[] | null
  pipelineSteps        Json?    // string[] | null (ordered Agent ids)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

```typescript
export class AgentService {
  constructor(private readonly prisma: PrismaClient, private readonly userService: UserService) {}
  create(input: AgentInput): Promise<Agent>;
  list(): Promise<Agent[]>;
  getById(id: string): Promise<Agent | null>;
  update(id: string, input: AgentInput): Promise<Agent>;
  delete(id: string): Promise<void>;
}
```

## 2. `orchestrator` — `AgentRegistry`

```typescript
// src/agents/AgentRegistry.ts
export interface AgentConfig {
  id: string;
  name: string;
  systemPromptAddendum: string;
  allowedTools: string[] | null;
  allowedSkills: string[] | null;
  pipelineSteps: string[] | null;
}

export class AgentRegistry {
  constructor(
    private readonly agents: AgentConfig[],
    private readonly baseGraphDeps: ReasoningGraphDeps, // from 001-reasoning-pipeline's buildReasoningGraph
  ) {}

  // Builds (and memoizes) a compiled subgraph per agent on first use —
  // a pipeline agent (pipelineSteps set) gets a fixed-sequence graph
  // instead of buildReasoningGraph's full LLM-driven one (spec AC5).
  private getOrBuildGraph(agentId: string): CompiledGraph<PipelineState>;

  // Handles visible to `fromAgentId`'s own LLM — every other configured
  // agent, named askAgent_<slug> (AC4). Excludes fromAgentId itself.
  toolHandlesFor(fromAgentId: string | null): LlmToolDefinition[];

  // Dispatch target for executeToolsOrAgents (001's node) — AC6: `state`
  // carries iterationCount/isFailing through unchanged, so the nested run
  // shares the parent's budget instead of starting a fresh one.
  invoke(agentId: string, state: PipelineState): Promise<LlmMessage>;
}
```

`buildPipelineAgentGraph` (new, `src/agents/buildPipelineAgentGraph.ts`) —
the AC5 fixed-sequence graph for `pipelineSteps`-configured agents: one node
per step, each calling `AgentRegistry.invoke(stepAgentId, ...)`, edges
`START → step1 → step2 → ... → END`, no conditional branching, no LLM call
of its own.

### 2.1 Wiring into `001-reasoning-pipeline`'s graph

`executeToolsOrAgents` (`001`'s node, extended here): before calling
`mcpManager.callTool`, check
`agentRegistry?.toolHandlesFor(currentAgentId).some(t => t.name === requestedToolName)`
— if matched, dispatch to `agentRegistry.invoke(...)` instead. This is the
only change to that node from what `001`'s plan already specced; everything
else about the tool-execution step is unchanged.

`callLlm` (`001`'s node): `tools` passed to `llmProvider.generateResponse`
becomes `[...mcpTools.filter(byAllowedTools(currentAgent)),
...agentRegistry.toolHandlesFor(currentAgentId)]` instead of just the raw
MCP tool list — AC1's `allowedTools` restriction and AC4's agent handles
both apply at this one call site.

## 3. Design patterns applied

- **Module Pattern**: `AgentRegistry` is the one place agent-to-agent
  wiring lives — nodes stay unaware of what "an agent" even is beyond
  calling `agentRegistry.invoke`.
- **Dependency Injection**: `AgentRegistry` takes its `AgentConfig[]` and
  base graph deps via constructor, built once per request (or cached with a
  short TTL/invalidated on `Agent` CRUD — a plan-level detail to confirm at
  implementation time, not a business rule).
- No Factory: `getOrBuildGraph`'s branching (pipeline vs full graph) is two
  concrete shapes, not an open-ended family — a `switch`/`if`, not a
  registered-factory pattern, per `docs/design-patterns.md`'s adoption
  guidance (no abstraction before a second real variant exists beyond these
  two).

## 4. Test strategy (Vitest)

| Target | Covers |
|---|---|
| `AgentService` (mocked `PrismaClient`) | AC1 CRUD, null-vs-`[]` round-trip |
| `agentsController` (supertest) | one test per endpoint/status |
| `AgentRegistry.toolHandlesFor` | excludes self (AC4), includes all others |
| `AgentRegistry.invoke` (mocked subgraphs) | AC6 — iteration state passed through unchanged across nested invoke |
| `buildPipelineAgentGraph` | AC5 — fixed sequence, each step's output feeds the next |
| `executeToolsOrAgents` (extended) | routes to `agentRegistry.invoke` vs `McpManager.callTool` correctly |

## 5. Build order (→ `tasks.md`)

1. `knowledge-store`: `Agent` schema + `AgentService` + controller/routes +
   tests.
2. `orchestrator`: `AgentConfig`/`AgentRegistry` skeleton +
   `toolHandlesFor` + tests.
3. `buildPipelineAgentGraph` + tests.
4. `AgentRegistry.invoke` (both graph shapes) + tests.
5. Extend `001-reasoning-pipeline`'s `executeToolsOrAgents`/`callLlm` nodes
   (§2.1) + tests.
6. `frontend/004-chat-shell` AC9's CRUD UI (separate spec's task list, but
   nothing there can land before this spec's endpoints exist).
7. Manual end-to-end: configure two agents, have one delegate to the other
   from a real chat message, confirm the A→B→A cycle terminates via AC6's
   shared budget instead of hanging.
