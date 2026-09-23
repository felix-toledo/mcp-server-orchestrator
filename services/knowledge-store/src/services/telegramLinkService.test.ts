import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramLinkService } from './telegramLinkService.js';
import type { UserService } from './userService.js';

function createPrismaMock() {
  return {
    telegramLink: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('TelegramLinkService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let userService: { getCurrent: ReturnType<typeof vi.fn> };
  let service: TelegramLinkService;

  beforeEach(() => {
    prisma = createPrismaMock();
    userService = { getCurrent: vi.fn().mockResolvedValue({ id: 'user-1' }) };
    service = new TelegramLinkService(prisma as unknown as PrismaClient, userService as unknown as UserService);
  });

  describe('upsert', () => {
    it('AC1: creates a new link with a null chatId/currentSessionId the first time', async () => {
      prisma.telegramLink.upsert.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null, allowedUsernames: [] });

      const result = await service.upsert('abc');

      expect(prisma.telegramLink.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', botToken: 'abc', allowedUsernames: [] },
        update: { botToken: 'abc' },
      });
      expect(result.chatId).toBeNull();
    });

    it('spec §5.2: rotating the token preserves the existing chatId/currentSessionId binding', async () => {
      prisma.telegramLink.upsert.mockResolvedValue({ id: 't1', botToken: 'new-token', chatId: '12345', currentSessionId: 's1', allowedUsernames: ['felix'] });

      const result = await service.upsert('new-token');

      expect(prisma.telegramLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { botToken: 'new-token' } }),
      );
      expect(result.chatId).toBe('12345');
    });

    it('2026-09-17 amendment: normalizes usernames (strips leading @, lowercases) when replacing the allowlist', async () => {
      prisma.telegramLink.upsert.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null, allowedUsernames: ['felix'] });

      await service.upsert('abc', ['@Felix']);

      expect(prisma.telegramLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ allowedUsernames: ['felix'] }),
          update: expect.objectContaining({ allowedUsernames: ['felix'] }),
        }),
      );
    });

    it('does not touch allowedUsernames when omitted (token-only rotation)', async () => {
      prisma.telegramLink.upsert.mockResolvedValue({ id: 't1', botToken: 'new-token', chatId: null, currentSessionId: null, allowedUsernames: ['felix'] });

      await service.upsert('new-token');

      expect(prisma.telegramLink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { botToken: 'new-token' } }),
      );
    });

    it('throws when no user has completed onboarding yet', async () => {
      userService.getCurrent.mockResolvedValue(null);
      await expect(service.upsert('abc')).rejects.toThrow(/onboarding/);
    });
  });

  describe('get', () => {
    it('returns null when no link is configured yet (AC1 "runs, does nothing" case)', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue(null);
      await expect(service.get()).resolves.toBeNull();
    });

    it('returns the configured link', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's1', allowedUsernames: ['felix'] });
      await expect(service.get()).resolves.toEqual({
        id: 't1',
        botToken: 'abc',
        chatId: '12345',
        currentSessionId: 's1',
        allowedUsernames: ['felix'],
      });
    });
  });

  describe('updateBinding', () => {
    it('AC2: sets chatId on first-contact binding', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue({ id: 't1' });
      prisma.telegramLink.update.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: null });

      const result = await service.updateBinding({ chatId: '12345' });

      expect(prisma.telegramLink.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { chatId: '12345' } });
      expect(result.chatId).toBe('12345');
    });

    it('§3: updates the remembered session pointer', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue({ id: 't1' });
      prisma.telegramLink.update.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: '12345', currentSessionId: 's2' });

      await service.updateBinding({ currentSessionId: 's2' });

      expect(prisma.telegramLink.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { currentSessionId: 's2' } });
    });

    it('throws when no link is configured yet', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue(null);
      await expect(service.updateBinding({ chatId: '12345' })).rejects.toThrow(/No Telegram link configured/);
    });

    it('2026-09-17 amendment: normalizes and replaces allowedUsernames without needing the token', async () => {
      prisma.telegramLink.findFirst.mockResolvedValue({ id: 't1' });
      prisma.telegramLink.update.mockResolvedValue({ id: 't1', botToken: 'abc', chatId: null, currentSessionId: null, allowedUsernames: ['felix'] });

      await service.updateBinding({ allowedUsernames: ['@Felix'] });

      expect(prisma.telegramLink.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { allowedUsernames: ['felix'] } });
    });
  });
});
