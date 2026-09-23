import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeStoreClient } from './knowledgeStoreClient.js';

describe('KnowledgeStoreClient (telegram-bot, ADR-0002)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('getTelegramLink returns null (not throw) on a 404 — AC1 "runs, does nothing" case', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.getTelegramLink()).resolves.toBeNull();
  });

  it('getTelegramLink resolves with the config on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null }), { status: 200 }),
    );
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.getTelegramLink()).resolves.toEqual({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null });
  });

  it('upsertTelegramLink PUTs the token', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null }), { status: 200 }),
    );
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await client.upsertTelegramLink('abc');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30025/telegram-link',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ botToken: 'abc' }) }),
    );
  });

  it('updateTelegramLinkBinding PATCHes the given fields', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 't1', botToken: 'abc', chatId: '123', currentSessionId: null }), { status: 200 }),
    );
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await client.updateTelegramLinkBinding({ chatId: '123' });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30025/telegram-link',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ chatId: '123' }) }),
    );
  });

  it('appendChatMessage posts role/content to the right endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await client.appendChatMessage('s1', 'ASSISTANT', 'recordatorio entregado');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30025/chat-sessions/s1/messages',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ role: 'ASSISTANT', content: 'recordatorio entregado' }) }),
    );
  });

  it('getChatSessionMessages resolves with the session messages on success', async () => {
    const messages = [
      { role: 'USER', content: 'hola' },
      { role: 'ASSISTANT', content: 'buenas' },
    ];
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 's1', messages }), { status: 200 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.getChatSessionMessages('s1')).resolves.toEqual(messages);
    expect(fetch).toHaveBeenCalledWith('http://localhost:30025/chat-sessions/s1');
  });

  it('getChatSessionMessages fails open to [] on a non-2xx status or unreachable, never throws', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.getChatSessionMessages('missing')).resolves.toEqual([]);
  });

  it('throws a descriptive error on a non-2xx, non-404 status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }));
    const client = new KnowledgeStoreClient('http://localhost:30025');
    await expect(client.upsertTelegramLink('abc')).rejects.toThrow(/knowledge-store request failed \(500\)/);
  });
});
