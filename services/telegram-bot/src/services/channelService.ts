import { randomUUID } from 'node:crypto';
import type { KnowledgeStoreClient, StoredChatMessage } from '../infrastructure/knowledgeStoreClient.js';
import type { ChatMessage, OrchestratorClient } from '../infrastructure/orchestratorClient.js';

const ROLE_MAP: Record<StoredChatMessage['role'], ChatMessage['role']> = {
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
};

/**
 * plan.md §2's constructor only lists `knowledgeStoreClient`/`orchestratorClient`,
 * but `pushMessage`'s own doc text says it "sends via the grammy bot
 * instance directly" — that requires some reference to the bot, which the
 * plan's signature omits. Found during implementation, not silently
 * papered over: a `TelegramSender` interface (implemented by
 * `bot/telegramBot.ts`'s wrapper) is injected as a third dependency
 * instead. It's an interface, not a raw `grammy` `Bot`, so `ChannelService`
 * stays testable without a real bot instance and doesn't go stale across a
 * `/config`-triggered bot rebuild (the wrapper's own reference is what gets
 * swapped, not this one).
 */
export interface TelegramSender {
  /** Live-status amendment — returns the sent message's id so it can be edited in place as work progresses. */
  sendMessage(chatId: string, text: string): Promise<{ messageId: number }>;
  editMessage(chatId: string, messageId: number, text: string): Promise<void>;
}

const STATUS_POLL_INTERVAL_MS = 2000;
const INITIAL_STATUS_LABEL = 'pensando…';
const FALLBACK_FINAL_TEXT = 'listo.';

export class ChannelService {
  constructor(
    private readonly knowledgeStoreClient: KnowledgeStoreClient,
    private readonly orchestratorClient: OrchestratorClient,
    private readonly telegramSender: TelegramSender,
  ) {}

  /**
   * AC2 amended 2026-09-17 — plain first-contact binding (whoever messages
   * first, no matter who) was replaced with an explicit username allowlist
   * Felix configures in Settings: `resolveBoundChat` now needs the
   * incoming message's Telegram `username` too. An empty/unconfigured
   * allowlist fails closed — nobody gets bound, not even the first
   * message — matching "solo puede hablar los que yo configuro."
   * Once a `chatId` is already bound, behavior is unchanged: only that
   * exact chat continues, regardless of username (a bound chat_id, unlike
   * a bare username claim, is already proven).
   */
  async resolveBoundChat(incomingChatId: string, incomingUsername: string | undefined): Promise<{ isBound: boolean }> {
    const link = await this.knowledgeStoreClient.getTelegramLink();
    if (!link) {
      return { isBound: false };
    }
    if (link.chatId) {
      return { isBound: link.chatId === incomingChatId };
    }

    const normalized = incomingUsername?.toLowerCase();
    const isAllowed = Boolean(normalized) && link.allowedUsernames.includes(normalized!);
    if (!isAllowed) {
      return { isBound: false };
    }

    await this.knowledgeStoreClient.updateTelegramLinkBinding({ chatId: incomingChatId });
    return { isBound: true };
  }

  /**
   * AC3/§3 — forwards to orchestrator with the remembered session, updates
   * the pointer if it changed. Real bug found live (2026-09-17):
   * `orchestrator`'s `/api/inquire` never reloads history from `sessionId`
   * itself — that field is only for `knowledge-store` persistence/
   * bookkeeping, the *caller* is expected to resend the whole conversation
   * every time (exactly what `frontend`'s own chat client already does).
   * Sending only the latest message here meant the LLM had no memory of
   * anything said before, including a reminder `pushMessage` had just
   * delivered into this same session. Fixed by loading the session's full
   * history first and sending it all.
   *
   * Live-status amendment (2026-09-18) — Felix's ask, same one that drove
   * `orchestrator`'s own web polling: "quiero ir viendo qué está haciendo",
   * but Telegram has no separate status channel like the web app's
   * `ChatPanel` does — a plain text message is the only surface available.
   * So this sends a placeholder immediately and edits that same message in
   * place as the reasoning graph's node-by-node status changes (reusing
   * `orchestrator`'s existing `requestId`/`GET /api/inquire/status/:id`
   * mechanism, not a new one), landing on the real answer as its last edit.
   * `handleIncomingMessage` now owns delivery end to end — the caller
   * (`telegramBot.ts`) no longer replies itself.
   */
  async handleIncomingMessage(chatId: string, text: string): Promise<string> {
    const link = await this.knowledgeStoreClient.getTelegramLink();
    const sessionId = link?.currentSessionId ?? undefined;

    const history = sessionId ? await this.knowledgeStoreClient.getChatSessionMessages(sessionId) : [];
    const messages: ChatMessage[] = [
      ...history.map((m) => ({ role: ROLE_MAP[m.role], content: m.content })),
      { role: 'user' as const, content: text },
    ];

    const requestId = randomUUID();
    const { messageId } = await this.telegramSender.sendMessage(chatId, INITIAL_STATUS_LABEL);
    const stopPolling = this.pollStatusInto(chatId, messageId, requestId);

    let result;
    try {
      result = await this.orchestratorClient.inquire(messages, sessionId, requestId);
    } finally {
      stopPolling();
    }

    if (result.sessionId && result.sessionId !== sessionId) {
      await this.knowledgeStoreClient.updateTelegramLinkBinding({ currentSessionId: result.sessionId });
    }

    const finalText = result.message.content ?? '';
    await this.telegramSender.editMessage(chatId, messageId, finalText || FALLBACK_FINAL_TEXT).catch(() => {});
    return finalText;
  }

  /**
   * Polls the same `GET /api/inquire/status/:requestId` the web app's
   * `ChatPanel` already uses, editing `messageId` only when the label
   * actually changes — Telegram rejects an edit whose text is identical to
   * what's already there, and re-editing every 2s otherwise would burn
   * through Telegram's per-chat rate limit for no visible benefit. Returns
   * a stop function instead of the interval handle so the caller never
   * touches `setInterval`/`clearInterval` directly.
   */
  private pollStatusInto(chatId: string, messageId: number, requestId: string): () => void {
    let lastLabel: string | null = null;
    const interval = setInterval(() => {
      this.orchestratorClient.getInquireStatus(requestId).then((label) => {
        if (label && label !== lastLabel) {
          lastLabel = label;
          this.telegramSender.editMessage(chatId, messageId, label).catch(() => {});
        }
      });
    }, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }

  /**
   * AC4 — no LLM call (scheduler/001-agendas §7.1's rule extends here):
   * sends the literal text directly, then logs it into the shared session
   * so it shows up in the web UI too. Fail-open on the log step — a
   * delivered reminder must never look undelivered to the caller just
   * because the follow-up logging call happened to fail.
   */
  async pushMessage(text: string): Promise<{ delivered: boolean }> {
    const link = await this.knowledgeStoreClient.getTelegramLink();
    if (!link?.chatId) {
      return { delivered: false };
    }

    try {
      await this.telegramSender.sendMessage(link.chatId, text);
    } catch {
      return { delivered: false };
    }

    if (link.currentSessionId) {
      await this.knowledgeStoreClient.appendChatMessage(link.currentSessionId, 'ASSISTANT', text).catch(() => {});
    }

    return { delivered: true };
  }
}
