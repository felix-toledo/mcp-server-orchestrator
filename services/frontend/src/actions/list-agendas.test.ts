import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAgendas } from './list-agendas';

describe('listAgendas', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns the list on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 'r1' }]), { status: 200 }));
    await expect(listAgendas()).resolves.toEqual([{ id: 'r1' }]);
  });

  it('returns an empty list when the scheduler is unreachable (not built yet)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    await expect(listAgendas()).resolves.toEqual([]);
  });

  it('returns an empty list on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    await expect(listAgendas()).resolves.toEqual([]);
  });
});
