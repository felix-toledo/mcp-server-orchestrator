import { beforeEach, describe, expect, it, vi } from 'vitest';

const { inquireMock } = vi.hoisted(() => ({ inquireMock: vi.fn() }));

vi.mock('../lib/orchestrator-client', () => ({
  orchestratorClient: { inquire: inquireMock },
}));

import { sendTeamChatMessage } from './send-team-chat-message';

describe('sendTeamChatMessage (team-chat amendment, orchestrator/003-teams)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the teamId (and sessionId, when given) to the orchestrator client', async () => {
    inquireMock.mockResolvedValue({ message: { role: 'assistant', content: 'listo' }, sessionId: 's1' });

    const result = await sendTeamChatMessage([{ role: 'user', content: 'hola equipo' }], 't1', 's0');

    expect(inquireMock).toHaveBeenCalledWith([{ role: 'user', content: 'hola equipo' }], 's0', 't1', undefined);
    expect(result.message.content).toBe('listo');
    expect(result.sessionId).toBe('s1');
  });

  it('forwards requestId to the orchestrator client (live-status amendment)', async () => {
    inquireMock.mockResolvedValue({ message: { role: 'assistant', content: 'listo' }, sessionId: 's1' });

    await sendTeamChatMessage([{ role: 'user', content: 'hola equipo' }], 't1', undefined, 'r1');

    expect(inquireMock).toHaveBeenCalledWith([{ role: 'user', content: 'hola equipo' }], undefined, 't1', 'r1');
  });

  it('turns a thrown error into a graceful assistant message, keeps the sessionId', async () => {
    inquireMock.mockRejectedValue(new Error('El orquestador respondió con un error (500)'));

    const result = await sendTeamChatMessage([{ role: 'user', content: 'hola' }], 't1', 's0');

    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toMatch(/No pude procesar/);
    expect(result.sessionId).toBe('s0');
  });
});
