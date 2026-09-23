import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listSkills } from './list-skills';

describe('listSkills', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns the list on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 's1' }]), { status: 200 }));
    await expect(listSkills()).resolves.toEqual([{ id: 's1' }]);
  });

  it('returns an empty list on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    await expect(listSkills()).resolves.toEqual([]);
  });

  it('returns an empty list on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    await expect(listSkills()).resolves.toEqual([]);
  });
});
