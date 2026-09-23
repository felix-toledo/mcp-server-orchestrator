import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './server.js';
import { CoordinatorNotAMemberError } from '../services/teamService.js';
import { UserAlreadyExistsError } from '../services/userService.js';

function buildApp(
  overrides: {
    userService?: object;
    knowledgeEntryService?: object;
    chatSessionService?: object;
    vaultFolderService?: object;
    agentService?: object;
    telegramLinkService?: object;
    skillService?: object;
    teamService?: object;
    voiceProfileService?: object;
  } = {},
) {
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
    getProfileNote: vi.fn(),
    ...overrides.knowledgeEntryService,
  };
  const chatSessionService = {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    appendMessage: vi.fn(),
    delete: vi.fn(),
    ...overrides.chatSessionService,
  };
  const vaultFolderService = {
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    ...overrides.vaultFolderService,
  };
  const agentService = {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides.agentService,
  };
  const telegramLinkService = {
    upsert: vi.fn(),
    get: vi.fn(),
    updateBinding: vi.fn(),
    ...overrides.telegramLinkService,
  };
  const skillService = {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides.skillService,
  };
  const teamService = {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides.teamService,
  };
  const voiceProfileService = {
    get: vi.fn(),
    enroll: vi.fn(),
    updateCurrentSession: vi.fn(),
    reset: vi.fn(),
    ...overrides.voiceProfileService,
  };
  const app = createApp({
    userService: userService as never,
    knowledgeEntryService: knowledgeEntryService as never,
    chatSessionService: chatSessionService as never,
    vaultFolderService: vaultFolderService as never,
    agentService: agentService as never,
    telegramLinkService: telegramLinkService as never,
    skillService: skillService as never,
    teamService: teamService as never,
    voiceProfileService: voiceProfileService as never,
  });
  return {
    app,
    userService,
    knowledgeEntryService,
    chatSessionService,
    vaultFolderService,
    agentService,
    telegramLinkService,
    skillService,
    teamService,
    voiceProfileService,
  };
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

  it('GET /knowledge-entries/profile -> 200 with the profile note', async () => {
    const getProfileNote = vi.fn().mockResolvedValue({ title: 'Perfil', content: '# Perfil\n\n- Mi novia: Melisa' });
    const { app } = buildApp({ knowledgeEntryService: { getProfileNote } });
    const res = await request(app).get('/knowledge-entries/profile');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ title: 'Perfil', content: '# Perfil\n\n- Mi novia: Melisa' });
  });

  it('GET /knowledge-entries/profile -> 404 when no profile note exists yet', async () => {
    const { app } = buildApp({ knowledgeEntryService: { getProfileNote: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/knowledge-entries/profile');
    expect(res.status).toBe(404);
  });

  it('GET /knowledge-entries/profile is not swallowed by the /:id route', async () => {
    const getById = vi.fn();
    const getProfileNote = vi.fn().mockResolvedValue({ title: 'Perfil', content: 'contenido' });
    const { app } = buildApp({ knowledgeEntryService: { getById, getProfileNote } });
    await request(app).get('/knowledge-entries/profile');
    expect(getProfileNote).toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
  });

  it('POST /chat-sessions -> 201 on success', async () => {
    const { app } = buildApp({
      chatSessionService: { create: vi.fn().mockResolvedValue({ id: 's1', title: null }) },
    });
    const res = await request(app).post('/chat-sessions');
    expect(res.status).toBe(201);
  });

  it('POST /chat-sessions with a teamId body -> forwards it to the service (team-chat amendment)', async () => {
    const create = vi.fn().mockResolvedValue({ id: 's1', title: null });
    const { app } = buildApp({ chatSessionService: { create } });
    const res = await request(app).post('/chat-sessions').send({ teamId: 't1' });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith('t1');
  });

  it('GET /chat-sessions -> 200 with the list', async () => {
    const { app } = buildApp({ chatSessionService: { list: vi.fn().mockResolvedValue([]) } });
    const res = await request(app).get('/chat-sessions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /chat-sessions/:id -> 404 when missing', async () => {
    const { app } = buildApp({ chatSessionService: { getById: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/chat-sessions/missing');
    expect(res.status).toBe(404);
  });

  it('POST /chat-sessions/:id/messages -> 201 on success', async () => {
    const { app } = buildApp({
      chatSessionService: { appendMessage: vi.fn().mockResolvedValue({ id: 'm1' }) },
    });
    const res = await request(app).post('/chat-sessions/s1/messages').send({ role: 'USER', content: 'hola' });
    expect(res.status).toBe(201);
  });

  it('POST /chat-sessions/:id/messages -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/chat-sessions/s1/messages').send({ role: 'BOGUS', content: '' });
    expect(res.status).toBe(400);
  });

  it('POST /chat-sessions/:id/messages -> 404 when the session does not exist', async () => {
    const { app } = buildApp({
      chatSessionService: { appendMessage: vi.fn().mockRejectedValue(new Error('not found')) },
    });
    const res = await request(app).post('/chat-sessions/missing/messages').send({ role: 'USER', content: 'hola' });
    expect(res.status).toBe(404);
  });

  it('DELETE /chat-sessions/:id -> 204 on success', async () => {
    const { app } = buildApp({ chatSessionService: { delete: vi.fn().mockResolvedValue(undefined) } });
    const res = await request(app).delete('/chat-sessions/s1');
    expect(res.status).toBe(204);
  });

  it('POST /vault-folders -> 201 on success', async () => {
    const { app } = buildApp({
      vaultFolderService: { create: vi.fn().mockResolvedValue({ id: 'f1', path: 'proyectos' }) },
    });
    const res = await request(app).post('/vault-folders').send({ path: 'proyectos' });
    expect(res.status).toBe(201);
  });

  it('POST /vault-folders -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/vault-folders').send({});
    expect(res.status).toBe(400);
  });

  it('GET /vault-folders -> 200 with the list', async () => {
    const { app } = buildApp({ vaultFolderService: { list: vi.fn().mockResolvedValue([]) } });
    const res = await request(app).get('/vault-folders');
    expect(res.status).toBe(200);
  });

  it('DELETE /vault-folders/:id -> 204 on success', async () => {
    const { app } = buildApp({ vaultFolderService: { delete: vi.fn().mockResolvedValue(undefined) } });
    const res = await request(app).delete('/vault-folders/f1');
    expect(res.status).toBe(204);
  });

  it('DELETE /vault-folders/:id -> 404 when missing', async () => {
    const { app } = buildApp({ vaultFolderService: { delete: vi.fn().mockRejectedValue(new Error('not found')) } });
    const res = await request(app).delete('/vault-folders/missing');
    expect(res.status).toBe(404);
  });

  it('POST /agents -> 201 on success', async () => {
    const { app } = buildApp({
      agentService: { create: vi.fn().mockResolvedValue({ id: 'a1', name: 'Bibliotecario' }) },
    });
    const res = await request(app).post('/agents').send({ name: 'Bibliotecario', systemPromptAddendum: 'Sé formal.' });
    expect(res.status).toBe(201);
  });

  it('POST /agents -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/agents').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('GET /agents -> 200 with the list', async () => {
    const { app } = buildApp({ agentService: { list: vi.fn().mockResolvedValue([]) } });
    const res = await request(app).get('/agents');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /agents/:id -> 404 when missing', async () => {
    const { app } = buildApp({ agentService: { getById: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/agents/missing');
    expect(res.status).toBe(404);
  });

  it('GET /agents/:id -> 200 with an existing agent', async () => {
    const { app } = buildApp({ agentService: { getById: vi.fn().mockResolvedValue({ id: 'a1' }) } });
    const res = await request(app).get('/agents/a1');
    expect(res.status).toBe(200);
  });

  it('PUT /agents/:id -> 200 on success', async () => {
    const { app } = buildApp({ agentService: { update: vi.fn().mockResolvedValue({ id: 'a1' }) } });
    const res = await request(app).put('/agents/a1').send({ name: 'Bibliotecario', systemPromptAddendum: 'x' });
    expect(res.status).toBe(200);
  });

  it('PUT /agents/:id -> 404 when missing', async () => {
    const { app } = buildApp({ agentService: { update: vi.fn().mockRejectedValue(new Error('not found')) } });
    const res = await request(app).put('/agents/missing').send({ name: 'x', systemPromptAddendum: 'y' });
    expect(res.status).toBe(404);
  });

  it('DELETE /agents/:id -> 204 on success', async () => {
    const { app } = buildApp({ agentService: { delete: vi.fn().mockResolvedValue(undefined) } });
    const res = await request(app).delete('/agents/a1');
    expect(res.status).toBe(204);
  });

  it('DELETE /agents/:id -> 404 when missing', async () => {
    const { app } = buildApp({ agentService: { delete: vi.fn().mockRejectedValue(new Error('not found')) } });
    const res = await request(app).delete('/agents/missing');
    expect(res.status).toBe(404);
  });

  it('PUT /telegram-link -> 200 on success', async () => {
    const { app } = buildApp({
      telegramLinkService: { upsert: vi.fn().mockResolvedValue({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null }) },
    });
    const res = await request(app).put('/telegram-link').send({ botToken: 'abc' });
    expect(res.status).toBe(200);
  });

  it('PUT /telegram-link -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).put('/telegram-link').send({ botToken: '' });
    expect(res.status).toBe(400);
  });

  it('GET /telegram-link -> 404 when nothing is configured yet', async () => {
    const { app } = buildApp({ telegramLinkService: { get: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/telegram-link');
    expect(res.status).toBe(404);
  });

  it('GET /telegram-link -> 200 with the config', async () => {
    const { app } = buildApp({
      telegramLinkService: { get: vi.fn().mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '123', currentSessionId: null }) },
    });
    const res = await request(app).get('/telegram-link');
    expect(res.status).toBe(200);
  });

  it('PATCH /telegram-link -> 200 on success', async () => {
    const { app } = buildApp({
      telegramLinkService: { updateBinding: vi.fn().mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '123', currentSessionId: null }) },
    });
    const res = await request(app).patch('/telegram-link').send({ chatId: '123' });
    expect(res.status).toBe(200);
  });

  it('PATCH /telegram-link -> 404 when nothing is configured yet', async () => {
    const { app } = buildApp({
      telegramLinkService: { updateBinding: vi.fn().mockRejectedValue(new Error('No Telegram link configured yet')) },
    });
    const res = await request(app).patch('/telegram-link').send({ chatId: '123' });
    expect(res.status).toBe(404);
  });

  it('POST /skills -> 201 on success', async () => {
    const { app } = buildApp({ skillService: { create: vi.fn().mockResolvedValue({ id: 's1', name: 'x' }) } });
    const res = await request(app).post('/skills').send({ name: 'x', description: 'y', instructions: 'z' });
    expect(res.status).toBe(201);
  });

  it('POST /skills -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/skills').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('GET /skills -> 200 with the list', async () => {
    const { app } = buildApp({ skillService: { list: vi.fn().mockResolvedValue([]) } });
    const res = await request(app).get('/skills');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /skills/:id -> 404 when missing', async () => {
    const { app } = buildApp({ skillService: { getById: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/skills/missing');
    expect(res.status).toBe(404);
  });

  it('PUT /skills/:id -> 200 on success', async () => {
    const { app } = buildApp({ skillService: { update: vi.fn().mockResolvedValue({ id: 's1' }) } });
    const res = await request(app).put('/skills/s1').send({ name: 'x', description: 'y', instructions: 'z' });
    expect(res.status).toBe(200);
  });

  it('DELETE /skills/:id -> 204 on success', async () => {
    const { app } = buildApp({ skillService: { delete: vi.fn().mockResolvedValue(undefined) } });
    const res = await request(app).delete('/skills/s1');
    expect(res.status).toBe(204);
  });

  it('DELETE /skills/:id -> 404 when missing', async () => {
    const { app } = buildApp({ skillService: { delete: vi.fn().mockRejectedValue(new Error('not found')) } });
    const res = await request(app).delete('/skills/missing');
    expect(res.status).toBe(404);
  });

  it('POST /teams -> 201 on success', async () => {
    const { app } = buildApp({ teamService: { create: vi.fn().mockResolvedValue({ id: 't1', name: 'Marketing' }) } });
    const res = await request(app)
      .post('/teams')
      .send({ name: 'Marketing', memberAgentIds: ['a1'], coordinatorAgentId: 'a1', projectFolderIds: [] });
    expect(res.status).toBe(201);
  });

  it('POST /teams -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/teams').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('POST /teams -> 400 when the coordinator is not a member', async () => {
    const { app } = buildApp({ teamService: { create: vi.fn().mockRejectedValue(new CoordinatorNotAMemberError()) } });
    const res = await request(app)
      .post('/teams')
      .send({ name: 'Marketing', memberAgentIds: ['a1'], coordinatorAgentId: 'a2', projectFolderIds: [] });
    expect(res.status).toBe(400);
  });

  it('GET /teams -> 200 with the list', async () => {
    const { app } = buildApp({ teamService: { list: vi.fn().mockResolvedValue([]) } });
    const res = await request(app).get('/teams');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /teams/:id -> 404 when missing', async () => {
    const { app } = buildApp({ teamService: { getById: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/teams/missing');
    expect(res.status).toBe(404);
  });

  it('DELETE /teams/:id -> 204 on success', async () => {
    const { app } = buildApp({ teamService: { delete: vi.fn().mockResolvedValue(undefined) } });
    const res = await request(app).delete('/teams/t1');
    expect(res.status).toBe(204);
  });

  it('GET /voice-profile -> 404 when no profile is configured yet', async () => {
    const { app } = buildApp({ voiceProfileService: { get: vi.fn().mockResolvedValue(null) } });
    const res = await request(app).get('/voice-profile');
    expect(res.status).toBe(404);
  });

  it('GET /voice-profile -> 200 with the profile', async () => {
    const { app } = buildApp({
      voiceProfileService: {
        get: vi.fn().mockResolvedValue({ id: 'v1', status: 'TRAINED', enrollmentAudioPath: 'C:\\voice-profile\\enrollment.wav', currentSessionId: null, trainedAt: new Date() }),
      },
    });
    const res = await request(app).get('/voice-profile');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('TRAINED');
  });

  it('POST /voice-profile/enroll -> 200 on a real multipart upload', async () => {
    const enroll = vi.fn().mockResolvedValue({ id: 'v1', status: 'TRAINED', enrollmentAudioPath: 'C:\\voice-profile\\enrollment.wav', currentSessionId: null, trainedAt: new Date() });
    const { app } = buildApp({ voiceProfileService: { enroll } });
    const res = await request(app)
      .post('/voice-profile/enroll')
      .attach('audio', Buffer.from('fake audio bytes'), 'sample.wav');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('TRAINED');
    expect(enroll).toHaveBeenCalledWith(expect.any(Buffer), 'sample.wav');
  });

  it('POST /voice-profile/enroll -> 400 when no file is attached', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/voice-profile/enroll');
    expect(res.status).toBe(400);
  });

  it('PATCH /voice-profile -> 200 on success', async () => {
    const { app } = buildApp({
      voiceProfileService: {
        updateCurrentSession: vi.fn().mockResolvedValue({ id: 'v1', status: 'TRAINED', enrollmentAudioPath: 'x', currentSessionId: 's2', trainedAt: new Date() }),
      },
    });
    const res = await request(app).patch('/voice-profile').send({ currentSessionId: 's2' });
    expect(res.status).toBe(200);
    expect(res.body.currentSessionId).toBe('s2');
  });

  it('PATCH /voice-profile -> 400 on invalid body', async () => {
    const { app } = buildApp();
    const res = await request(app).patch('/voice-profile').send({ currentSessionId: '' });
    expect(res.status).toBe(400);
  });

  it('PATCH /voice-profile -> 404 when no profile is configured yet', async () => {
    const { app } = buildApp({
      voiceProfileService: { updateCurrentSession: vi.fn().mockRejectedValue(new Error('No voice profile configured yet')) },
    });
    const res = await request(app).patch('/voice-profile').send({ currentSessionId: 's2' });
    expect(res.status).toBe(404);
  });

  it('DELETE /voice-profile -> 204 on success', async () => {
    const { app } = buildApp({ voiceProfileService: { reset: vi.fn().mockResolvedValue(undefined) } });
    const res = await request(app).delete('/voice-profile');
    expect(res.status).toBe(204);
  });

  it('an unhandled rejection in a route returns 500 instead of crashing the process', async () => {
    const { app } = buildApp({
      knowledgeEntryService: { create: vi.fn().mockRejectedValue(new Error('OpenAI embeddings request failed (404)')) },
    });
    const res = await request(app).post('/knowledge-entries').send({ title: 'x', content: 'y' });
    expect(res.status).toBe(500);
    expect(res.body.message).toContain('embeddings');
  });
});
