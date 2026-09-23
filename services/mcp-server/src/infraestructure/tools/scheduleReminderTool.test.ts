import { describe, expect, it, vi } from 'vitest';
import type { SchedulerClient } from '../http/schedulerClient.js';
import { registerScheduleReminderTool } from './scheduleReminderTool.js';
import { createFakeMcpServer } from './testHelpers.js';

function createClientMock() {
  return { createReminder: vi.fn() } as unknown as SchedulerClient;
}

describe('scheduleReminderTool', () => {
  it('AC1/AC6: creates a ONCE reminder and returns a confirmation', async () => {
    const client = createClientMock();
    vi.mocked(client.createReminder).mockResolvedValue({
      id: 'r1',
      actionDescription: 'llamar al dentista',
      scheduleType: 'ONCE',
      scheduledAt: '2026-09-18T09:00:00.000Z',
      cronExpression: null,
      active: true,
      lastFiredAt: null,
      lastDeliveryStatus: null,
    });

    const fake = createFakeMcpServer();
    registerScheduleReminderTool(fake.server, client);

    const result = (await fake.getHandler('scheduleReminder')({
      actionDescription: 'llamar al dentista',
      schedule: { type: 'once', at: '2026-09-18T09:00:00.000Z' },
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('llamar al dentista');
    expect(client.createReminder).toHaveBeenCalledWith({
      actionDescription: 'llamar al dentista',
      schedule: { type: 'once', at: '2026-09-18T09:00:00.000Z' },
    });
  });

  it('AC1: creates a RECURRING reminder from a cron expression', async () => {
    const client = createClientMock();
    vi.mocked(client.createReminder).mockResolvedValue({
      id: 'r2',
      actionDescription: 'tomar agua',
      scheduleType: 'RECURRING',
      scheduledAt: null,
      cronExpression: '0 15 * * *',
      active: true,
      lastFiredAt: null,
      lastDeliveryStatus: null,
    });

    const fake = createFakeMcpServer();
    registerScheduleReminderTool(fake.server, client);

    await fake.getHandler('scheduleReminder')({
      actionDescription: 'tomar agua',
      schedule: { type: 'recurring', cron: '0 15 * * *' },
    });

    expect(client.createReminder).toHaveBeenCalledWith(
      expect.objectContaining({ schedule: { type: 'recurring', cron: '0 15 * * *' } }),
    );
  });

  it('returns an MCP tool error (not a thrown exception) when scheduler is unreachable', async () => {
    const client = createClientMock();
    vi.mocked(client.createReminder).mockRejectedValue(new Error('fetch failed'));

    const fake = createFakeMcpServer();
    registerScheduleReminderTool(fake.server, client);

    const result = (await fake.getHandler('scheduleReminder')({
      actionDescription: 'x',
      schedule: { type: 'once', at: '2026-09-18T09:00:00.000Z' },
    })) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No pude crear el recordatorio/);
  });
});
