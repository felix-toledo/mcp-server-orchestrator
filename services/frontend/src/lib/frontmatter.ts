const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n\n?/;

export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { frontmatter: '', body: raw };
  }
  return { frontmatter: match[0], body: raw.slice(match[0].length) };
}

export function joinFrontmatter(frontmatter: string, body: string): string {
  return `${frontmatter}${body}`;
}
