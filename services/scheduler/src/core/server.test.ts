import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './server.js';

function buildApp(overrides: { reminderService?: object } = {}) {
  const reminderService = {
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    ...overrides.reminderService,
  };
  const app = createApp({ reminderService: reminderService as never });
  return { app, reminderService };
}

describe('scheduler HTTP API', () => {
  it('GET /health -> 200', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('POST /reminders -> 201 on success (ONCE)', async () => {
    const { app } = buildApp({
      reminderService: { create: vi.fn().mockResolvedValue({ id: 'r1' }) },
    });
    const res = await request(app)
      .post('/reminders')
      .send({ actionDescription: 'llamar al dentista', schedule: { type: 'once', at: '2026-09-18T09:00:00.000Z' } });
    expect(res.status).toBe(201);
  });

  it('POST /reminders -> 201 on success (RECURRING)', async () => {
    const { app } = buildApp({
      reminderService: { create: vi.fn().mockResolvedValue({ id: 'r1' }) },
    });
    const res = await request(app)
      .post('/reminders')
      .send({ actionDescription: 'tomar agua', schedule: { type: 'recurring', cron: '0 15 * * *' } });
    expect(res.status).toBe(201);
  });

  it('POST /reminders -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/reminders').send({ actionDescription: '' });
    expect(res.status).toBe(400);
  });

  it('GET /reminders -> 200 with the list', async () => {
    const { app } = buildApp({ reminderService: { list: vi.fn().mockResolvedValue([]) } });
    const res = await request(app).get('/reminders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('DELETE /reminders/:id -> 204 on success', async () => {
    const { app } = buildApp({ reminderService: { delete: vi.fn().mockResolvedValue(undefined) } });
    const res = await request(app).delete('/reminders/r1');
    expect(res.status).toBe(204);
  });

  it('DELETE /reminders/:id -> 404 when missing', async () => {
    const { app } = buildApp({ reminderService: { delete: vi.fn().mockRejectedValue(new Error('not found')) } });
    const res = await request(app).delete('/reminders/missing');
    expect(res.status).toBe(404);
  });

  it('an unhandled rejection in a route returns 500 instead of crashing the process', async () => {
    const { app } = buildApp({ reminderService: { list: vi.fn().mockRejectedValue(new Error('pg-boss exploded')) } });
    const res = await request(app).get('/reminders');
    expect(res.status).toBe(500);
    expect(res.body.message).toContain('pg-boss exploded');
  });
});
