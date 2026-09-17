import { describe, expect, it } from 'vitest';
import { slugify } from './slugify.js';

describe('slugify', () => {
  it('lowercases and replaces spaces/punctuation with dashes', () => {
    expect(slugify('Ideas para el TFG')).toBe('ideas-para-el-tfg');
  });

  it('strips accents', () => {
    expect(slugify('Reunión de mañana')).toBe('reunion-de-manana');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify('  ¡Hola!  ')).toBe('hola');
  });

  it('falls back to a default when nothing alphanumeric remains', () => {
    expect(slugify('¿¿¿???')).toBe('nota');
  });
});
