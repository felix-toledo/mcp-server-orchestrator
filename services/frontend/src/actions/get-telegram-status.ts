'use server';

export interface TelegramStatus {
  configured: boolean;
  botUsername: string | null;
  chatId: string | null;
  allowedUsernames: string[];
}

const FAIL_OPEN_STATUS: TelegramStatus = { configured: false, botUsername: null, chatId: null, allowedUsernames: [] };

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const baseUrl = process.env.TELEGRAM_BOT_URL || 'http://localhost:30023';
  try {
    const response = await fetch(`${baseUrl}/status`, { cache: 'no-store' });
    if (!response.ok) {
      return FAIL_OPEN_STATUS;
    }
    return (await response.json()) as TelegramStatus;
  } catch {
    return FAIL_OPEN_STATUS;
  }
}
