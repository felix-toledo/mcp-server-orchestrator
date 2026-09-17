import { describe, expect, it } from 'vitest';
import { plainTextExcerpt } from './plainTextExcerpt.js';

describe('plainTextExcerpt', () => {
  it('returns the text unchanged when shorter than the limit', () => {
    expect(plainTextExcerpt('hola mundo', 200)).toBe('hola mundo');
  });

  it('strips common Markdown syntax', () => {
    const markdown = '# Título\n\nEsto es **importante** y [un link](https://x.com).';
    expect(plainTextExcerpt(markdown, 200)).toBe('Título Esto es importante y un link.');
  });

  it('truncates at the limit and adds an ellipsis', () => {
    const long = 'a'.repeat(250);
    const result = plainTextExcerpt(long, 200);
    expect(result.length).toBe(201);
    expect(result.endsWith('…')).toBe(true);
  });
});
