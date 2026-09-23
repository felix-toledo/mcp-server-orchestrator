import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteTeam } from './delete-team';

describe('deleteTeam', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteTeam('t1')).resolves.toEqual({ ok: true });
  });

  it('treats 404 as ok (already gone)', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(deleteTeam('t1')).resolves.toEqual({ ok: true });
  });

  it('returns a graceful failure on a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    await expect(deleteTeam('t1')).resolves.toEqual({ ok: false });
  });
});
