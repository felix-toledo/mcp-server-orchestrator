import type { SearchKnowledgeEntriesResult } from './searchKnowledgeEntriesResult.js';

/**
 * Parses the raw MCP CallToolResult from `searchKnowledgeEntries` into the
 * typed array the graph nodes work with. Never throws — a missing/malformed
 * result (including an MCP tool error) parses to an empty array, matching
 * the fail-open pattern used everywhere else retrieval touches this codebase.
 */
export function parseSearchToolResult(toolResult: unknown): SearchKnowledgeEntriesResult[] {
  if (!toolResult || typeof toolResult !== 'object') {
    return [];
  }

  const result = toolResult as { isError?: boolean; content?: Array<{ text?: unknown }> };
  if (result.isError) {
    return [];
  }

  const text = result.content?.[0]?.text;
  if (typeof text !== 'string') {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is SearchKnowledgeEntriesResult =>
        !!item &&
        typeof item.id === 'string' &&
        typeof item.path === 'string' &&
        typeof item.title === 'string' &&
        typeof item.summary === 'string',
    );
  } catch {
    return [];
  }
}
