import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestratorClient } from './orchestratorClient.js';

describe('OrchestratorClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('AC3: posts messages + sessionId with the KAA header and resolves with the reply', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: { role: 'assistant', content: 'hola' }, sessionId: 's1' }), { status: 200 }),
    );

    const client = new OrchestratorClient('http://localhost:30021', 'secret');
    const result = await client.inquire([{ role: 'user', content: 'hola' }], 's0');

    expect(result).toEqual({ message: { role: 'assistant', content: 'hola' }, sessionId: 's1' });
    expect(fetch).toHaveBeenCalledWith('http://localhost:30021/api/inquire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', KAA: 'secret' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }], sessionId: 's0' }),
    });
  });

  it('throws a descriptive error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 500 }));
    const client = new OrchestratorClient('http://localhost:30021', 'secret');
    await expect(client.inquire([{ role: 'user', content: 'hola' }])).rejects.toThrow(/orchestrator request failed \(500\)/);
  });

  it('live-status amendment: forwards requestId in the body when given', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: true, message: { role: 'assistant', content: 'hola' } }), { status: 200 }),
    );
    const client = new OrchestratorClient('http://localhost:30021', 'secret');
    await client.inquire([{ role: 'user', content: 'hola' }], 's0', 'req-1');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30021/api/inquire',
      expect.objectContaining({ body: JSON.stringify({ messages: [{ role: 'user', content: 'hola' }], sessionId: 's0', requestId: 'req-1' }) }),
    );
  });

  describe('getInquireStatus (live-status amendment)', () => {
    it('resolves with the current label on success', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ label: 'pensando…' }), { status: 200 }));
      const client = new OrchestratorClient('http://localhost:30021', 'secret');
      await expect(client.getInquireStatus('req-1')).resolves.toBe('pensando…');
      expect(fetch).toHaveBeenCalledWith('http://localhost:30021/api/inquire/status/req-1', {
        headers: { KAA: 'secret' },
        cache: 'no-store',
      });
    });

    it('fails open to null on a non-2xx status or unreachable, never throws', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response('down', { status: 500 }));
      const client = new OrchestratorClient('http://localhost:30021', 'secret');
      await expect(client.getInquireStatus('req-1')).resolves.toBeNull();

      vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(client.getInquireStatus('req-1')).resolves.toBeNull();
    });
  });
});
