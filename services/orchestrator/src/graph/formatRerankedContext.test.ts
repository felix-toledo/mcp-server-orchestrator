import { describe, expect, it } from 'vitest';
import { formatRerankedContext } from './formatRerankedContext.js';

describe('formatRerankedContext', () => {
  it('says nothing relevant was found for an empty array (AC4/AC6)', () => {
    expect(formatRerankedContext([])).toMatch(/no se encontró ninguna nota/);
  });

  it('formats title/summary bullets for non-empty results', () => {
    const context = formatRerankedContext([
      { id: 'k1', path: 'a.md', title: 'Fútbol', summary: 'Lunes 22hs', similarity: 0.6, type: 'entry', score: 0.9 },
    ]);
    expect(context).toContain('Fútbol: Lunes 22hs');
  });
});
