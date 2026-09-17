import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './server.js';
import { UserAlreadyExistsError } from '../services/userService.js';

function buildApp(overrides: { userService?: object; knowledgeEntryService?: object } = {}) {
  const userService = {
    create: vi.fn(),
    getCurrent: vi.fn(),
    ...overrides.userService,
  };
  const knowledgeEntryService = {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    search: vi.fn(),
    ...overrides.knowledgeEntryService,
  };
  const app = createApp({
    userService: userService as never,
    knowledgeEntryService: knowledgeEntryService as never,
  });
  return { app, userService, knowledgeEntryService };
}

describe('knowledge-store HTTP API', () => {
  it('GET /health -> 200', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('POST /users -> 201 on success', async () => {
    const { app } = buildApp({
      userService: { create: vi.fn().mockResolvedValue({ id: 'u1' }) },
    });
    const res = await request(app)
      .post('/users')
      .send({ name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' });
    expect(res.status).toBe(201);
  });

  it('POST /users -> 409 when a user already exists', async () => {
    const { app } = buildApp({
      userService: { create: vi.fn().mockRejectedValue(new UserAlreadyExistsError()) },
    });
    const res = await request(app)
      .post('/users')
      .send({ name: 'Felix', email: 'f@x.com', purpose: 'PERSONAL_DAILY' });
    expect(res.status).toBe(409);
  });

  it('POST /users -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/users').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('GET /users/me -> 404 with no user yet', async () => {
    const { app } = buildApp({ userService: { getCurrent: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(404);
  });

  it('GET /users/me -> 200 with an existing user', async () => {
    const { app } = buildApp({ userService: { getCurrent: vi.fn().mockResolvedValue({ id: 'u1' }) } });
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(200);
  });

  it('POST /knowledge-entries -> 201 on success', async () => {
    const { app } = buildApp({
      knowledgeEntryService: { create: vi.fn().mockResolvedValue({ id: 'k1', path: 'nota.md' }) },
    });
    const res = await request(app).post('/knowledge-entries').send({ title: 'Nota', content: 'contenido' });
    expect(res.status).toBe(201);
  });

  it('GET /knowledge-entries/:id -> 404 when missing', async () => {
    const { app } = buildApp({ knowledgeEntryService: { getById: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/knowledge-entries/missing');
    expect(res.status).toBe(404);
  });

  it('PUT /knowledge-entries/:id -> 200 on success', async () => {
    const { app } = buildApp({
      knowledgeEntryService: { update: vi.fn().mockResolvedValue({ id: 'k1' }) },
    });
    const res = await request(app).put('/knowledge-entries/k1').send({ content: 'nuevo contenido' });
    expect(res.status).toBe(200);
  });

  it('GET /knowledge-entries/search -> 200 with results', async () => {
    const search = vi.fn().mockResolvedValue([{ id: 'k1', path: 'a.md', title: 'A', summary: 's', similarity: 0.9 }]);
    const { app } = buildApp({ knowledgeEntryService: { search } });
    const res = await request(app).get('/knowledge-entries/search').query({ q: 'consulta' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(search).toHaveBeenCalledWith('consulta', 5);
  });

  it('GET /knowledge-entries/search -> 200 [] when nothing clears the threshold', async () => {
    const { app } = buildApp({ knowledgeEntryService: { search: vi.fn().mockResolvedValue([]) } });
    const res = await request(app).get('/knowledge-entries/search').query({ q: 'consulta' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /knowledge-entries/search -> 400 when q is missing', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/knowledge-entries/search');
    expect(res.status).toBe(400);
  });

  it('GET /knowledge-entries/search is not swallowed by the /:id route', async () => {
    const getById = vi.fn();
    const search = vi.fn().mockResolvedValue([]);
    const { app } = buildApp({ knowledgeEntryService: { getById, search } });
    await request(app).get('/knowledge-entries/search').query({ q: 'consulta' });
    expect(search).toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
  });
});
