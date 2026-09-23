import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './server.js';

function buildApp(overrides: { knowledgeStoreClient?: object; telegramRuntime?: object } = {}) {
  const knowledgeStoreClient = {
    upsertTelegramLink: vi.fn().mockResolvedValue({ id: 't1' }),
    getTelegramLink: vi.fn().mockResolvedValue(null),
    ...overrides.knowledgeStoreClient,
  };
  const telegramRuntime = {
    start: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue({ delivered: true }),
    getBotUsername: vi.fn().mockReturnValue(null),
    ...overrides.telegramRuntime,
  };
  const app = createApp({ knowledgeStoreClient: knowledgeStoreClient as never, telegramRuntime: telegramRuntime as never });
  return { app, knowledgeStoreClient, telegramRuntime };
}

describe('telegram-bot HTTP API', () => {
  it('GET /health -> 200', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('PUT /config -> 200 on success, persists the token and (re)starts polling', async () => {
    const { app, knowledgeStoreClient, telegramRuntime } = buildApp();
    const res = await request(app).put('/config').send({ botToken: 'abc123' });

    expect(res.status).toBe(200);
    expect(knowledgeStoreClient.upsertTelegramLink).toHaveBeenCalledWith('abc123', undefined);
    expect(telegramRuntime.start).toHaveBeenCalledWith('abc123');
  });

  it('PUT /config -> 200 on success, forwards allowedUsernames when given', async () => {
    const { app, knowledgeStoreClient } = buildApp();
    const res = await request(app).put('/config').send({ botToken: 'abc123', allowedUsernames: ['felix'] });

    expect(res.status).toBe(200);
    expect(knowledgeStoreClient.upsertTelegramLink).toHaveBeenCalledWith('abc123', ['felix']);
  });

  it('PUT /config -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).put('/config').send({ botToken: '' });
    expect(res.status).toBe(400);
  });

  it('GET /status -> 200 with configured: false when nothing is set up yet', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: false, botUsername: null, chatId: null, allowedUsernames: [] });
  });

  it('GET /status -> 200 with the current config, never the raw botToken', async () => {
    const { app } = buildApp({
      knowledgeStoreClient: {
        getTelegramLink: vi.fn().mockResolvedValue({
          id: 't1',
          botToken: 'super-secret-token',
          chatId: '12345',
          currentSessionId: 's1',
          allowedUsernames: ['felix'],
        }),
      },
      telegramRuntime: { getBotUsername: vi.fn().mockReturnValue('almadev_bot') },
    });

    const res = await request(app).get('/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ configured: true, botUsername: 'almadev_bot', chatId: '12345', allowedUsernames: ['felix'] });
    expect(JSON.stringify(res.body)).not.toContain('super-secret-token');
  });

  it('POST /push -> 200 with the delivery result', async () => {
    const { app, telegramRuntime } = buildApp({ telegramRuntime: { push: vi.fn().mockResolvedValue({ delivered: true }) } });
    const res = await request(app).post('/push').send({ text: 'recordatorio' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ delivered: true });
    expect(telegramRuntime.push).toHaveBeenCalledWith('recordatorio');
  });

  it('POST /push -> 200 with delivered: false instead of an error when nothing is bound yet', async () => {
    const { app } = buildApp({ telegramRuntime: { push: vi.fn().mockResolvedValue({ delivered: false }) } });
    const res = await request(app).post('/push').send({ text: 'recordatorio' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ delivered: false });
  });

  it('POST /push -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/push').send({ text: '' });
    expect(res.status).toBe(400);
  });

  it('an unhandled rejection in a route returns 500 instead of crashing the process', async () => {
    const { app } = buildApp({ telegramRuntime: { push: vi.fn().mockRejectedValue(new Error('boom')) } });
    const res = await request(app).post('/push').send({ text: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.message).toContain('boom');
  });
});
