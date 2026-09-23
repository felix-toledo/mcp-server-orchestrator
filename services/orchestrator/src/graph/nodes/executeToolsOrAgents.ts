import type { LlmMessage, ToolCall } from '../../llm/ILlmProvider.js';
import type { McpManager } from '../../mcp/McpManager.js';
import { ITERATION_LIMIT_MESSAGE } from './finalizeResponse.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

export interface AgentRegistryLike {
  isAgentHandle: (name: string) => boolean;
  invoke: (name: string, state: PipelineState) => Promise<LlmMessage>;
  // orchestrator/003-teams — optional so existing fakes/tests built against
  // just isAgentHandle/invoke (before teams existed) still satisfy this type.
  isTeamHandle?: (name: string) => boolean;
  invokeTeam?: (name: string, state: PipelineState) => Promise<LlmMessage>;
}

async function dispatchToolCall(
  toolCall: ToolCall,
  state: PipelineState,
  deps: { mcpManager: McpManager; agentRegistry?: AgentRegistryLike },
): Promise<{ result: unknown; isDelegation: boolean }> {
  if (deps.agentRegistry?.isAgentHandle(toolCall.name)) {
    return { result: await deps.agentRegistry.invoke(toolCall.name, state), isDelegation: true };
  }
  if (deps.agentRegistry?.isTeamHandle?.(toolCall.name)) {
    return { result: await deps.agentRegistry.invokeTeam!(toolCall.name, state), isDelegation: true };
  }
  return { result: await deps.mcpManager.callTool(toolCall.name, JSON.parse(toolCall.arguments)), isDelegation: false };
}

/**
 * 2026-09-18 — a delegated agent/team hitting `AgentRegistry.invoke`'s own
 * `MAX_DELEGATION_DEPTH` cap comes back as a normal (non-thrown) result,
 * not an error — but letting the caller's own loop treat that as "a fine
 * tool result, maybe try again" is exactly what let the real
 * runaway-delegation bug rack up 100+ real LLM calls even with the depth
 * cap in place (each level's own retry budget kept spawning fresh
 * subtrees before ever checking the depth signal). Treating it as
 * `failed` engages the existing `isFailing` shrink (10→5 rounds)
 * immediately instead of only after a second repeat is seen.
 */
function hitDelegationLimit(isDelegation: boolean, result: unknown): boolean {
  return isDelegation && typeof result === 'object' && result !== null && (result as { content?: unknown }).content === ITERATION_LIMIT_MESSAGE;
}

async function executeOneToolCall(
  toolCall: ToolCall,
  state: PipelineState,
  deps: { mcpManager: McpManager; agentRegistry?: AgentRegistryLike },
): Promise<{ message: LlmMessage; failed: boolean }> {
  try {
    const { result, isDelegation } = await dispatchToolCall(toolCall, state, deps);
    return {
      failed: hitDelegationLimit(isDelegation, result),
      message: { role: 'tool', toolCallId: toolCall.id, name: toolCall.name, content: JSON.stringify(result) },
    };
  } catch (error) {
    return {
      failed: true,
      message: {
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolCall.name,
        content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      },
    };
  }
}

/**
 * AC7/AC8 — executes every tool call the LLM's last response requested,
 * appends the results, and updates the iteration budget's failing signal.
 * `agentRegistry` is the orchestrator/002-multi-agent extension point (plan
 * §2.1 there) — dispatches to a sub-agent's own graph instead of MCP when
 * the requested name is a registered agent handle; `undefined` until that
 * spec exists, in which case every call goes through `McpManager`.
 */
export function createExecuteToolsOrAgentsNode(deps: { mcpManager: McpManager; agentRegistry?: AgentRegistryLike }) {
  return async (state: PipelineState): Promise<PipelineStateUpdate> => {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = lastMessage?.toolCalls ?? [];
    if (toolCalls.length === 0) {
      return {};
    }

    const messages = [...state.messages];
    let isFailing = false;
    let lastToolCallSignature = state.lastToolCallSignature;

    for (const toolCall of toolCalls) {
      const signature = `${toolCall.name}:${toolCall.arguments}`;
      const isRepeat = signature === state.lastToolCallSignature; // AC8 loop signal
      lastToolCallSignature = signature;

      const { message, failed } = await executeOneToolCall(toolCall, state, deps);
      messages.push(message);
      isFailing = isFailing || isRepeat || failed;
    }

    return {
      messages,
      iterationCount: state.iterationCount + 1,
      isFailing,
      maxIterations: isFailing ? 5 : 10,
      lastToolCallSignature,
    };
  };
}
