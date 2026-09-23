import { END, START, StateGraph } from '@langchain/langgraph';
import type { ILlmProvider, LlmToolDefinition } from '../llm/ILlmProvider.js';
import type { McpManager } from '../mcp/McpManager.js';
import type { Reranker } from '../retrieval/Reranker.js';
import type { SkillManager, SkillSummary } from '../skills/SkillManager.js';
import type { SkillRouter } from '../skills/SkillRouter.js';
import { createCallLlmNode } from './nodes/callLlm.js';
import { checkSufficientInfo } from './nodes/checkSufficientInfo.js';
import { checkTaskStatus } from './nodes/checkTaskStatus.js';
import { createCompressNode } from './nodes/compress.js';
import { createExecuteToolsOrAgentsNode, type AgentRegistryLike } from './nodes/executeToolsOrAgents.js';
import { createFetchProfileNoteNode } from './nodes/fetchProfileNote.js';
import { createFetchRagTop20Node } from './nodes/fetchRagTop20.js';
import { finalizeResponse } from './nodes/finalizeResponse.js';
import type { KnowledgeStoreClient } from '../knowledge/knowledgeStoreClient.js';
import { createMakePlanNode } from './nodes/makePlan.js';
import { createRerankNode } from './nodes/rerank.js';
import { createRunSkillRouterNode } from './nodes/runSkillRouter.js';
import { pipelineStateAnnotation, type PipelineState } from './state.js';

export interface ReasoningGraphDeps {
  mcpManager: McpManager;
  llmProvider: ILlmProvider;
  smallLlmProvider: ILlmProvider;
  skillRouter: SkillRouter;
  reranker: Reranker;
  skillManager: SkillManager;
  tools: LlmToolDefinition[];
  /** 2026-09-18 addendum — source for the always-on `fetchProfileNote` node. */
  knowledgeStoreClient: Pick<KnowledgeStoreClient, 'getProfileNote'>;
  agentRegistry?: AgentRegistryLike;
  /** orchestrator/002-multi-agent AC3 — appended to BASE_SYSTEM_INSTRUCTIONS for an agent-scoped subgraph. Root graph omits it. */
  systemPromptAddendum?: string;
  /** orchestrator/002-multi-agent AC1 — an agent's allowedSkills restriction; defaults to every skill (skillManager.list()) for the root graph. */
  availableSkills?: SkillSummary[];
}

function hasPendingToolCalls(state: PipelineState): boolean {
  const last = state.messages[state.messages.length - 1];
  return (last?.toolCalls?.length ?? 0) > 0;
}

/**
 * No-op — exists only so the runSkillRouter branch is the same number of
 * hops from START as the fetchRagTop20 → rerank branch (both 2) before they
 * both reach checkSufficientInfo. Found live (2026-09-17): with unequal
 * depths (runSkillRouter was 1 hop, fetchRagTop20 → rerank was 2),
 * LangGraph doesn't wait for both — a node runs once per predecessor that
 * completes, in whatever superstep that predecessor finishes in, not once
 * after every predecessor is done. checkSufficientInfo (and everything
 * downstream of it, including callLlm) ran twice: once as soon as
 * runSkillRouter finished, with rerankedTop5 still empty, and again once
 * rerank actually finished. Equal-depth branches make both land in the
 * same superstep, which is what actually makes this fan-in behave like a
 * join instead of two independent triggers.
 */
function noop(): Record<string, never> {
  return {};
}

/** orchestrator/001-reasoning-pipeline §6 — see that spec for the graph diagram. */
export function buildReasoningGraph(deps: ReasoningGraphDeps) {
  const graph = new StateGraph(pipelineStateAnnotation)
    .addNode('fetchRagTop20', createFetchRagTop20Node({ mcpManager: deps.mcpManager }))
    .addNode(
      'runSkillRouter',
      createRunSkillRouterNode({ skillRouter: deps.skillRouter, availableSkills: deps.availableSkills ?? deps.skillManager.list() }),
    )
    .addNode('fetchProfileNote', createFetchProfileNoteNode({ knowledgeStoreClient: deps.knowledgeStoreClient }))
    .addNode('rerank', createRerankNode({ reranker: deps.reranker }))
    .addNode('checkSufficientInfo', checkSufficientInfo)
    .addNode('makePlan', createMakePlanNode({ llmProvider: deps.llmProvider }))
    .addNode(
      'callLlm',
      createCallLlmNode({
        llmProvider: deps.llmProvider,
        tools: deps.tools,
        skillManager: deps.skillManager,
        systemPromptAddendum: deps.systemPromptAddendum,
      }),
    )
    .addNode('executeToolsOrAgents', createExecuteToolsOrAgentsNode({ mcpManager: deps.mcpManager, agentRegistry: deps.agentRegistry }))
    .addNode('checkTaskStatus', checkTaskStatus)
    .addNode('compress', createCompressNode({ smallLlmProvider: deps.smallLlmProvider }))
    .addNode('finalizeResponse', finalizeResponse)
    .addNode('awaitSkillRouter', noop)
    .addNode('awaitProfileNote', noop)
    // Parallel fan-out (AC2, extended by the 2026-09-18 profile-note
    // addendum): all three branches feed into checkSufficientInfo at equal
    // depth (2 hops from START) so LangGraph runs it once every
    // predecessor has completed in the same superstep — see `noop`'s
    // comment for the bug this fixes.
    .addEdge(START, 'fetchRagTop20')
    .addEdge(START, 'runSkillRouter')
    .addEdge(START, 'fetchProfileNote')
    .addEdge('fetchRagTop20', 'rerank')
    .addEdge('rerank', 'checkSufficientInfo')
    .addEdge('runSkillRouter', 'awaitSkillRouter')
    .addEdge('awaitSkillRouter', 'checkSufficientInfo')
    .addEdge('fetchProfileNote', 'awaitProfileNote')
    .addEdge('awaitProfileNote', 'checkSufficientInfo')
    // Complexity branch (AC5)
    .addConditionalEdges('checkSufficientInfo', (state) => (state.isComplex ? 'makePlan' : 'callLlm'), [
      'makePlan',
      'callLlm',
    ])
    .addEdge('makePlan', 'callLlm')
    // Tool/agent loop (AC7/AC8)
    .addConditionalEdges('callLlm', (state) => (hasPendingToolCalls(state) ? 'executeToolsOrAgents' : 'checkTaskStatus'), [
      'executeToolsOrAgents',
      'checkTaskStatus',
    ])
    .addConditionalEdges(
      'executeToolsOrAgents',
      (state) => (state.iterationCount >= state.maxIterations ? 'finalizeResponse' : 'callLlm'),
      ['finalizeResponse', 'callLlm'],
    )
    // Complex-task compressor loop (AC9). 2026-09-18 real bug fix: also
    // gated on the shared iteration budget — see checkTaskStatus.ts's own
    // doc comment for the live-reproduced infinite loop this closes
    // (a model repeatedly marking itself IN_PROGRESS without ever making
    // an actual tool call had nothing to stop it before this).
    .addConditionalEdges(
      'checkTaskStatus',
      (state) => (state.taskStatus === 'IN_PROGRESS' && state.iterationCount < state.maxIterations ? 'compress' : 'finalizeResponse'),
      ['compress', 'finalizeResponse'],
    )
    .addEdge('compress', 'callLlm')
    .addEdge('finalizeResponse', END);

  return graph.compile();
}
