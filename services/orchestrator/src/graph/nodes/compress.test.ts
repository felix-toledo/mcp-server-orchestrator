import { describe, expect, it, vi } from 'vitest';
import type { LlmMessage } from '../../llm/ILlmProvider.js';
import { createCompressNode } from './compress.js';
import type { PipelineState } from '../state.js';

function state(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    messages: [
      { role: 'user', content: 'hacé A, B y C' },
      { role: 'assistant', content: 'hice A' },
      { role: 'tool', content: '{"ok":true}', name: 'toolA', toolCallId: 't1' },
    ],
    ragTop20: [],
    rerankedTop5: [],
    profileNote: null,
    hasSufficientInfo: false,
    skillsToUse: [],
    isComplex: true,
    plan: undefined,
    iterationCount: 1,
    isFailing: false,
    maxIterations: 10,
    lastToolCallSignature: undefined,
    taskStatus: 'IN_PROGRESS',
    finalResponse: undefined,
    currentTeamId: undefined,
    requestId: undefined,
    delegationDepth: 0,
    ...overrides,
  };
}

describe('createCompressNode', () => {
  it('AC9: replaces messages with a summary + the last 2 messages', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'Hizo A, falta B y C.',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'Hizo A, falta B y C.' },
    });
    const node = createCompressNode({ smallLlmProvider: { generateResponse, getName: () => 'fake' } });

    const result = await node(state());

    const messages = result.messages as LlmMessage[];
    expect(messages).toHaveLength(3); // summary + last 2 of the original 3
    expect(messages[0].content).toContain('Hizo A, falta B y C.');
  });

  it('keeps the full transcript unchanged when the compressor call fails', async () => {
    const node = createCompressNode({
      smallLlmProvider: { generateResponse: vi.fn().mockRejectedValue(new Error('down')), getName: () => 'fake' },
    });

    await expect(node(state())).resolves.toEqual({});
  });
});
