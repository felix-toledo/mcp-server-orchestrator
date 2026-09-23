/**
 * HTTP client for orchestrator's POST /api/inquire — mirrors
 * services/frontend's own `orchestrator-client.ts` (spec plan.md §1):
 * same request/response shape, this service just authenticates as a
 * different calling channel/agent (same KAA model, CLAUDE.md).
 */
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

  /** Live-status amendment — `requestId`, when given, lets the caller poll `getInquireStatus` while this is in flight. */
  async inquire(messages: ChatMessage[], sessionId?: string, requestId?: string): Promise<InquireResult> {
    const response = await fetch(`${this.baseUrl}/api/inquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        KAA: this.kaaKey,
      },
      body: JSON.stringify({ messages, sessionId, requestId }),
    });

    if (!response.ok) {
      throw new Error(`orchestrator request failed (${response.status}): ${await response.text()}`);
    }

    const body = (await response.json()) as InquireResponse;
    return { message: body.message, sessionId: body.sessionId };
  }

  /** Live-status amendment — `label: null` means finished, unknown, or never started. Fails open to null, never throws. */
  async getInquireStatus(requestId: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/inquire/status/${requestId}`, {
        headers: { KAA: this.kaaKey },
        cache: 'no-store',
      });
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as { label: string | null };
      return body.label;
    } catch {
      return null;
    }
  }
}
