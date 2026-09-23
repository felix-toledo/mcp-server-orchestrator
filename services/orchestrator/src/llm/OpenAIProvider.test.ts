import { describe, expect, it, vi } from 'vitest';

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock('openai', () => ({
  default: class FakeOpenAI {
    chat = { completions: { create: createMock } };
  },
}));

import { OpenAIProvider } from './OpenAIProvider.js';

function fakeStream(chunks: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

describe('OpenAIProvider.streamResponse (2026-09-18 web live-typing addendum)', () => {
  it('emits each content delta via onChunk and accumulates the full text', async () => {
    createMock.mockResolvedValue(
      fakeStream([
        { choices: [{ delta: { content: 'Hola' }, finish_reason: null }] },
        { choices: [{ delta: { content: ', Felix' }, finish_reason: 'stop' }] },
      ]),
    );
    const provider = new OpenAIProvider('key', 'model');

    const chunks: string[] = [];
    const response = await provider.streamResponse([{ role: 'user', content: 'hola' }], undefined, (c) => chunks.push(c));

    expect(chunks).toEqual(['Hola', ', Felix']);
    expect(response.content).toBe('Hola, Felix');
    expect(response.finishReason).toBe('stop');
    expect(response.assistantMessage).toEqual({ role: 'assistant', content: 'Hola, Felix', toolCalls: undefined });
  });

  it('accumulates fragmented tool-call deltas by index (name whole, arguments streamed)', async () => {
    createMock.mockResolvedValue(
      fakeStream([
        {
          choices: [
            {
              delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'createKnowledgeEntry', arguments: '' } }] },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"title":' } }] }, finish_reason: null }],
        },
        {
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Nota"}' } }] }, finish_reason: 'tool_calls' }],
        },
      ]),
    );
    const provider = new OpenAIProvider('key', 'model');

    const response = await provider.streamResponse([{ role: 'user', content: 'guardá esto' }], [], () => {});

    expect(response.toolCalls).toEqual([{ id: 'call_1', name: 'createKnowledgeEntry', arguments: '{"title":"Nota"}' }]);
    expect(response.content).toBeNull();
    expect(response.finishReason).toBe('tool_calls');
  });

  it('never calls onChunk for a turn with no content deltas', async () => {
    createMock.mockResolvedValue(fakeStream([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]));
    const provider = new OpenAIProvider('key', 'model');

    const onChunk = vi.fn();
    await provider.streamResponse([{ role: 'user', content: 'hola' }], undefined, onChunk);

    expect(onChunk).not.toHaveBeenCalled();
  });
});
