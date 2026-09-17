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

  it('AC1/AC3: returns the orchestrator reply on success', async () => {
    inquireMock.mockResolvedValue({ role: 'assistant', content: 'Nota "Mi nota" guardada.' });

    const result = await sendChatMessage([{ role: 'user', content: 'guardá esto' }]);

    expect(result.content).toBe('Nota "Mi nota" guardada.');
  });

  it('AC4: turns a thrown error into a graceful assistant message', async () => {
    inquireMock.mockRejectedValue(new Error('El orquestador respondió con un error (500)'));

    const result = await sendChatMessage([{ role: 'user', content: 'hola' }]);

    expect(result.role).toBe('assistant');
    expect(result.content).toMatch(/No pude procesar/);
  });
});
