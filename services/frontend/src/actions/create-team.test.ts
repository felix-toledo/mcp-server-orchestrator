import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTeam } from './create-team';

const validInput = {
  name: 'Marketing',
  memberAgentIds: ['a1'],
  coordinatorAgentId: 'a1',
  projectFolderIds: [],
};

describe('createTeam', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok with the created team on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 't1', name: 'Marketing' }), { status: 201 }));
    await expect(createTeam(validInput)).resolves.toEqual({ ok: true, team: { id: 't1', name: 'Marketing' } });
  });

  it('surfaces the backend validation message (e.g. coordinator not a member) instead of a generic error', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'coordinatorAgentId must be one of memberAgentIds' }), { status: 400 }),
    );
    const result = await createTeam(validInput);
    expect(result).toEqual({ ok: false, error: 'coordinatorAgentId must be one of memberAgentIds' });
  });

  it('returns a graceful error on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    const result = await createTeam(validInput);
    expect(result.ok).toBe(false);
  });
});
