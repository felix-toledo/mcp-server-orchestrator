import { describe, expect, it } from 'vitest';
import { joinFrontmatter, splitFrontmatter } from './frontmatter';

describe('frontmatter split/join', () => {
  it('splits YAML frontmatter from the body', () => {
    const raw = '---\ntitle: Mi nota\ncreatedAt: 2026-09-17\n---\n\n# Contenido\n\nTexto.';
    const { frontmatter, body } = splitFrontmatter(raw);

    expect(frontmatter).toBe('---\ntitle: Mi nota\ncreatedAt: 2026-09-17\n---\n\n');
    expect(body).toBe('# Contenido\n\nTexto.');
  });

  it('returns an empty frontmatter when the note has none', () => {
    const raw = '# Sin frontmatter';
    const { frontmatter, body } = splitFrontmatter(raw);

    expect(frontmatter).toBe('');
    expect(body).toBe('# Sin frontmatter');
  });

  it('round-trips split -> join back to the original content', () => {
    const raw = '---\ntitle: Mi nota\n---\n\nCuerpo editado.';
    const { frontmatter, body } = splitFrontmatter(raw);

    expect(joinFrontmatter(frontmatter, body)).toBe(raw);
  });
});
