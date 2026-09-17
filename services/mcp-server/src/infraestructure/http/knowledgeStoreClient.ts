export interface CreateKnowledgeEntryInput {
  title: string;
  content: string;
  tags?: string[];
}

export interface CreateKnowledgeEntryResult {
  path: string;
  title: string;
}

export interface SearchKnowledgeEntriesResult {
  id: string;
  path: string;
  title: string;
  summary: string;
  similarity: number;
}

export class KnowledgeStoreClient {
  constructor(private readonly baseUrl: string) {}

  async createKnowledgeEntry(input: CreateKnowledgeEntryInput): Promise<CreateKnowledgeEntryResult> {
    const response = await fetch(`${this.baseUrl}/knowledge-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`knowledge-store request failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as CreateKnowledgeEntryResult;
  }

  async searchKnowledgeEntries(query: string, limit = 5): Promise<SearchKnowledgeEntriesResult[]> {
    const url = new URL(`${this.baseUrl}/knowledge-entries/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`knowledge-store request failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as SearchKnowledgeEntriesResult[];
  }
}
