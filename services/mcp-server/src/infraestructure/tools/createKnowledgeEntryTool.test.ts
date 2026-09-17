import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeStoreClient } from '../http/knowledgeStoreClient.js';
import { registerCreateKnowledgeEntryTool } from './createKnowledgeEntryTool.js';
import { createFakeMcpServer } from './testHelpers.js';

function createClientMock() {
  return { createKnowledgeEntry: vi.fn() } as unknown as KnowledgeStoreClient;
}

describe('createKnowledgeEntryTool', () => {
  it('returns a confirmation message on success', async () => {
    const client = createClientMock();
    vi.mocked(client.createKnowledgeEntry).mockResolvedValue({ path: 'mi-nota.md', title: 'Mi nota' });

    const fake = createFakeMcpServer();
    registerCreateKnowledgeEntryTool(fake.server, client);

    const result = (await fake.getHandler('createKnowledgeEntry')({
      title: 'Mi nota',
      content: 'contenido',
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Mi nota');
    expect(result.content[0].text).toContain('mi-nota.md');
    expect(client.createKnowledgeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Mi nota', content: 'contenido' }),
    );
  });

  it('returns an MCP tool error (not a thrown exception) when knowledge-store is unreachable', async () => {
    const client = createClientMock();
    vi.mocked(client.createKnowledgeEntry).mockRejectedValue(new Error('fetch failed'));

    const fake = createFakeMcpServer();
    registerCreateKnowledgeEntryTool(fake.server, client);

    const result = (await fake.getHandler('createKnowledgeEntry')({
      title: 'Mi nota',
      content: 'contenido',
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No pude guardar la nota/);
  });
});
