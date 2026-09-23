const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n\n?/;

export function stripFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER_PATTERN, '').trim();
}
