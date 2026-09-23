import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateTelegramAllowlist } from './update-telegram-allowlist';

describe('updateTelegramAllowlist', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('PATCHes knowledge-store directly with the new allowlist', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await expect(updateTelegramAllowlist(['felix'])).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/telegram-link'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ allowedUsernames: ['felix'] }) }),
    );
  });

  it('returns a graceful error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = await updateTelegramAllowlist(['felix']);
    expect(result.ok).toBe(false);
  });

  it('returns a graceful error on a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    const result = await updateTelegramAllowlist(['felix']);
    expect(result.ok).toBe(false);
  });
});
