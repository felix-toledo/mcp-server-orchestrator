import { describe, expect, it } from 'vitest';
import { McpClient } from './McpClient.js';

type SanitizeSchemaFn = (schema: Record<string, unknown>) => Record<string, unknown>;

function sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  return (McpClient as unknown as { sanitizeSchema: SanitizeSchemaFn }).sanitizeSchema(schema);
}

describe('McpClient.sanitizeSchema', () => {
  it('strips real JSON-Schema meta-keys', () => {
    const result = sanitizeSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      additionalProperties: false,
      properties: {},
    });

    expect(result).not.toHaveProperty('$schema');
    expect(result).not.toHaveProperty('additionalProperties');
  });

  it('never drops a property just because it is named like a meta-key (regression: createKnowledgeEntry\'s "title")', () => {
    const result = sanitizeSchema({
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['title', 'content'],
    });

    expect(result.properties).toHaveProperty('title');
    expect(result.properties).toHaveProperty('content');
  });

  it('still strips real meta-keys nested inside a property\'s own schema', () => {
    const result = sanitizeSchema({
      type: 'object',
      properties: {
        title: { type: 'string', default: 'untitled', title: 'Title' },
      },
    });

    const titleProperty = (result.properties as Record<string, unknown>).title as Record<string, unknown>;
    expect(titleProperty).not.toHaveProperty('default');
    expect(titleProperty).not.toHaveProperty('title');
    expect(titleProperty.type).toBe('string');
  });
});
