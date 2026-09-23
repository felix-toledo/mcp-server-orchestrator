import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSkill } from './create-skill';

describe('createSkill', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok with the created skill on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 's1', name: 'pirata' }), { status: 201 }));
    await expect(createSkill('pirata', 'usar cuando pidan hablar como pirata', 'respondé en jerga de pirata')).resolves.toEqual({
      ok: true,
      skill: { id: 's1', name: 'pirata' },
    });
  });

  it('returns a graceful error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = await createSkill('pirata', 'x', 'y');
    expect(result.ok).toBe(false);
  });

  it('returns a graceful error on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    const result = await createSkill('pirata', 'x', 'y');
    expect(result.ok).toBe(false);
  });
});
