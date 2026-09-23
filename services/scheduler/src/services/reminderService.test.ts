import { beforeEach, describe, expect, it, vi } from 'vitest';
import type PgBoss from 'pg-boss';
import { ReminderService } from './reminderService.js';
import type { PrismaClient } from '../infrastructure/prismaClient.js';
import type { TelegramBotClient } from '../infrastructure/telegramBotClient.js';

function createPrismaMock() {
  return {
    reminder: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

function createPgBossMock() {
  return {
    start: vi.fn(),
    createQueue: vi.fn(),
    deleteQueue: vi.fn().mockResolvedValue(undefined),
    work: vi.fn(),
    send: vi.fn(),
    schedule: vi.fn(),
    unschedule: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ReminderService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let pgBoss: ReturnType<typeof createPgBossMock>;
  let telegramBotClient: { push: ReturnType<typeof vi.fn> };
  let service: ReminderService;

  beforeEach(() => {
    prisma = createPrismaMock();
    pgBoss = createPgBossMock();
    telegramBotClient = { push: vi.fn().mockResolvedValue({ delivered: true }) };
    service = new ReminderService(
      prisma as unknown as PrismaClient,
      pgBoss as unknown as PgBoss,
      telegramBotClient as unknown as TelegramBotClient,
    );
  });

  describe('create', () => {
    it('AC1: a ONCE reminder registers the queue and a one-off send at the given time', async () => {
      prisma.reminder.create.mockImplementation(({ data }) => Promise.resolve(data));

      const result = await service.create({ actionDescription: 'llamar al dentista', schedule: { type: 'ONCE', at: '2026-09-18T09:00:00.000Z' } });

      expect(pgBoss.createQueue).toHaveBeenCalledWith(result.pgBossJobName);
      expect(pgBoss.work).toHaveBeenCalledWith(result.pgBossJobName, expect.any(Function));
      expect(pgBoss.send).toHaveBeenCalledWith(result.pgBossJobName, {}, { startAfter: '2026-09-18T09:00:00.000Z' });
      expect(pgBoss.schedule).not.toHaveBeenCalled();
      expect(result.pgBossJobName).toMatch(/^reminder:/);
    });

    it('AC1: a RECURRING reminder registers a cron schedule instead of a one-off send', async () => {
      prisma.reminder.create.mockImplementation(({ data }) => Promise.resolve(data));

      const result = await service.create({ actionDescription: 'tomar agua', schedule: { type: 'RECURRING', cron: '0 15 * * *' } });

      expect(pgBoss.schedule).toHaveBeenCalledWith(result.pgBossJobName, '0 15 * * *', {});
      expect(pgBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns every reminder, most recent first', async () => {
      prisma.reminder.findMany.mockResolvedValue([{ id: 'r1' }]);
      const result = await service.list();
      expect(result).toEqual([{ id: 'r1' }]);
      expect(prisma.reminder.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    });
  });

  describe('delete', () => {
    it('AC3: unschedules the pg-boss job, deletes the queue, and removes the row', async () => {
      prisma.reminder.findUniqueOrThrow.mockResolvedValue({ id: 'r1', pgBossJobName: 'reminder:r1' });

      await service.delete('r1');

      expect(pgBoss.unschedule).toHaveBeenCalledWith('reminder:r1');
      expect(pgBoss.deleteQueue).toHaveBeenCalledWith('reminder:r1');
      expect(prisma.reminder.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });

  describe('initialize', () => {
    it('starts pg-boss and re-registers a worker for every active reminder', async () => {
      prisma.reminder.findMany.mockResolvedValue([
        { id: 'r1', pgBossJobName: 'reminder:r1' },
        { id: 'r2', pgBossJobName: 'reminder:r2' },
      ]);

      await service.initialize();

      expect(pgBoss.start).toHaveBeenCalled();
      expect(prisma.reminder.findMany).toHaveBeenCalledWith({ where: { active: true } });
      expect(pgBoss.work).toHaveBeenCalledWith('reminder:r1', expect.any(Function));
      expect(pgBoss.work).toHaveBeenCalledWith('reminder:r2', expect.any(Function));
    });
  });

  describe('handleFire (via the registered work handler)', () => {
    async function fireHandler() {
      prisma.reminder.create.mockImplementation(({ data }) => Promise.resolve(data));
      const reminder = await service.create({ actionDescription: 'algo', schedule: { type: 'ONCE', at: '2026-01-01T00:00:00.000Z' } });
      const handler = pgBoss.work.mock.calls.find((call) => call[0] === reminder.pgBossJobName)![1] as () => Promise<void>;
      return { handler, id: reminder.id as string };
    }

    it('AC4: pushes the literal actionDescription with no LLM call, records DELIVERED on success', async () => {
      const { handler, id } = await fireHandler();
      prisma.reminder.findUnique.mockResolvedValue({ id, actionDescription: 'llamar al dentista' });
      telegramBotClient.push.mockResolvedValue({ delivered: true });

      await handler();

      expect(telegramBotClient.push).toHaveBeenCalledWith('llamar al dentista');
      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id },
        data: { lastFiredAt: expect.any(Date), lastDeliveryStatus: 'DELIVERED' },
      });
    });

    it('AC4/AC5: records FAILED and throws (so pg-boss retries) when delivery fails', async () => {
      const { handler, id } = await fireHandler();
      prisma.reminder.findUnique.mockResolvedValue({ id, actionDescription: 'llamar al dentista' });
      telegramBotClient.push.mockResolvedValue({ delivered: false });

      await expect(handler()).rejects.toThrow(/delivery failed/);

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id },
        data: { lastFiredAt: expect.any(Date), lastDeliveryStatus: 'FAILED' },
      });
    });

    it('AC5: does not throw when the reminder was deleted before it fired', async () => {
      const { handler } = await fireHandler();
      prisma.reminder.findUnique.mockResolvedValue(null);

      await expect(handler()).resolves.toBeUndefined();
      expect(telegramBotClient.push).not.toHaveBeenCalled();
    });
  });
});
