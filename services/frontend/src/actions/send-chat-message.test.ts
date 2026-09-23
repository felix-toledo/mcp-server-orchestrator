import { beforeEach, describe, expect, it, vi } from 'vitest';

const { inquireMock } = vi.hoisted(() => ({ inquireMock: vi.fn() }));

vi.mock('../lib/orchestrator-client', () => ({
  orchestratorClient: { inquire: inquireMock },
}));

import { sendChatMessage } from './send-chat-message';

describe('sendChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC1/AC3: returns the orchestrator reply and sessionId on success', async () => {
    inquireMock.mockResolvedValue({
      message: { role: 'assistant', content: 'Nota "Mi nota" guardada.' },
      sessionId: 's1',
    });

    const result = await sendChatMessage([{ role: 'user', content: 'guardá esto' }]);

    expect(result.message.content).toBe('Nota "Mi nota" guardada.');
    expect(result.sessionId).toBe('s1');
  });

  it('passes the given sessionId through to the orchestrator client', async () => {
    inquireMock.mockResolvedValue({ message: { role: 'assistant', content: 'ok' }, sessionId: 's1' });

    await sendChatMessage([{ role: 'user', content: 'segundo mensaje' }], 's1');

    expect(inquireMock).toHaveBeenCalledWith([{ role: 'user', content: 'segundo mensaje' }], 's1', undefined, undefined);
  });

  it('forwards requestId to the orchestrator client (live-status amendment)', async () => {
    inquireMock.mockResolvedValue({ message: { role: 'assistant', content: 'ok' }, sessionId: 's1' });

    await sendChatMessage([{ role: 'user', content: 'hola' }], undefined, 'r1');

    expect(inquireMock).toHaveBeenCalledWith([{ role: 'user', content: 'hola' }], undefined, undefined, 'r1');
  });

  it('AC4: turns a thrown error into a graceful assistant message, keeps the sessionId', async () => {
    inquireMock.mockRejectedValue(new Error('El orquestador respondió con un error (500)'));

    const result = await sendChatMessage([{ role: 'user', content: 'hola' }], 's1');

    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toMatch(/No pude procesar/);
    expect(result.sessionId).toBe('s1');
  });
});
