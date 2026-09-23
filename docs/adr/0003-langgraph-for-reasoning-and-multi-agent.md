# Adopt LangGraph as the orchestrator's reasoning/multi-agent engine

**Status**: accepted

## Context

`services/orchestrator`'s conversation loop
(`Orchestrator.processConversation`) is a hand-rolled `while` loop today:
build a system message → call the LLM → if it requested tools, run them via
`McpManager` and loop, up to `maxIterations` → return the final answer.
`002-retrieval` already bolted one pre-LLM step onto it (automatic vault
search). The next round of work asks for a lot more structure on top of
that same loop:

- A **RAG top-20 search** and a **SkillRouter** (a small/fast model call
  that decides which skill(s) apply *and* whether the task is complex) run
  **in parallel**, not sequentially.
- The RAG top-20 feeds a **reranker** (Transformers.js, local, top-20 → top-5)
  whose output the SkillRouter's "do we have enough information" branch
  depends on.
- A **complexity branch**: simple tasks go straight to an LLM call; complex
  ones get an LLM-authored plan first, *then* execute.
- The existing MCP tool-call loop stays, but with a **failing-vs-succeeding
  iteration budget** (10 vs 5) instead of one flat `maxIterations`.
- A **compressor** (another small/fast model call) that, mid-loop, replaces
  the growing conversation transcript with a summary so a long complex task
  doesn't have to resend its full history every iteration (spec 002 of this
  round scoped this to a single request, not persisted — see
  `knowledge-store/003-chat-sessions`'s sibling specs for why).
- **Multiple configurable agents that can invoke each other** — real
  multi-agent, not just one LLM with tools (`orchestrator/002-multi-agent`).

This is a graph with conditional branches, parallel branches, and a cycle
(the MCP loop, and now agent-to-agent calls) — not a straight line anymore.
`docs/context-extended.md` §4 already names the intended engine for exactly
this shape: **LangGraph**, with an orchestrator-worker pattern.

## Decision

Adopt **LangGraph.js** (`@langchain/langgraph`) as `services/orchestrator`'s
execution engine, replacing the hand-rolled loop in
`Orchestrator.processConversation`. The pipeline in
`orchestrator/001-reasoning-pipeline` is modeled as a `StateGraph`: nodes
for RAG search, the reranker, the SkillRouter, the complexity branch, the
LLM call/plan step, the MCP tool loop, and the compressor, wired with
LangGraph's conditional edges for the branches this spec describes.
`orchestrator/002-multi-agent` builds each configurable agent as its own
compiled subgraph, invoked as a node from a parent agent's graph — LangGraph
supports this natively (a compiled graph can be used as a node in another),
which is what makes real agent-to-agent invocation and "pipelines" (an
agent preconfigured to always call others in sequence) possible without a
second bespoke orchestration layer next to the first one.

## Alternatives considered

- **Keep extending the hand-rolled loop** (add parallel branches, a
  reranker step, a complexity `if`, a second iteration counter, and
  agent-to-agent calls modeled as more MCP tools, by hand). Rejected: every
  new branch/parallel step from here on makes `processConversation` bigger
  and harder to reason about — it already carries a pre-existing
  cyclomatic-complexity lint warning (18, `002-retrieval`'s
  `tasks.md`) before any of this. Multi-agent specifically is the point
  where "just add more `if`s" stops being tractable: agent A calling agent
  B, which calls agent A back or calls agent C, is a graph problem, not a
  linear one.
- **A different graph/workflow library** (e.g. a hand-rolled tiny FSM, or a
  different agent framework). Rejected: `docs/context-extended.md` §4 names
  LangGraph specifically as part of ALMA's own PFG design, confirmed
  2026-09-18 as authoritative context — there's no reason to pick a
  different engine than the one already decided in that document.

## Consequences

- **This is close to a full rewrite of `Orchestrator.ts`**, not an
  incremental change — `processConversation`'s `while` loop, the manual
  `extraInstructions` string-concatenation, and `McpManager.callTool`'s
  direct calls all get restructured as graph nodes/state. `002-retrieval`'s
  behavior (AC1–AC8) is a **required regression target**: the new graph
  must still search automatically every turn, still hide the retrieval step
  from the LLM's visible tools, still stay silent about saving/searching —
  `orchestrator/001-reasoning-pipeline`'s spec restates these as its own
  Acceptance Criteria so they're not silently lost in the rewrite.
- New dependency: `@langchain/langgraph` (+ `@langchain/core`). New concept
  in the codebase (`StateGraph`, nodes, conditional edges) with its own
  learning curve — worth budgeting real time for in `tasks.md`, not treating
  as a drop-in.
- `Transformers.js` becomes a second new dependency (the reranker,
  `orchestrator/001-reasoning-pipeline`) — an in-process, local model, no
  new external API/infra, consistent with ALMA's self-hosted pitch for that
  one piece even though the main LLM and the SkillRouter/compressor's
  "small model" both stay API-based this round (a deliberate, separately
  confirmed trade-off — see that spec's Defaults & Assumptions).
- `services/mcp-server`'s existing tools (`createKnowledgeEntry`,
  `searchKnowledgeEntries`) don't change shape — LangGraph's tool-calling
  nodes still go through the same `McpManager`/`McpClient` MCP client code,
  just invoked from graph nodes instead of a `while` loop body.
