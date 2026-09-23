import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestratorClient } from './orchestrator-client';

describe('OrchestratorClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends the KAA header and the message history, returns the message and sessionId', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, message: { role: 'assistant', content: 'hola' }, sessionId: 's1' }),
        { status: 200 },
      ),
    );
    const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

    const result = await client.inquire([{ role: 'user', content: 'hola' }]);

    expect(result.message.content).toBe('hola');
    expect(result.sessionId).toBe('s1');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30021/api/inquire',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ KAA: 'secret-key' }),
      }),
    );
  });

  it('includes the given sessionId in the request body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: { role: 'assistant', content: 'ok' } }), {
        status: 200,
      }),
    );
    const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

    await client.inquire([{ role: 'user', content: 'hola' }], 'existing-session');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({ sessionId: 'existing-session' });
  });

  it('includes teamId in the request body when starting a team chat (team-chat amendment)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: { role: 'assistant', content: 'ok' } }), {
        status: 200,
      }),
    );
    const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

    await client.inquire([{ role: 'user', content: 'hola equipo' }], undefined, 't1');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({ teamId: 't1' });
  });

  it('includes requestId in the request body (live-status amendment)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: { role: 'assistant', content: 'ok' } }), {
        status: 200,
      }),
    );
    const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

    await client.inquire([{ role: 'user', content: 'hola' }], undefined, undefined, 'r1');

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({ requestId: 'r1' });
  });

  it('throws when the orchestrator responds with a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

    await expect(client.inquire([{ role: 'user', content: 'hola' }])).rejects.toThrow(/error/);
  });

  describe('getInquireStatus (live-status amendment)', () => {
    it('returns the current label on success', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ label: 'pensando…', partialText: '' }), { status: 200 }));
      const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

      await expect(client.getInquireStatus('r1')).resolves.toEqual({ label: 'pensando…', partialText: '' });
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:30021/api/inquire/status/r1',
        expect.objectContaining({ headers: expect.objectContaining({ KAA: 'secret-key' }) }),
      );
    });

    it('2026-09-18 addendum: returns partialText as the final answer streams in', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ label: 'pensando…', partialText: 'Hola, Fel' }), { status: 200 }),
      );
      const client = new OrchestratorClient('http://localhost:30021', 'secret-key');

      await expect(client.getInquireStatus('r1')).resolves.toEqual({ label: 'pensando…', partialText: 'Hola, Fel' });
    });

    it('fails open to { label: null, partialText: "" } on a non-2xx status or a network error, never throws', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
      const client = new OrchestratorClient('http://localhost:30021', 'secret-key');
      await expect(client.getInquireStatus('r1')).resolves.toEqual({ label: null, partialText: '' });

      vi.mocked(fetch).mockRejectedValue(new Error('network down'));
      await expect(client.getInquireStatus('r1')).resolves.toEqual({ label: null, partialText: '' });
    });
  });
});
