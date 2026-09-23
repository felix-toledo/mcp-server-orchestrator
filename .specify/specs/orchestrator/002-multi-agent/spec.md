# Spec — Configurable agents + agent-to-agent invocation

| | |
|---|---|
| **Status** | Draft — Open Questions resolved 2026-09-17 (see §8) |
| **Group** | backend (`services/orchestrator` graph extension, `services/knowledge-store` owns `Agent` config) |
| **Depends on** | [`orchestrator/001-reasoning-pipeline`](../001-reasoning-pipeline/spec.md) (agents run as nodes inside that same graph — see its §4), [ADR-0003](../../../../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md) |
| **Depended on by** | [`frontend/004-chat-shell`](../../frontend/004-chat-shell/spec.md) AC9 (Agentes y Skills tab) |
| **Constitution clauses in play** | I, III (Vitest), IV, V (dormant) |

## 1. Goal

Today there is exactly one implicit "agent": whatever `systemInstructions`
+ every MCP tool + every skill adds up to. This spec makes that
configurable — named `Agent` presets (a prompt addendum + a restricted set
of tools/skills) the user can create/edit from the **Agentes y Skills** tab
— and lets agents **genuinely invoke each other**, not just exist side by
side, built as LangGraph subgraphs per
[ADR-0003](../../../../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md).

## 2. User Story & Acceptance Criteria

**As the user**, I configure named agents (a persona/tool-set preset), and
I can have one agent delegate part of a task to another — a "pipeline" is
just an agent preconfigured to always call others in a fixed order.

- **AC1**: `Agent` CRUD — `{ id, name, systemPromptAddendum, allowedTools:
  string[] | null, allowedSkills: string[] | null, pipelineSteps: string[]
  | null }`. `null` for `allowedTools`/`allowedSkills` means "inherit
  everything available" (no restriction) — an empty array `[]` means "none"
  — this spec's own default, not directly confirmed word-for-word in the
  interview; see §5.1 for the reasoning and correct it there if wrong.
- **AC2**: With zero `Agent` rows configured, behavior is **exactly**
  `orchestrator/001-reasoning-pipeline`'s spec as written — the single
  implicit graph, full tool/skill access, base `systemInstructions` only.
  Introducing this spec must not change existing behavior for a user who
  never opens the Agentes y Skills tab.
- **AC3**: An `Agent`'s `systemPromptAddendum` is **appended** to ALMA's
  base `systemInstructions`, never a replacement — confirmed 2026-09-17
  (`docs/context.md`'s "Agents add to ALMA's base behavior" decision). No
  agent configuration can disable the "don't narrate saving/searching,"
  "don't invent when ungrounded" rules.
- **AC4**: Every **other** configured `Agent` (not the one currently
  running) is exposed to the running agent's LLM as a callable handle named
  `askAgent_<slug(name)>` — same shape as an MCP tool in the tools list the
  LLM sees, dispatched by `orchestrator/001-reasoning-pipeline`'s
  `executeToolsOrAgents` node (that spec §4) to `graph.invoke(...)` on the
  target agent's own compiled subgraph instead of `McpManager.callTool`. An
  agent is **never** offered a handle to call itself (no self-recursion by
  default — avoids the most trivial infinite loop).
- **AC5**: **Pipeline agents**: if `pipelineSteps` is non-null, that
  `Agent`'s own graph is **not** an LLM-driven tool-calling loop — it's a
  fixed sequence: invoke each listed agent's subgraph in order, each one's
  final response becomes part of the next step's input context, and the
  last step's response is the pipeline agent's own response. No LLM call of
  its own beyond what each step's agent already makes internally.
- **AC6**: **Shared iteration budget** — a nested agent invocation
  (AC4/AC5) does **not** get a fresh iteration counter. It shares
  `orchestrator/001-reasoning-pipeline` AC8's counter/budget with the
  top-level run that started it, so an A-calls-B-calls-A cycle still hits
  that same 10-or-5 cap and terminates gracefully instead of recursing
  forever.
- **AC7**: The **Agentes y Skills** tab
  (`frontend/004-chat-shell` AC9) does full CRUD against this spec's
  endpoints — list/create/edit/delete `Agent`s, and a way to pick which
  agent handles a given chat session (§7.2).

## 3. Where this plugs into the graph

`orchestrator/001-reasoning-pipeline`'s `buildReasoningGraph` (that spec's
plan §3) takes an optional `agentRegistry`. This spec is what actually
builds and populates one:

