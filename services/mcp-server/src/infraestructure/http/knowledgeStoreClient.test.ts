import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeStoreClient } from './knowledgeStoreClient.js';

describe('KnowledgeStoreClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('createKnowledgeEntry resolves with path/title on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ path: 'mi-nota.md', title: 'Mi nota' }), { status: 201 }),
    );

    const client = new KnowledgeStoreClient('http://localhost:30025');
    const result = await client.createKnowledgeEntry({ title: 'Mi nota', content: 'contenido' });

    expect(result).toEqual({ path: 'mi-nota.md', title: 'Mi nota' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30025/knowledge-entries',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws a descriptive error when knowledge-store responds with a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('server exploded', { status: 500 }));

    const client = new KnowledgeStoreClient('http://localhost:30025');

    await expect(client.createKnowledgeEntry({ title: 'x', content: 'y' })).rejects.toThrow(
      /knowledge-store request failed \(500\)/,
    );
  });

  it('propagates a network failure (server unreachable)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));

    const client = new KnowledgeStoreClient('http://localhost:30025');

    await expect(client.createKnowledgeEntry({ title: 'x', content: 'y' })).rejects.toThrow('fetch failed');
  });

  it('searchKnowledgeEntries resolves with the results array on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ id: 'k1', path: 'a.md', title: 'A', summary: 's', similarity: 0.9 }]), {
        status: 200,
      }),
    );

    const client = new KnowledgeStoreClient('http://localhost:30025');
    const result = await client.searchKnowledgeEntries('mi consulta', 5);

    expect(result).toEqual([{ id: 'k1', path: 'a.md', title: 'A', summary: 's', similarity: 0.9 }]);
    const [calledUrl] = vi.mocked(fetch).mock.calls[0];
    expect(String(calledUrl)).toBe('http://localhost:30025/knowledge-entries/search?q=mi+consulta&limit=5');
  });

  it('searchKnowledgeEntries defaults limit to 5 when not given', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const client = new KnowledgeStoreClient('http://localhost:30025');
    await client.searchKnowledgeEntries('consulta');

    const [calledUrl] = vi.mocked(fetch).mock.calls[0];
    expect(String(calledUrl)).toContain('limit=5');
  });

  it('searchKnowledgeEntries throws a descriptive error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('server exploded', { status: 500 }));

    const client = new KnowledgeStoreClient('http://localhost:30025');

    await expect(client.searchKnowledgeEntries('consulta')).rejects.toThrow(/knowledge-store request failed \(500\)/);
  });
});
