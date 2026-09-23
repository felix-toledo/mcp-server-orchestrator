import type { PrismaClient } from '@prisma/client';
import type { UserService } from './userService.js';

export interface TelegramLinkSummary {
  id: string;
  botToken: string;
  chatId: string | null;
  currentSessionId: string | null;
  allowedUsernames: string[];
}

function toSummary(link: {
  id: string;
  botToken: string;
  chatId: string | null;
  currentSessionId: string | null;
  allowedUsernames: unknown;
}): TelegramLinkSummary {
  return {
    id: link.id,
    botToken: link.botToken,
    chatId: link.chatId,
    currentSessionId: link.currentSessionId,
    allowedUsernames: (link.allowedUsernames as string[] | null) ?? [],
  };
}

/** No leading @, case-insensitive — Telegram usernames aren't case-sensitive. */
function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, '').toLowerCase();
}

export class TelegramLinkService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly userService: UserService,
  ) {}

  /**
   * AC1 — sets/replaces the bot token. spec §5.2: rotating the token is
   * assumed to just restart polling with the new one, not reset the
   * existing binding — `chatId`/`currentSessionId` are preserved across an
   * update, only created empty (null) the first time this user links a bot.
   * `allowedUsernames` (2026-09-17 amendment — supersedes AC2's
   * first-contact binding): omit it to leave the existing list untouched,
   * pass an array (even `[]`) to replace it outright.
   */
  async upsert(botToken: string, allowedUsernames?: string[]): Promise<TelegramLinkSummary> {
    const user = await this.userService.getCurrent();
    if (!user) {
      throw new Error('Cannot link Telegram before onboarding');
    }

    const normalized = allowedUsernames?.map(normalizeUsername);
    const link = await this.prisma.telegramLink.upsert({
      where: { userId: user.id },
      create: { userId: user.id, botToken, allowedUsernames: normalized ?? [] },
      update: { botToken, ...(normalized ? { allowedUsernames: normalized } : {}) },
    });
    return toSummary(link);
  }

  async get(): Promise<TelegramLinkSummary | null> {
    const link = await this.prisma.telegramLink.findFirst();
    return link ? toSummary(link) : null;
  }

  /**
   * AC2/AC3/§3 — updates the bound chatId and/or the remembered session
   * pointer. `allowedUsernames` (2026-09-17 amendment) can also be edited
   * here — normalized the same way `upsert` does — specifically so the
   * Settings UI can change the allowlist without asking Felix to re-paste
   * the bot token it never had to begin with.
   */
  async updateBinding(fields: { chatId?: string; currentSessionId?: string; allowedUsernames?: string[] }): Promise<TelegramLinkSummary> {
    const existing = await this.prisma.telegramLink.findFirst();
    if (!existing) {
      throw new Error('No Telegram link configured yet');
    }

    const { allowedUsernames, ...rest } = fields;
    const link = await this.prisma.telegramLink.update({
      where: { id: existing.id },
      data: { ...rest, ...(allowedUsernames ? { allowedUsernames: allowedUsernames.map(normalizeUsername) } : {}) },
    });
    return toSummary(link);
  }
}
