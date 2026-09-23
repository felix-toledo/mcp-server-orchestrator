import { Bot } from 'grammy';
import { createTelegramSender, startPolling, stopPolling } from '../bot/telegramBot.js';
import { ChannelService } from '../services/channelService.js';
import type { KnowledgeStoreClient } from '../infrastructure/knowledgeStoreClient.js';
import type { OrchestratorClient } from '../infrastructure/orchestratorClient.js';

/**
 * Owns the live `Bot`/`ChannelService` pair, which is genuinely dynamic —
 * AC1's "no token configured → runs, does nothing" plus §5.2's "a new
 * token via PUT /telegram-link just restarts polling with it" both mean
 * the bot instance can be absent, then built, then torn down and rebuilt.
 * Not in plan.md's own file tree — a natural composition-root need once
 * `/config` (rebuild) and `/push` (use whatever's currently live) both had
 * to reach the *same* live bot without holding a stale reference to it.
 */
export class TelegramRuntime {
  private bot: Bot | null = null;
  private channelService: ChannelService | null = null;

  constructor(
    private readonly knowledgeStoreClient: KnowledgeStoreClient,
    private readonly orchestratorClient: OrchestratorClient,
  ) {}

  async start(botToken: string): Promise<void> {
    if (this.bot) {
      await stopPolling(this.bot);
    }
    this.bot = new Bot(botToken);
    const sender = createTelegramSender(this.bot);
    this.channelService = new ChannelService(this.knowledgeStoreClient, this.orchestratorClient, sender);
    startPolling(this.bot, { channelService: this.channelService });
  }

  /** AC4 — fail-open: no bot configured yet is a normal "not delivered," not an error. */
  async push(text: string): Promise<{ delivered: boolean }> {
    if (!this.channelService) {
      return { delivered: false };
    }
    return this.channelService.pushMessage(text);
  }

  /**
   * Settings UX fix (2026-09-17) — the frontend was always showing an
   * empty "enter your token" form, even when one was already configured
   * and connected, and had no way to link/QR straight to the bot. `botInfo`
   * is a grammy getter that can throw if read before the bot's own `init()`
   * (triggered inside `start()`, not awaited here) has actually completed —
   * wrapped defensively, `null` just means "not ready yet," not an error.
   */
  getBotUsername(): string | null {
    try {
      return this.bot?.botInfo.username ?? null;
    } catch {
      return null;
    }
  }
}
