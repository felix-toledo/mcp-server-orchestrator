import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgent } from './create-agent';

describe('createAgent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok with the created agent on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'a1', name: 'Redactor' }), { status: 201 }));
    await expect(createAgent('Redactor', 'sé más formal')).resolves.toEqual({
      ok: true,
      agent: { id: 'a1', name: 'Redactor' },
    });
  });

  it('returns a graceful error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = await createAgent('Redactor', 'sé más formal');
    expect(result.ok).toBe(false);
  });

  it('returns a graceful error on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    const result = await createAgent('Redactor', 'sé más formal');
    expect(result.ok).toBe(false);
  });
});
