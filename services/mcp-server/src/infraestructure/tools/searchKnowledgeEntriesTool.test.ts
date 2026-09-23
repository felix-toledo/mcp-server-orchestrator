import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeStoreClient } from '../http/knowledgeStoreClient.js';
import { registerSearchKnowledgeEntriesTool } from './searchKnowledgeEntriesTool.js';
import { createFakeMcpServer } from './testHelpers.js';

function createClientMock() {
  return { searchKnowledgeEntries: vi.fn() } as unknown as KnowledgeStoreClient;
}

describe('searchKnowledgeEntriesTool', () => {
  it('returns the results as JSON text on success', async () => {
    const client = createClientMock();
    const results = [
      { id: 'k1', path: 'a.md', title: 'A', summary: 'resumen', similarity: 0.9, type: 'entry' as const },
    ];
    vi.mocked(client.searchKnowledgeEntries).mockResolvedValue(results);

    const fake = createFakeMcpServer();
    registerSearchKnowledgeEntriesTool(fake.server, client);

    const result = (await fake.getHandler('searchKnowledgeEntries')({ query: 'consulta' })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(results);
    expect(client.searchKnowledgeEntries).toHaveBeenCalledWith('consulta', undefined);
  });

  it('passes limit through when given', async () => {
    const client = createClientMock();
    vi.mocked(client.searchKnowledgeEntries).mockResolvedValue([]);

    const fake = createFakeMcpServer();
    registerSearchKnowledgeEntriesTool(fake.server, client);

    await fake.getHandler('searchKnowledgeEntries')({ query: 'consulta', limit: 3 });

    expect(client.searchKnowledgeEntries).toHaveBeenCalledWith('consulta', 3);
  });

  it('returns an MCP tool error (not a thrown exception) when knowledge-store is unreachable', async () => {
    const client = createClientMock();
    vi.mocked(client.searchKnowledgeEntries).mockRejectedValue(new Error('fetch failed'));

    const fake = createFakeMcpServer();
    registerSearchKnowledgeEntriesTool(fake.server, client);

    const result = (await fake.getHandler('searchKnowledgeEntries')({ query: 'consulta' })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No pude buscar en la bóveda/);
  });
});
