import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runReasoningGraphMock = vi.fn();

vi.mock('../graph/graphRuntime.js', () => ({
  initializeGraphRuntime: vi.fn().mockResolvedValue(undefined),
  runReasoningGraph: runReasoningGraphMock,
  disconnectGraphRuntime: vi.fn().mockResolvedValue(undefined),
}));

const createChatSessionMock = vi.fn();
const appendChatMessageMock = vi.fn();
const hasCompletedOnboardingMock = vi.fn();

vi.mock('../knowledge/knowledgeStoreClient.js', () => ({
  KnowledgeStoreClient: vi.fn().mockImplementation(() => ({
    createChatSession: createChatSessionMock,
    appendChatMessage: appendChatMessageMock,
    hasCompletedOnboarding: hasCompletedOnboardingMock,
  })),
}));

const clearInquireStatusMock = vi.fn();
const getInquireStatusMock = vi.fn();

vi.mock('../graph/inquireStatusStore.js', () => ({
  clearInquireStatus: clearInquireStatusMock,
  getInquireStatus: getInquireStatusMock,
}));

function fakeRes() {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('inquireController (chat session persistence, knowledge-store/003-chat-sessions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runReasoningGraphMock.mockResolvedValue({ role: 'assistant', content: 'listo' });
    hasCompletedOnboardingMock.mockResolvedValue(true);
  });

  describe('onboarding gate (real bug found live 2026-09-18)', () => {
    it('never reaches the reasoning graph or persists anything when onboarding is not complete', async () => {
      hasCompletedOnboardingMock.mockResolvedValue(false);
      const { inquireController } = await import('./inquireController.js');

      const req = { body: { messages: [{ role: 'user', content: 'hola' }] } } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(runReasoningGraphMock).not.toHaveBeenCalled();
      expect(createChatSessionMock).not.toHaveBeenCalled();
      expect(appendChatMessageMock).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.objectContaining({ role: 'assistant', content: expect.stringContaining('onboarding') }),
        }),
      );
    });

    it('answers normally once onboarding is complete', async () => {
      hasCompletedOnboardingMock.mockResolvedValue(true);
      const { inquireController } = await import('./inquireController.js');

      const req = { body: { messages: [{ role: 'user', content: 'hola' }] } } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(runReasoningGraphMock).toHaveBeenCalled();
    });
  });

  describe('team-chat amendment (orchestrator/003-teams)', () => {
    it('forwards teamId to runReasoningGraph so it can dispatch straight to that team', async () => {
      const { inquireController } = await import('./inquireController.js');

      const req = {
        body: { messages: [{ role: 'user', content: 'hola equipo' }], teamId: 't1' },
      } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(runReasoningGraphMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ teamId: 't1' }));
    });

    it('tags a newly created session with teamId when starting a team chat', async () => {
      createChatSessionMock.mockResolvedValue({ id: 'team-session', title: null, createdAt: 'x', updatedAt: 'x' });
      const { inquireController } = await import('./inquireController.js');

      const req = {
        body: { messages: [{ role: 'user', content: 'hola equipo' }], teamId: 't1' },
      } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(createChatSessionMock).toHaveBeenCalledWith('t1');
    });
  });

  describe('live-status amendment', () => {
    it('forwards requestId to runReasoningGraph', async () => {
      const { inquireController } = await import('./inquireController.js');

      const req = { body: { messages: [{ role: 'user', content: 'hola' }], requestId: 'r1' } } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(runReasoningGraphMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requestId: 'r1' }));
    });

    it('clears the status once the request finishes, on success', async () => {
      const { inquireController } = await import('./inquireController.js');

      const req = { body: { messages: [{ role: 'user', content: 'hola' }], requestId: 'r1' } } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(clearInquireStatusMock).toHaveBeenCalledWith('r1');
    });

    it('clears the status even when the graph throws (finally, not just the happy path)', async () => {
      runReasoningGraphMock.mockRejectedValue(new Error('graph blew up'));
      const { inquireController } = await import('./inquireController.js');

      const req = { body: { messages: [{ role: 'user', content: 'hola' }], requestId: 'r1' } } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(clearInquireStatusMock).toHaveBeenCalledWith('r1');
    });

    it('never touches the status store when no requestId was given', async () => {
      const { inquireController } = await import('./inquireController.js');

      const req = { body: { messages: [{ role: 'user', content: 'hola' }] } } as Request;
      const res = fakeRes();

      await inquireController(req, res);

      expect(clearInquireStatusMock).not.toHaveBeenCalled();
    });
  });

  it('AC7: creates a session when none is given, returns sessionId in the response', async () => {
    createChatSessionMock.mockResolvedValue({ id: 'new-session', title: null, createdAt: 'x', updatedAt: 'x' });
    const { inquireController } = await import('./inquireController.js');

    const req = { body: { messages: [{ role: 'user', content: 'hola' }] } } as Request;
    const res = fakeRes();

    await inquireController(req, res);

    expect(runReasoningGraphMock).toHaveBeenCalled();
    expect(createChatSessionMock).toHaveBeenCalled();
    expect(appendChatMessageMock).toHaveBeenCalledWith('new-session', 'USER', 'hola');
    expect(appendChatMessageMock).toHaveBeenCalledWith('new-session', 'ASSISTANT', 'listo');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'new-session' }));
  });

  it('AC7: reuses the given sessionId instead of creating a new one', async () => {
    const { inquireController } = await import('./inquireController.js');

    const req = {
      body: { messages: [{ role: 'user', content: 'segundo mensaje' }], sessionId: 'existing-session' },
    } as Request;
    const res = fakeRes();

    await inquireController(req, res);

    expect(createChatSessionMock).not.toHaveBeenCalled();
    expect(appendChatMessageMock).toHaveBeenCalledWith('existing-session', 'USER', 'segundo mensaje');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'existing-session' }));
  });

  it('AC8: a persistence failure never blocks the reply', async () => {
    createChatSessionMock.mockRejectedValue(new Error('knowledge-store unreachable'));
    const { inquireController } = await import('./inquireController.js');

    const req = { body: { messages: [{ role: 'user', content: 'hola' }] } } as Request;
    const res = fakeRes();

    await inquireController(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: { role: 'assistant', content: 'listo' } }),
    );
  });

  it('returns a 500 and disconnects the runtime when the graph throws', async () => {
    runReasoningGraphMock.mockRejectedValue(new Error('graph blew up'));
    const { inquireController } = await import('./inquireController.js');
    const { disconnectGraphRuntime } = await import('../graph/graphRuntime.js');

    const req = { body: { messages: [{ role: 'user', content: 'hola' }] } } as Request;
    const res = fakeRes();

    await inquireController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(disconnectGraphRuntime).toHaveBeenCalled();
  });
});