```
AgentRegistry
├── list of compiled subgraphs, one per configured Agent
│     (each built by calling buildReasoningGraph again, scoped to that
│      agent's allowedTools/allowedSkills/systemPromptAddendum — AC1/AC3)
└── invoke(agentId, context) → runs that subgraph, returns its finalResponse
```

`executeToolsOrAgents` (001's node) checks whether a requested "tool" name
matches `askAgent_<slug>` before falling back to `McpManager.callTool` —
this is the entire mechanism, no separate multi-agent execution loop.

## 4. `knowledge-store` — `Agent` CRUD

| Method & path | Body | Returns |
|---|---|---|
| `POST /agents` | `{ name, systemPromptAddendum, allowedTools?, allowedSkills?, pipelineSteps? }` | `201 Agent` |
| `GET /agents` | — | `200 Agent[]` |
| `GET /agents/:id` | — | `200 Agent` or `404` |
| `PUT /agents/:id` | same shape as create | `200 Agent` |
| `DELETE /agents/:id` | — | `204` |

```prisma
model Agent {
  id                   String   @id @default(cuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id])
  name                 String
  systemPromptAddendum String
  allowedTools         Json?    // string[] | null — see plan.md §1 for why Json, not a native array column
  allowedSkills        Json?    // string[] | null
  pipelineSteps        Json?    // string[] | null, ordered Agent ids
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

## 5. Defaults & Assumptions (mark any correction inline)

1. **`null`/unset = inherit everything, `[]` = nothing**, confirmed via a
   quick sanity check during this round (not a full grill round) —
   reasoning: the most common use case is "an agent that's just a
   persona/prompt variant" (e.g. "sé más formal"), which shouldn't require
   re-listing every tool by hand to keep working; a deliberately restricted
   agent is the less common, more deliberate case, so it should require the
   deliberate empty/partial list instead. Flagging this explicitly since
   it's a real usability default, not something confirmed word-for-word in
   the interview.
2. **Which agent handles a given chat session**: a `ChatSession` gains an
   optional `agentId` (nullable — `null` means the implicit default agent,
   AC2). Set once, at session creation, from the frontend's session-create
   call (`frontend/004-chat-shell`'s "nuevo chat" — picking an agent, if
   any, happens there, not mid-conversation). Not re-confirmed with Felix
   directly this round — flagged for correction same as #1.
3. **No agent template library / natural-language agent creation this
   round** — `context-extended.md` §7 mentions both; this spec only builds
   the config-CRUD + invocation mechanism. Creating one via chat ("creá un
   agente que...") is plausible future work once `Agent` CRUD exists, not
   built here.

## 6. Out of Scope — Future Work

- Natural-language agent creation ("creá un agente que haga tal cosa").
- Agent template library.
- The 10-agent soft cap `context-extended.md` §7 mentions — not enforced
  this round (nothing stops creating an 11th `Agent` today).
- Self-recursion (an agent explicitly allowed to call itself, e.g. for a
  recursive-refinement pattern) — AC4 forbids it outright for now.

## 7. Open Questions — resolved 2026-09-17

- **OQ1 — Preset-only vs real multi-agent this round?** → **Both** —
  confirmed directly: build the `Agent` preset config *and* real
  agent-to-agent invocation in this same round, not staged across two.
- **OQ2 — Invocation mechanism**: LangGraph subgraphs, not MCP tools — see
  [ADR-0003](../../../../docs/adr/0003-langgraph-for-reasoning-and-multi-agent.md).
- **OQ3 — Does an agent's prompt replace or extend the base?** → **Extends,
  always** (AC3).
