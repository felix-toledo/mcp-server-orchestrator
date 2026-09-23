import { describe, expect, it } from 'vitest';
import { formatProfileNoteContext } from './formatProfileNoteContext.js';

describe('formatProfileNoteContext', () => {
  it('returns undefined when there is no profile note yet', () => {
    expect(formatProfileNoteContext(null)).toBeUndefined();
  });

  it('formats the profile note content as internal context', () => {
    const result = formatProfileNoteContext('- Mi novia: Melisa');
    expect(result).toContain('- Mi novia: Melisa');
    expect(result).toContain('Perfil del usuario');
  });
});
