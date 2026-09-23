import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTelegramStatus } from './get-telegram-status';

describe('getTelegramStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('resolves with the status on success', async () => {
    const status = { configured: true, botUsername: 'almadev_bot', chatId: '12345', allowedUsernames: ['felix'] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(status), { status: 200 }));
    await expect(getTelegramStatus()).resolves.toEqual(status);
  });

  it('fails open to "not configured" on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    await expect(getTelegramStatus()).resolves.toEqual({
      configured: false,
      botUsername: null,
      chatId: null,
      allowedUsernames: [],
    });
  });

  it('fails open to "not configured" when the bot service is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    await expect(getTelegramStatus()).resolves.toEqual({
      configured: false,
      botUsername: null,
      chatId: null,
      allowedUsernames: [],
    });
  });
});
