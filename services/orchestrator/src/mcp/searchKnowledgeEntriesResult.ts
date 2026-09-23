/** Mirrors mcp-server's SearchKnowledgeEntriesResult (searchKnowledgeEntriesTool). */
export interface SearchKnowledgeEntriesResult {
  id: string;
  path: string;
  title: string;
  summary: string;
  similarity: number;
  type: 'entry' | 'folder';
}
