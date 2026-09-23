import { describe, expect, it } from 'vitest';
import { stripFrontmatter } from './stripFrontmatter.js';

describe('stripFrontmatter', () => {
  it('removes a leading YAML frontmatter block', () => {
    const markdown = '---\ntitle: Perfil\ncreatedAt: 2026-09-18T00:00:00.000Z\n---\n\n# Perfil\n\n- Mi novia: Melisa\n';
    expect(stripFrontmatter(markdown)).toBe('# Perfil\n\n- Mi novia: Melisa');
  });

  it('returns the content unchanged when there is no frontmatter', () => {
    expect(stripFrontmatter('# Perfil\n\n- Mi novia: Melisa')).toBe('# Perfil\n\n- Mi novia: Melisa');
  });
});
