import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LlmMessage, LlmToolDefinition } from '../../llm/ILlmProvider.js';
import type { SkillManager } from '../../skills/SkillManager.js';
import { createCallLlmNode } from './callLlm.js';
import { clearInquireStatus, getInquireStatus } from '../inquireStatusStore.js';
import type { PipelineState } from '../state.js';

function state(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    messages: [{ role: 'user', content: 'hola' }],
    ragTop20: [],
    rerankedTop5: [],
    profileNote: null,
    hasSufficientInfo: false,
    skillsToUse: [],
    isComplex: false,
    plan: undefined,
    iterationCount: 0,
    isFailing: false,
    maxIterations: 10,
    lastToolCallSignature: undefined,
    taskStatus: undefined,
    finalResponse: undefined,
    currentTeamId: undefined,
    requestId: undefined,
    delegationDepth: 0,
    ...overrides,
  };
}

function fakeSkillManager(resolved = ''): SkillManager {
  return { resolve: vi.fn().mockReturnValue(resolved) } as unknown as SkillManager;
}

describe('createCallLlmNode', () => {
  it('AC5: does not include the STATUS marker instructions for a simple task', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const node = createCallLlmNode({
      llmProvider: { generateResponse, getName: () => 'fake' },
      tools: [],
      skillManager: fakeSkillManager(),
    });

    await node(state({ isComplex: false }));

    const [messages] = generateResponse.mock.calls[0];
    expect(messages[0].content).not.toContain('STATUS:');
  });

  it('AC5: includes the STATUS marker instructions for a complex task', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const node = createCallLlmNode({
      llmProvider: { generateResponse, getName: () => 'fake' },
      tools: [],
      skillManager: fakeSkillManager(),
    });

    await node(state({ isComplex: true }));

    const [messages] = generateResponse.mock.calls[0];
    expect(messages[0].content).toContain('[STATUS:');
  });

  it('AC6: injects "nothing found" when there are no reranked results', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const node = createCallLlmNode({
      llmProvider: { generateResponse, getName: () => 'fake' },
      tools: [],
      skillManager: fakeSkillManager(),
    });

    await node(state({ rerankedTop5: [] }));

    const [messages] = generateResponse.mock.calls[0];
    expect(messages[0].content).toContain('no se encontró ninguna nota');
  });

  it('AC7: excludes searchKnowledgeEntries from the tools the LLM sees', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'ok' },
    });
    const tools: LlmToolDefinition[] = [
      { name: 'createKnowledgeEntry', description: '', parameters: {} },
      { name: 'searchKnowledgeEntries', description: '', parameters: {} },
    ];
    const node = createCallLlmNode({
      llmProvider: { generateResponse, getName: () => 'fake' },
      tools,
      skillManager: fakeSkillManager(),
    });

    await node(state());

    const [, toolsPassed] = generateResponse.mock.calls[0];
    expect(toolsPassed.map((t: LlmToolDefinition) => t.name)).toEqual(['createKnowledgeEntry']);
  });

  describe('2026-09-18 addendum — web live-typing (streamResponse)', () => {
    afterEach(() => {
      clearInquireStatus('req-1');
    });

    it('streams via streamResponse and pipes chunks into the status store when requestId is set', async () => {
      const streamResponse = vi.fn().mockImplementation(async (_messages, _tools, onChunk: (c: string) => void) => {
        onChunk('Hola');
        onChunk(', Felix');
        return {
          content: 'Hola, Felix',
          finishReason: 'stop',
          assistantMessage: { role: 'assistant', content: 'Hola, Felix' },
        };
      });
      const generateResponse = vi.fn();
      const node = createCallLlmNode({
        llmProvider: { generateResponse, streamResponse, getName: () => 'fake' },
        tools: [],
        skillManager: fakeSkillManager(),
      });

      await node(state({ requestId: 'req-1' }));

      expect(streamResponse).toHaveBeenCalledTimes(1);
      expect(generateResponse).not.toHaveBeenCalled();
      expect(getInquireStatus('req-1')?.partialText).toBe('Hola, Felix');
    });

    it('falls back to generateResponse when the provider has no streamResponse', async () => {
      const generateResponse = vi.fn().mockResolvedValue({
        content: 'ok',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'ok' },
      });
      const node = createCallLlmNode({
        llmProvider: { generateResponse, getName: () => 'fake' },
        tools: [],
        skillManager: fakeSkillManager(),
      });

      await node(state({ requestId: 'req-1' }));

      expect(generateResponse).toHaveBeenCalledTimes(1);
    });

    it('falls back to generateResponse when there is no requestId (no live-status tracking, e.g. a direct graph.invoke() test)', async () => {
      const streamResponse = vi.fn();
      const generateResponse = vi.fn().mockResolvedValue({
        content: 'ok',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'ok' },
      });
      const node = createCallLlmNode({
        llmProvider: { generateResponse, streamResponse, getName: () => 'fake' },
        tools: [],
        skillManager: fakeSkillManager(),
      });

      await node(state({ requestId: undefined }));

      expect(streamResponse).not.toHaveBeenCalled();
      expect(generateResponse).toHaveBeenCalledTimes(1);
    });
  });

  describe('2026-09-18 addendum — profile-note recency reminder', () => {
    it('appends a second copy of the profile context as the very last message sent to the LLM', async () => {
      const generateResponse = vi.fn().mockResolvedValue({
        content: 'ok',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'ok' },
      });
      const node = createCallLlmNode({
        llmProvider: { generateResponse, getName: () => 'fake' },
        tools: [],
        skillManager: fakeSkillManager(),
      });

      await node(state({ profileNote: '- Mi novia: Melisa', messages: [{ role: 'user', content: 'hola' }] }));

      const [messages] = generateResponse.mock.calls[0];
      const last = messages.at(-1);
      expect(last.role).toBe('system');
      expect(last.content).toContain('- Mi novia: Melisa');
    });

    it('does not append a reminder message when there is no profile note yet', async () => {
      const generateResponse = vi.fn().mockResolvedValue({
        content: 'ok',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'ok' },
      });
      const node = createCallLlmNode({
        llmProvider: { generateResponse, getName: () => 'fake' },
        tools: [],
        skillManager: fakeSkillManager(),
      });

      await node(state({ profileNote: null, messages: [{ role: 'user', content: 'hola' }] }));

      const [messages] = generateResponse.mock.calls[0];
      // Just the main system message + the one user message — nothing appended.
      expect(messages).toHaveLength(2);
    });

    it('never leaks the reminder message into the persisted state.messages', async () => {
      const generateResponse = vi.fn().mockResolvedValue({
        content: 'ok',
        finishReason: 'stop',
        assistantMessage: { role: 'assistant', content: 'ok' },
      });
      const node = createCallLlmNode({
        llmProvider: { generateResponse, getName: () => 'fake' },
        tools: [],
        skillManager: fakeSkillManager(),
      });

      const result = await node(state({ profileNote: '- Mi novia: Melisa', messages: [{ role: 'user', content: 'hola' }] }));

      const persisted = result.messages as LlmMessage[];
      expect(persisted.some((m) => m.role === 'system')).toBe(false);
    });
  });

  it('appends the assistant response to messages', async () => {
    const generateResponse = vi.fn().mockResolvedValue({
      content: 'respuesta',
      finishReason: 'stop',
      assistantMessage: { role: 'assistant', content: 'respuesta' },
    });
    const node = createCallLlmNode({
      llmProvider: { generateResponse, getName: () => 'fake' },
      tools: [],
      skillManager: fakeSkillManager(),
    });

    const result = await node(state());

    expect((result.messages as LlmMessage[] | undefined)?.at(-1)).toEqual({ role: 'assistant', content: 'respuesta' });
  });
});
