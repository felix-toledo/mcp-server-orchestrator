import { END, START, StateGraph } from '@langchain/langgraph';
import { pipelineStateAnnotation, type PipelineState, type PipelineStateUpdate } from '../graph/state.js';
import type { AgentRegistryLike } from '../graph/nodes/executeToolsOrAgents.js';

/**
 * AC5 — a pipeline agent's own graph: no LLM call of its own, just a fixed
 * sequence of `agentRegistry.invoke(stepAgentId, state)` calls. Each step's
 * response is appended to `messages` so the next step's sub-agent sees it
 * as conversation context, and becomes `finalResponse`; the last step's
 * response is what the pipeline agent itself returns.
 */
export function buildPipelineAgentGraph(pipelineSteps: string[], agentRegistry: AgentRegistryLike) {
  const graph = new StateGraph(pipelineStateAnnotation);

  let previous: string = START;
  pipelineSteps.forEach((stepAgentId, index) => {
    const nodeName = `step_${index}_${stepAgentId}`;
    graph.addNode(nodeName, async (state: PipelineState): Promise<PipelineStateUpdate> => {
      const response = await agentRegistry.invoke(stepAgentId, state);
      return { messages: [...state.messages, response], finalResponse: response };
    });
    graph.addEdge(previous as typeof START, nodeName as typeof END);
    previous = nodeName;
  });
  graph.addEdge(previous as typeof START, END);

  return graph.compile();
}
