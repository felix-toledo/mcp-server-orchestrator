/**
 * Direct HTTP client to knowledge-store — same ADR-0002 pattern
 * orchestrator's own client already established (chat-session bookkeeping,
 * never anything LLM-reasoning-shaped), this service's own use of it for
 * `TelegramLink` config/binding plus appending a pushed reminder to the
 * shared session (spec AC4).
 */
export interface TelegramLink {
  id: string;
  botToken: string;
  chatId: string | null;
  currentSessionId: string | null;
  allowedUsernames: string[];
}

export interface StoredChatMessage {
  role: 'USER' | 'ASSISTANT' | 'TOOL';
  content: string;
}

export class KnowledgeStoreClient {
  constructor(private readonly baseUrl: string) {}

  async getTelegramLink(): Promise<TelegramLink | null> {
    const response = await fetch(`${this.baseUrl}/telegram-link`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`knowledge-store request failed (${response.status}): ${await response.text()}`);
    }
    return (await response.json()) as TelegramLink;
  }

  async upsertTelegramLink(botToken: string, allowedUsernames?: string[]): Promise<TelegramLink> {
    const response = await fetch(`${this.baseUrl}/telegram-link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, ...(allowedUsernames ? { allowedUsernames } : {}) }),
    });
    if (!response.ok) {
      throw new Error(`knowledge-store request failed (${response.status}): ${await response.text()}`);
    }
    return (await response.json()) as TelegramLink;
  }

  async updateTelegramLinkBinding(fields: { chatId?: string; currentSessionId?: string }): Promise<TelegramLink> {
    const response = await fetch(`${this.baseUrl}/telegram-link`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!response.ok) {
      throw new Error(`knowledge-store request failed (${response.status}): ${await response.text()}`);
    }
    return (await response.json()) as TelegramLink;
  }

  /**
   * AC3/§3 — real bug found live (2026-09-17): `orchestrator`'s
   * `/api/inquire` does NOT reload history from `sessionId` server-side —
   * `sessionId` is only for `knowledge-store` bookkeeping/persistence.
   * The *caller* is expected to send the full conversation in `messages`
   * every time (this is what `frontend`'s `sendChatMessage` already does,
   * keeping the whole history client-side). `ChannelService` didn't do
   * this — it sent only the latest message — so the LLM had no idea a
   * reminder had just been pushed, or what was said earlier at all.
   */
  async getChatSessionMessages(sessionId: string): Promise<StoredChatMessage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/chat-sessions/${sessionId}`);
      if (!response.ok) {
        return [];
      }
      const body = (await response.json()) as { messages?: StoredChatMessage[] };
      return body.messages ?? [];
    } catch {
      return [];
    }
  }

  async appendChatMessage(sessionId: string, role: 'USER' | 'ASSISTANT' | 'TOOL', content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat-sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content }),
    });
    if (!response.ok) {
      throw new Error(`knowledge-store request failed (${response.status}): ${await response.text()}`);
    }
  }
}
