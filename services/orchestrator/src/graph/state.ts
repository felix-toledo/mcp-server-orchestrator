import { Annotation } from '@langchain/langgraph';
import type { LlmMessage } from '../llm/ILlmProvider.js';
import type { SearchKnowledgeEntriesResult } from '../mcp/searchKnowledgeEntriesResult.js';
import type { RerankedResult } from '../retrieval/Reranker.js';

export type TaskStatus = 'IN_PROGRESS' | 'DONE';

/** Every node returns the full new value for whatever field(s) it touches — plain overwrite, never a delta. */
function overwrite<T>(defaultValue: () => T) {
  return { reducer: (_left: T, right: T) => right, default: defaultValue };
}

/**
 * Graph state for orchestrator/001-reasoning-pipeline (spec §6.1). Every
 * field gets an explicit default so a node reading it before another node
 * has written to it gets a safe empty/falsy value instead of a LangGraph
 * "channel never updated" error.
 */
export const pipelineStateAnnotation = Annotation.Root({
  messages: Annotation<LlmMessage[]>(overwrite<LlmMessage[]>(() => [])),
  ragTop20: Annotation<SearchKnowledgeEntriesResult[]>(overwrite<SearchKnowledgeEntriesResult[]>(() => [])),
  rerankedTop5: Annotation<RerankedResult[]>(overwrite<RerankedResult[]>(() => [])),
  /**
   * 2026-09-18 addendum — always fetched by path, never by similarity
   * search (see knowledge-store/002-retrieval's tasks.md addendum): a
   * broad query like "¿qué sabés de mí?" can't be trusted to retrieve it
   * through either the embedding search or the cross-encoder reranker,
   * verified live. `null` means no profile note exists yet.
   */
  profileNote: Annotation<string | null>(overwrite<string | null>(() => null)),
  hasSufficientInfo: Annotation<boolean>(overwrite<boolean>(() => false)),
  skillsToUse: Annotation<string[]>(overwrite<string[]>(() => [])),
  isComplex: Annotation<boolean>(overwrite<boolean>(() => false)),
  plan: Annotation<string | undefined>(overwrite<string | undefined>(() => undefined)),
  iterationCount: Annotation<number>(overwrite<number>(() => 0)),
  isFailing: Annotation<boolean>(overwrite<boolean>(() => false)),
  maxIterations: Annotation<number>(overwrite<number>(() => 10)),
  lastToolCallSignature: Annotation<string | undefined>(overwrite<string | undefined>(() => undefined)),
  taskStatus: Annotation<TaskStatus | undefined>(overwrite<TaskStatus | undefined>(() => undefined)),
  finalResponse: Annotation<LlmMessage | undefined>(overwrite<LlmMessage | undefined>(() => undefined)),
  /**
   * orchestrator/003-teams — set once by `AgentRegistry.invokeTeam` on the
   * state handed to the team's coordinator, then flows through unchanged
   * as an ordinary state field. `AgentRegistry.invoke` reads it back to
   * decide whether a teammate delegation (`askAgent_` triggered from
   * inside a team) should also build a team-scoped graph instead of a
   * solo one — without this, member-to-member delegation inside a team
   * would silently lose the team's scoping (AC3/AC4/AC6) one hop in.
   */
  currentTeamId: Annotation<string | undefined>(overwrite<string | undefined>(() => undefined)),
  /**
   * 2026-09-18 web live-typing addendum — set once at the initial invoke
   * (mirrors `currentTeamId`'s pattern: per-invocation data threaded
   * through state, not a `ReasoningGraphDeps` closure value, since a
   * delegated agent's compiled subgraph is built once and reused across
   * many requests — see `AgentRegistry`'s `this.graphs` cache). Lets
   * `callLlm.ts` know which `inquireStatusStore` entry to stream tokens
   * into. `undefined` (no live-status tracking for this call, e.g. a test
   * invoking the graph directly) just means `callLlm` falls back to the
   * non-streaming `generateResponse`.
   */
  requestId: Annotation<string | undefined>(overwrite<string | undefined>(() => undefined)),
  /**
   * 2026-09-18 — real bug found live: two agents in the same team, each
   * asked something, kept delegating straight back to whoever just asked
   * them ("le pregunto a los dos", including the one already asking) —
   * genuine unbounded recursion across separate `graph.invoke()` calls,
   * confirmed running 150+ seconds with no end in sight. Reusing
   * `iterationCount`/`maxIterations` (a single agent's own tool-call
   * budget, already up to 10) as the guard was tried first and technically
   * works, but far too loose: each retry within a calling agent's own
   * budget can spawn a fresh nested subtree, so total real LLM calls grew
   * combinatorially, not linearly, with depth — bounded, but still
   * minutes-long in practice. A separate, deliberately small, dedicated
   * cap on delegation *depth* (not width, not the general tool budget)
   * is what actually keeps this fast: `AgentRegistry.invoke` is the one
   * place every hop passes through, checked and incremented there only.
   */
  delegationDepth: Annotation<number>(overwrite<number>(() => 0)),
});

export type PipelineState = typeof pipelineStateAnnotation.State;
export type PipelineStateUpdate = typeof pipelineStateAnnotation.Update;
