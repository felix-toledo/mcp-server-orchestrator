'use server';

export type SaveTelegramTokenResult = { ok: true } | { ok: false; error: string };

export async function saveTelegramToken(botToken: string, allowedUsernames?: string[]): Promise<SaveTelegramTokenResult> {
  const baseUrl = process.env.TELEGRAM_BOT_URL || 'http://localhost:30023';
  try {
    const response = await fetch(`${baseUrl}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, ...(allowedUsernames ? { allowedUsernames } : {}) }),
    });
    if (!response.ok) {
      return { ok: false, error: `El bot de Telegram respondió con un error (${response.status})` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo conectar con el bot de Telegram' };
  }
}
