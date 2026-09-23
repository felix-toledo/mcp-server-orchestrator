import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SchedulerClient } from './schedulerClient.js';

describe('SchedulerClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('createReminder posts the input and resolves with the created reminder', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'r1', actionDescription: 'x' }), { status: 201 }));

    const client = new SchedulerClient('http://localhost:30026');
    const result = await client.createReminder({ actionDescription: 'x', schedule: { type: 'once', at: '2026-09-18T09:00:00.000Z' } });

    expect(result.id).toBe('r1');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:30026/reminders',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('createReminder throws a descriptive error on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('bad cron', { status: 400 }));
    const client = new SchedulerClient('http://localhost:30026');
    await expect(
      client.createReminder({ actionDescription: 'x', schedule: { type: 'recurring', cron: 'bogus' } }),
    ).rejects.toThrow(/scheduler request failed \(400\)/);
  });

  it('listReminders resolves with the list on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 'r1' }]), { status: 200 }));
    const client = new SchedulerClient('http://localhost:30026');
    await expect(client.listReminders()).resolves.toEqual([{ id: 'r1' }]);
  });

  it('deleteReminder resolves on success', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const client = new SchedulerClient('http://localhost:30026');
    await expect(client.deleteReminder('r1')).resolves.toBeUndefined();
  });

  it('deleteReminder throws on a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));
    const client = new SchedulerClient('http://localhost:30026');
    await expect(client.deleteReminder('missing')).rejects.toThrow(/scheduler request failed \(404\)/);
  });
});
