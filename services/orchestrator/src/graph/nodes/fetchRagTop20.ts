import type { McpManager } from '../../mcp/McpManager.js';
import { parseSearchToolResult } from '../../mcp/parseSearchToolResult.js';
import type { PipelineState, PipelineStateUpdate } from '../state.js';

const RAG_TOP_20_LIMIT = 20;

/** AC2 — the RAG top-20 half of the parallel fan-out. Never throws (AC7-style fail-open). */
export function createFetchRagTop20Node(deps: { mcpManager: McpManager }) {
  return async (state: PipelineState): Promise<PipelineStateUpdate> => {
    const lastUserMessage = [...state.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage?.content) {
      return { ragTop20: [] };
    }

    try {
      const toolResult = await deps.mcpManager.callTool('searchKnowledgeEntries', {
        query: lastUserMessage.content,
        limit: RAG_TOP_20_LIMIT,
      });
      return { ragTop20: parseSearchToolResult(toolResult) };
    } catch (error) {
      console.warn('⚠️ RAG top-20 falló, sigo sin candidatos:', error);
      return { ragTop20: [] };
    }
  };
}