describe('inquireStatusController (live-status amendment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current label for a known requestId', async () => {
    getInquireStatusMock.mockReturnValue({ label: 'pensando…', partialText: '', updatedAt: Date.now() });
    const { inquireStatusController } = await import('./inquireController.js');

    const req = { params: { requestId: 'r1' } } as unknown as Request;
    const res = fakeRes();

    inquireStatusController(req, res);

    expect(res.json).toHaveBeenCalledWith({ label: 'pensando…', partialText: '' });
  });

  it('returns label: null for an unknown or already-finished requestId', async () => {
    getInquireStatusMock.mockReturnValue(null);
    const { inquireStatusController } = await import('./inquireController.js');

    const req = { params: { requestId: 'unknown' } } as unknown as Request;
    const res = fakeRes();

    inquireStatusController(req, res);

    expect(res.json).toHaveBeenCalledWith({ label: null, partialText: '' });
  });

  it('2026-09-18 addendum: forwards partialText as the final answer streams in', async () => {
    getInquireStatusMock.mockReturnValue({ label: 'pensando…', partialText: 'Hola, Fel', updatedAt: Date.now() });
    const { inquireStatusController } = await import('./inquireController.js');

    const req = { params: { requestId: 'r1' } } as unknown as Request;
    const res = fakeRes();

    inquireStatusController(req, res);

    expect(res.json).toHaveBeenCalledWith({ label: 'pensando…', partialText: 'Hola, Fel' });
  });
});
