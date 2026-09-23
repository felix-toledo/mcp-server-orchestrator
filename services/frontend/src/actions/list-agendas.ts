'use server';

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

export async function listAgendas(): Promise<Reminder[]> {
  const baseUrl = process.env.SCHEDULER_URL || 'http://localhost:30026';
  try {
    const response = await fetch(`${baseUrl}/reminders`, { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as Reminder[];
  } catch {
    return [];
  }
}
