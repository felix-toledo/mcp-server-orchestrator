import { randomUUID } from 'node:crypto';
import type PgBoss from 'pg-boss';
import type { PrismaClient, Reminder } from '../infrastructure/prismaClient.js';
import type { TelegramBotClient } from '../infrastructure/telegramBotClient.js';

export interface CreateReminderInput {
  actionDescription: string;
  schedule: { type: 'ONCE'; at: string } | { type: 'RECURRING'; cron: string };
}

function jobNameFor(reminderId: string): string {
  return `reminder:${reminderId}`;
}

export class ReminderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pgBoss: PgBoss,
    private readonly telegramBotClient: TelegramBotClient,
  ) {}

  /**
   * Re-registers a `pg-boss` worker for every still-active reminder. A
   * queue's own schedule/pending job survives a process restart (it's
   * persisted in pg-boss's own Postgres tables) — the in-memory `work()`
   * handler registration does not, so without this, an already-due job
   * would sit in the queue with nobody consuming it.
   */
  async initialize(): Promise<void> {
    await this.pgBoss.start();
    const activeReminders = await this.prisma.reminder.findMany({ where: { active: true } });
    for (const reminder of activeReminders) {
      await this.registerWorker(reminder.id, reminder.pgBossJobName);
    }
  }

  /** AC1 — both ONCE and RECURRING; registers the pg-boss job, persists the row. */
  async create(input: CreateReminderInput): Promise<Reminder> {
    const id = randomUUID();
    const pgBossJobName = jobNameFor(id);

    const reminder = await this.prisma.reminder.create({
      data: {
        id,
        actionDescription: input.actionDescription,
        scheduleType: input.schedule.type,
        scheduledAt: input.schedule.type === 'ONCE' ? new Date(input.schedule.at) : null,
        cronExpression: input.schedule.type === 'RECURRING' ? input.schedule.cron : null,
        pgBossJobName,
      },
    });

    await this.pgBoss.createQueue(pgBossJobName);
    await this.registerWorker(id, pgBossJobName);

    if (input.schedule.type === 'ONCE') {
      await this.pgBoss.send(pgBossJobName, {}, { startAfter: input.schedule.at });
    } else {
      await this.pgBoss.schedule(pgBossJobName, input.schedule.cron, {});
    }

    return reminder;
  }

  /** AC2 */
  async list(): Promise<Reminder[]> {
    return this.prisma.reminder.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** AC3 — cancels the underlying pg-boss job (schedule + queue) and removes the row. */
  async delete(id: string): Promise<void> {
    const reminder = await this.prisma.reminder.findUniqueOrThrow({ where: { id } });
    await this.pgBoss.unschedule(reminder.pgBossJobName).catch(() => {});
    await this.pgBoss.deleteQueue(reminder.pgBossJobName).catch(() => {});
    await this.prisma.reminder.delete({ where: { id } });
  }

  private async registerWorker(reminderId: string, pgBossJobName: string): Promise<void> {
    await this.pgBoss.work(pgBossJobName, async () => {
      await this.handleFire(reminderId);
    });
  }

  /**
   * AC4/AC5 — no LLM call at fire time (§5.1): the literal actionDescription
   * is pushed as-is. Delivery status is recorded on every attempt (not only
   * once retries are exhausted) so the row never sits stale — a retry that
   * later succeeds overwrites FAILED with DELIVERED. Throwing on failure is
   * what makes pg-boss's own retry/backoff policy apply (AC5) — it isn't a
   * bug being swallowed, it's the retry signal pg-boss expects.
   */
  private async handleFire(reminderId: string): Promise<void> {
    const reminder = await this.prisma.reminder.findUnique({ where: { id: reminderId } });
    if (!reminder) {
      return; // deleted between the job firing and now
    }

    const { delivered } = await this.telegramBotClient.push(reminder.actionDescription);
    await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { lastFiredAt: new Date(), lastDeliveryStatus: delivered ? 'DELIVERED' : 'FAILED' },
    });

    if (!delivered) {
      throw new Error(`Reminder ${reminderId} delivery failed`);
    }
  }
}
