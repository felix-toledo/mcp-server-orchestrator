import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestratorClient } from './orchestrator-client';

describe('OrchestratorClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends the KAA header and the message history', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: { role: 'assistant', content: 'hola' } }), {
        status: 200,
      }),
    );
    const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

    const result = await client.inquire([{ role: 'user', content: 'hola' }]);

    expect(result.content).toBe('hola');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30021/api/inquire',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ KAA: 'secret-key' }),
      }),
    );
  });

  it('throws when the orchestrator responds with a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

    await expect(client.inquire([{ role: 'user', content: 'hola' }])).rejects.toThrow(/error/);
  });
});
