import { describe, expect, it, vi } from 'vitest';
import { generateSummary } from './generateSummary.js';
import type { SummaryProvider } from './summaryProvider.js';

describe('generateSummary (knowledge-store/004 AC4)', () => {
  it('returns the LLM summary when the call succeeds', async () => {
    const provider: SummaryProvider = { summarize: vi.fn().mockResolvedValue('resumen del modelo') };
    const result = await generateSummary('contenido', provider, 200);
    expect(result).toBe('resumen del modelo');
  });

  it('falls back to plain-text truncation when the LLM call fails', async () => {
    const provider: SummaryProvider = { summarize: vi.fn().mockRejectedValue(new Error('model down')) };
    const result = await generateSummary('# Título\n\nContenido de la nota', provider, 200);
    expect(result).toBe('Título Contenido de la nota');
  });
});
