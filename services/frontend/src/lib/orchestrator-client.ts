export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
}

interface InquireResponse {
  success: boolean;
  message: ChatMessage;
  sessionId?: string;
}

export interface InquireResult {
  message: ChatMessage;
  sessionId?: string;
}

export class OrchestratorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly kaaKey: string,
  ) {}

  /**
   * team-chat amendment (orchestrator/003-teams) — `teamId` routes
   * straight to that team's coordinator. Live-status amendment —
   * `requestId`, when given, lets the caller poll `getInquireStatus`
   * for this exact in-flight request while this call is still pending.
   */
  async inquire(messages: ChatMessage[], sessionId?: string, teamId?: string, requestId?: string): Promise<InquireResult> {
    const response = await fetch(`${this.baseUrl}/api/inquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        KAA: this.kaaKey,
      },
      body: JSON.stringify({ messages, sessionId, teamId, requestId }),
    });

    if (!response.ok) {
      throw new Error(`El orquestador respondió con un error (${response.status})`);
    }

    const body = (await response.json()) as InquireResponse;
    return { message: body.message, sessionId: body.sessionId };
  }

  /**
   * Live-status amendment — `label: null` means finished, unknown, or never
   * started. Fails open, never throws. `partialText` (2026-09-18 web
   * live-typing addendum) carries the final answer as it streams in;
   * `''` until streaming starts or when the active provider doesn't
   * support it.
   */
  async getInquireStatus(requestId: string): Promise<{ label: string | null; partialText: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/inquire/status/${requestId}`, {
        headers: { KAA: this.kaaKey },
        cache: 'no-store',
      });
      if (!response.ok) {
        return { label: null, partialText: '' };
      }
      return (await response.json()) as { label: string | null; partialText: string };
    } catch {
      return { label: null, partialText: '' };
    }
  }
}

export const orchestratorClient = new OrchestratorClient(
  process.env.ORCHESTRATOR_URL || 'http://localhost:30021',
  process.env.KEY_ALLOWED_AGENTS || '',
);
