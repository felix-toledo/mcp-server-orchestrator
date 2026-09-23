export interface CreateReminderInput {
  actionDescription: string;
  schedule: { type: 'once'; at: string } | { type: 'recurring'; cron: string };
}

export interface Reminder {
  id: string;
  actionDescription: string;
  scheduleType: 'ONCE' | 'RECURRING';
  scheduledAt: string | null;
  cronExpression: string | null;
  active: boolean;
  lastFiredAt: string | null;
  lastDeliveryStatus: 'DELIVERED' | 'FAILED' | null;
}

export class SchedulerClient {
  constructor(private readonly baseUrl: string) {}

  async createReminder(input: CreateReminderInput): Promise<Reminder> {
    const response = await fetch(`${this.baseUrl}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`scheduler request failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as Reminder;
  }

  async listReminders(): Promise<Reminder[]> {
    const response = await fetch(`${this.baseUrl}/reminders`);

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`scheduler request failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as Reminder[];
  }

  async deleteReminder(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/reminders/${id}`, { method: 'DELETE' });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`scheduler request failed (${response.status}): ${detail}`);
    }
  }
}
