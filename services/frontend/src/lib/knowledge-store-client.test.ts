import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeStoreClient } from './knowledge-store-client';

describe('KnowledgeStoreClient', () => {
  const baseUrl = 'http://localhost:30025';
  let client: KnowledgeStoreClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    client = new KnowledgeStoreClient(baseUrl);
  });

  it('createUser resolves on 201', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'u1' }), { status: 201 }));
    const result = await client.createUser({ name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' });
    expect(result.id).toBe('u1');
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/users`, expect.objectContaining({ method: 'POST' }));
  });

  it('createUser throws a recognizable error on 409', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'A user already exists' }), { status: 409 }),
    );
    await expect(
      client.createUser({ name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' }),
    ).rejects.toThrow(/A user already exists/);
  });

  it('getCurrentUser returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(client.getCurrentUser()).resolves.toBeNull();
  });

  it('getCurrentUser returns the user on 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }));
    await expect(client.getCurrentUser()).resolves.toEqual({ id: 'u1' });
  });

  it('createKnowledgeEntry resolves on 201', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'k1', path: 'nota.md' }), { status: 201 }),
    );
    const result = await client.createKnowledgeEntry({ title: 'Nota', content: 'contenido' });
    expect(result.path).toBe('nota.md');
  });

  it('listKnowledgeEntries returns the list', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 'k1' }]), { status: 200 }));
    await expect(client.listKnowledgeEntries()).resolves.toEqual([{ id: 'k1' }]);
  });

  it('getKnowledgeEntry returns null on 404', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(client.getKnowledgeEntry('missing')).resolves.toBeNull();
  });

  it('updateKnowledgeEntry resolves on 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'k1' }), { status: 200 }));
    await expect(client.updateKnowledgeEntry('k1', 'nuevo contenido')).resolves.toEqual({ id: 'k1' });
  });
});
