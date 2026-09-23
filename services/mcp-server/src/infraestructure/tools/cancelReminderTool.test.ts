import { describe, expect, it, vi } from 'vitest';
import type { SchedulerClient } from '../http/schedulerClient.js';
import { registerCancelReminderTool } from './cancelReminderTool.js';
import { createFakeMcpServer } from './testHelpers.js';

function createClientMock() {
  return { deleteReminder: vi.fn() } as unknown as SchedulerClient;
}

describe('cancelReminderTool', () => {
  it('AC7: cancels the reminder by id and returns a confirmation', async () => {
    const client = createClientMock();
    vi.mocked(client.deleteReminder).mockResolvedValue(undefined);

    const fake = createFakeMcpServer();
    registerCancelReminderTool(fake.server, client);

    const result = (await fake.getHandler('cancelReminder')({ id: 'r1' })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('r1');
    expect(client.deleteReminder).toHaveBeenCalledWith('r1');
  });

  it('returns an MCP tool error (not a thrown exception) when the reminder does not exist', async () => {
    const client = createClientMock();
    vi.mocked(client.deleteReminder).mockRejectedValue(new Error('scheduler request failed (404): not found'));

    const fake = createFakeMcpServer();
    registerCancelReminderTool(fake.server, client);

    const result = (await fake.getHandler('cancelReminder')({ id: 'missing' })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No pude cancelar el recordatorio/);
  });
});
