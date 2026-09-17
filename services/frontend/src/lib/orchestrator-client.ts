export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
}

interface InquireResponse {
  success: boolean;
  message: ChatMessage;
}

export class OrchestratorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly kaaKey: string,
  ) {}

  async inquire(messages: ChatMessage[]): Promise<ChatMessage> {
    const response = await fetch(`${this.baseUrl}/api/inquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        KAA: this.kaaKey,
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`El orquestador respondió con un error (${response.status})`);
    }

    const body = (await response.json()) as InquireResponse;
    return body.message;
  }
}

export const orchestratorClient = new OrchestratorClient(
  process.env.ORCHESTRATOR_URL || 'http://localhost:30021',
  process.env.KEY_ALLOWED_AGENTS || '',
);
