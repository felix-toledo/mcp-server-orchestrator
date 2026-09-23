import { plainTextExcerpt } from './plainTextExcerpt.js';
import type { SummaryProvider } from './summaryProvider.js';

/**
 * knowledge-store/004 AC4: LLM summary first, plain-text truncation as the
 * fail-open fallback — never blocks a save because the cheap model is down.
 */
export async function generateSummary(
  content: string,
  summaryProvider: SummaryProvider,
  maxLength: number,
): Promise<string> {
  try {
    return await summaryProvider.summarize(content);
  } catch (error) {
    console.warn('⚠️ Resumen con LLM falló, uso truncado de texto plano:', error);
    return plainTextExcerpt(content, maxLength);
  }
}
