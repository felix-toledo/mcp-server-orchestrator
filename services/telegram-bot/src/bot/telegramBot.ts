import { Bot } from 'grammy';
import type { ChannelService, TelegramSender } from '../services/channelService.js';

/**
 * Thin adapter over grammy's polling loop — no dedicated test (plan.md §6,
 * a deliberate, permanent exception, same documented-gap pattern
 * mcp-server's tool files used before that service got full coverage).
 * All actual business logic (binding, forwarding, pushing) lives in
 * `ChannelService`, exercised there with a fake `TelegramSender` instead.
 */
export function createTelegramSender(bot: Bot): TelegramSender {
  return {
    async sendMessage(chatId: string, text: string): Promise<{ messageId: number }> {
      const sent = await bot.api.sendMessage(chatId, text);
      return { messageId: sent.message_id };
    },
    async editMessage(chatId: string, messageId: number, text: string): Promise<void> {
      await bot.api.editMessageText(chatId, messageId, text);
    },
  };
}

export function startPolling(bot: Bot, deps: { channelService: ChannelService }): void {
  bot.on('message:text', async (ctx) => {
    const chatId = String(ctx.chat.id);
    const { isBound } = await deps.channelService.resolveBoundChat(chatId, ctx.from?.username);
    if (!isBound) {
      return; // AC2 — silently drop, no reply, don't reveal a bot is listening
    }

    // Live-status amendment — handleIncomingMessage now owns delivery
    // itself (a placeholder message it edits in place as work progresses),
    // so there's nothing left to reply with here.
    await deps.channelService.handleIncomingMessage(chatId, ctx.message.text);
  });

  // grammy's start() only resolves once the bot stops — never await it here.
  bot.start().catch((error) => {
    console.error('❌ telegram-bot polling stopped unexpectedly:', error);
  });
}

export async function stopPolling(bot: Bot): Promise<void> {
  await bot.stop();
}
