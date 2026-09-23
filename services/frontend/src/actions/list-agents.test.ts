import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAgents } from './list-agents';

describe('listAgents', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns the list on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 'a1' }]), { status: 200 }));
    await expect(listAgents()).resolves.toEqual([{ id: 'a1' }]);
  });

  it('returns an empty list when knowledge-store has no agents endpoint yet', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(listAgents()).resolves.toEqual([]);
  });

  it('returns an empty list on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    await expect(listAgents()).resolves.toEqual([]);
  });
});
