export interface EmbeddingsProvider {
  embed(text: string): Promise<number[]>;
}

interface OpenAiEmbeddingsResponse {
  data: Array<{ embedding: number[] }>;
}

export class OpenAiEmbeddingsProvider implements EmbeddingsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI embeddings request failed (${response.status}): ${detail}`);
    }

    const body = (await response.json()) as OpenAiEmbeddingsResponse;
    return body.data[0].embedding;
  }
}
