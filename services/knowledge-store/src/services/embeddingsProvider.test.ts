import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAiEmbeddingsProvider } from './embeddingsProvider.js';

describe('OpenAiEmbeddingsProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns the embedding vector for the given text', async () => {
    const vector = new Array(1536).fill(0.01);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [{ embedding: vector }] }), { status: 200 }),
    );

    const provider = new OpenAiEmbeddingsProvider('sk-test', 'text-embedding-3-small');
    const result = await provider.embed('hola mundo');

    expect(result).toEqual(vector);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });

  it('propagates a failure when the API call is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('bad request', { status: 400 }));

    const provider = new OpenAiEmbeddingsProvider('sk-test', 'text-embedding-3-small');

    await expect(provider.embed('hola')).rejects.toThrow(/OpenAI embeddings request failed/);
  });
});
