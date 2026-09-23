export interface SummaryProvider {
  summarize(content: string): Promise<string>;
}

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
}

const SYSTEM_PROMPT =
  'Resumí el siguiente contenido en 1-2 frases breves, en español, sin agregar nada que no esté en el texto.';

export class CheapLlmSummaryProvider implements SummaryProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async summarize(content: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Summary model request failed (${response.status}): ${detail}`);
    }

    const body = (await response.json()) as ChatCompletionResponse;
    return body.choices[0].message.content.trim();
  }
}
