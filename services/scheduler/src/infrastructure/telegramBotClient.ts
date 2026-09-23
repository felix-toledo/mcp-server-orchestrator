/**
 * Thin HTTP client to telegram-bot/001-channel's `POST /push` (AC4 there).
 * Never throws — a delivery failure (telegram-bot down, no bound chat yet)
 * is reported back as `{ delivered: false }` so `ReminderService.handleFire`
 * can record it on the reminder row (AC4/AC5) instead of taking the whole
 * scheduler process down with it.
 */
export class TelegramBotClient {
  constructor(private readonly baseUrl: string) {}

  async push(text: string): Promise<{ delivered: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        return { delivered: false };
      }
      const body = (await response.json()) as { delivered?: boolean };
      return { delivered: body.delivered === true };
    } catch {
      return { delivered: false };
    }
  }
}
