'use server';

export type UpdateTelegramAllowlistResult = { ok: true } | { ok: false; error: string };

/**
 * Calls `knowledge-store` directly (ADR-0002-style, no LLM reasoning
 * involved) rather than `telegram-bot`'s `/config` — editing the allowlist
 * doesn't need to restart polling, and the frontend never has the raw bot
 * token to resend (`/status` deliberately never exposes it).
 */
export async function updateTelegramAllowlist(allowedUsernames: string[]): Promise<UpdateTelegramAllowlistResult> {
  const baseUrl = process.env.KNOWLEDGE_STORE_URL || 'http://localhost:30025';
  try {
    const response = await fetch(`${baseUrl}/telegram-link`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedUsernames }),
    });
    if (!response.ok) {
      return { ok: false, error: `knowledge-store respondió con un error (${response.status})` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}
