import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramBotClient } from './telegramBotClient.js';

describe('TelegramBotClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts { text } to /push and reports delivered: true on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ delivered: true }), { status: 200 }));

    const client = new TelegramBotClient('http://localhost:30023');
    const result = await client.push('recordatorio');

    expect(result).toEqual({ delivered: true });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30023/push',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'recordatorio' }) }),
    );
  });

  it('AC5: reports delivered: false instead of throwing on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('no chat bound', { status: 400 }));
    const client = new TelegramBotClient('http://localhost:30023');
    await expect(client.push('recordatorio')).resolves.toEqual({ delivered: false });
  });

  it('AC5: reports delivered: false instead of throwing when telegram-bot is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new TelegramBotClient('http://localhost:30023');
    await expect(client.push('recordatorio')).resolves.toEqual({ delivered: false });
  });
});
