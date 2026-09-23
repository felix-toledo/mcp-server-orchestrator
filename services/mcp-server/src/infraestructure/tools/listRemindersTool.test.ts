import { describe, expect, it, vi } from 'vitest';
import type { SchedulerClient } from '../http/schedulerClient.js';
import { registerListRemindersTool } from './listRemindersTool.js';
import { createFakeMcpServer } from './testHelpers.js';

function createClientMock() {
  return { listReminders: vi.fn() } as unknown as SchedulerClient;
}

describe('listRemindersTool', () => {
  it('AC7: returns the reminder list serialized as JSON text', async () => {
    const client = createClientMock();
    vi.mocked(client.listReminders).mockResolvedValue([
      { id: 'r1', actionDescription: 'x', scheduleType: 'ONCE', scheduledAt: null, cronExpression: null, active: true, lastFiredAt: null, lastDeliveryStatus: null },
    ]);

    const fake = createFakeMcpServer();
    registerListRemindersTool(fake.server, client);

    const result = (await fake.getHandler('listReminders')({})) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  it('returns an MCP tool error (not a thrown exception) when scheduler is unreachable', async () => {
    const client = createClientMock();
    vi.mocked(client.listReminders).mockRejectedValue(new Error('fetch failed'));

    const fake = createFakeMcpServer();
    registerListRemindersTool(fake.server, client);

    const result = (await fake.getHandler('listReminders')({})) as { isError?: boolean; content: Array<{ text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No pude listar los recordatorios/);
  });
});
