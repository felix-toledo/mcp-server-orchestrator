import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTelegramToken } from './save-telegram-token';

describe('saveTelegramToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns ok on a successful save', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await expect(saveTelegramToken('token-123')).resolves.toEqual({ ok: true });
  });

  it('returns a graceful error when the bot service responds with an error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = await saveTelegramToken('token-123');
    expect(result.ok).toBe(false);
  });

  it('returns a graceful error when the bot service is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    const result = await saveTelegramToken('token-123');
    expect(result.ok).toBe(false);
  });

  it('forwards allowedUsernames when given', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await saveTelegramToken('token-123', ['felix']);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ botToken: 'token-123', allowedUsernames: ['felix'] }) }),
    );
  });
});
