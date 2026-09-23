import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheapLlmSummaryProvider } from './summaryProvider.js';

describe('CheapLlmSummaryProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('resolves with the trimmed model reply on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '  Un resumen breve.  ' } }] }), {
        status: 200,
      }),
    );

    const provider = new CheapLlmSummaryProvider('key', 'gpt-4o-mini');
    const result = await provider.summarize('contenido largo de la nota');

    expect(result).toBe('Un resumen breve.');
  });

  it('throws a descriptive error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('server exploded', { status: 500 }));
    const provider = new CheapLlmSummaryProvider('key', 'gpt-4o-mini');
    await expect(provider.summarize('contenido')).rejects.toThrow(/Summary model request failed \(500\)/);
  });

  it('propagates a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'));
    const provider = new CheapLlmSummaryProvider('key', 'gpt-4o-mini');
    await expect(provider.summarize('contenido')).rejects.toThrow('fetch failed');
  });
});
