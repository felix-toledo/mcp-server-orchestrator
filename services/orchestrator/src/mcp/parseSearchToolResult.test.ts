import { describe, expect, it } from 'vitest';
import { parseSearchToolResult } from './parseSearchToolResult.js';

function toolResult(text: string, isError = false) {
  return { isError, content: [{ type: 'text', text }] };
}

describe('parseSearchToolResult', () => {
  it('parses a well-formed result array', () => {
    const rows = [{ id: 'k1', path: 'a.md', title: 'A', summary: 's', similarity: 0.9, type: 'entry' }];
    expect(parseSearchToolResult(toolResult(JSON.stringify(rows)))).toEqual(rows);
  });

  it('returns [] for an MCP tool error result', () => {
    expect(parseSearchToolResult(toolResult('No pude buscar', true))).toEqual([]);
  });

  it('returns [] for malformed JSON', () => {
    expect(parseSearchToolResult(toolResult('not json'))).toEqual([]);
  });

  it('returns [] for a missing/undefined result', () => {
    expect(parseSearchToolResult(undefined)).toEqual([]);
    expect(parseSearchToolResult(null)).toEqual([]);
  });

  it('filters out entries missing required fields', () => {
    const rows = [{ id: 'k1' }, { id: 'k2', path: 'b.md', title: 'B', summary: 's' }];
    expect(parseSearchToolResult(toolResult(JSON.stringify(rows)))).toEqual([rows[1]]);
  });
});
