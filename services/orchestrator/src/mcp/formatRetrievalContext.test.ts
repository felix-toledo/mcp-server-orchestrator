import { describe, expect, it } from 'vitest';
import { formatRetrievalContext } from './formatRetrievalContext.js';

function toolResult(text: string, isError = false) {
  return { isError, content: [{ type: 'text', text }] };
}

describe('formatRetrievalContext', () => {
  it('AC4/AC6: says nothing relevant was found for an empty array', () => {
    const context = formatRetrievalContext(toolResult(JSON.stringify([])));
    expect(context).toMatch(/no se encontró ninguna nota/);
  });

  it('formats title/summary pairs for a non-empty result', () => {
    const context = formatRetrievalContext(
      toolResult(
        JSON.stringify([
          { id: 'k1', path: 'a.md', title: 'Fútbol', summary: 'Juega los lunes a las 22hs', similarity: 0.9 },
          { id: 'k2', path: 'b.md', title: 'Nombre', summary: 'Se llama Emilio', similarity: 0.8 },
        ]),
      ),
    );

    expect(context).toContain('Fútbol: Juega los lunes a las 22hs');
    expect(context).toContain('Nombre: Se llama Emilio');
  });

  it('AC7: treats an MCP tool error result as "nothing found" instead of throwing', () => {
    const context = formatRetrievalContext(toolResult('No pude buscar en la bóveda: fetch failed', true));
    expect(context).toMatch(/no se encontró ninguna nota/);
  });

  it('treats malformed JSON as "nothing found"', () => {
    const context = formatRetrievalContext(toolResult('not json'));
    expect(context).toMatch(/no se encontró ninguna nota/);
  });

  it('treats a missing/undefined tool result as "nothing found"', () => {
    expect(formatRetrievalContext(undefined)).toMatch(/no se encontró ninguna nota/);
    expect(formatRetrievalContext(null)).toMatch(/no se encontró ninguna nota/);
  });
});
