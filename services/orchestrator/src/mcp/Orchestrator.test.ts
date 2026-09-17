import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ILlmProvider, LlmMessage, LlmResponse, LlmToolDefinition } from '../llm/ILlmProvider.js';
import { Orchestrator } from './Orchestrator.js';
import type { McpManager } from './McpManager.js';

function fakeLlmProvider() {
  const generateResponse = vi.fn<(...args: unknown[]) => Promise<LlmResponse>>();
  const provider: ILlmProvider = { generateResponse, getName: () => 'fake' };
  return { provider, generateResponse };
}

function fakeMcpManager(overrides: Partial<Record<'hasTools' | 'getAllTools' | 'callTool', unknown>> = {}) {
  return {
    hasTools: vi.fn().mockReturnValue(true),
    getAllTools: vi.fn().mockReturnValue([]),
    callTool: vi.fn(),
    ...overrides,
  } as unknown as McpManager;
}

function withMcpManager(orchestrator: Orchestrator, manager: McpManager | null): void {
  (orchestrator as unknown as { mcpManager: McpManager | null }).mcpManager = manager;
}

function assistantMessage(overrides: Partial<LlmMessage> = {}): LlmMessage {
  return { role: 'assistant', content: null, ...overrides };
}

describe('Orchestrator.processConversation', () => {
  let generateResponse: ReturnType<typeof fakeLlmProvider>['generateResponse'];
  let orchestrator: Orchestrator;

  beforeEach(() => {
    const fake = fakeLlmProvider();
    generateResponse = fake.generateResponse;
    orchestrator = new Orchestrator(fake.provider);
  });

  it('returns the assistant message directly when the LLM requests no tools', async () => {
    generateResponse.mockResolvedValue({
      content: 'hola',
      finishReason: 'stop',
      assistantMessage: assistantMessage({ content: 'hola' }),
    });
    withMcpManager(orchestrator, fakeMcpManager());

    const result = await orchestrator.processConversation([{ role: 'user', content: 'hola' }]);

    expect(result.content).toBe('hola');
    expect(generateResponse).toHaveBeenCalledTimes(1);
  });

  it('tells the user tools are unavailable when the LLM asks for one but no MCP manager has tools', async () => {
    generateResponse.mockResolvedValue({
      content: null,
      finishReason: 'tool_calls',
      assistantMessage: assistantMessage({
        toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{}' }],
      }),
      toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{}' }],
    });
    withMcpManager(orchestrator, fakeMcpManager({ hasTools: vi.fn().mockReturnValue(false) }));

    const result = await orchestrator.processConversation([{ role: 'user', content: 'guardá esto' }]);

    expect(result.content).toMatch(/no tengo acceso/);
  });

  it('executes a requested tool call, feeds the result back, and returns the final answer', async () => {
    const manager = fakeMcpManager();
    vi.mocked(manager.callTool).mockResolvedValue({ path: 'nota.md', title: 'Nota' });
    withMcpManager(orchestrator, manager);

    generateResponse
      .mockResolvedValueOnce({
        content: null,
        finishReason: 'tool_calls',
        assistantMessage: assistantMessage({
          toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{"title":"Nota","content":"x"}' }],
        }),
        toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{"title":"Nota","content":"x"}' }],
      })
      .mockResolvedValueOnce({
        content: 'Listo, guardé la nota.',
        finishReason: 'stop',
        assistantMessage: assistantMessage({ content: 'Listo, guardé la nota.' }),
      });

    const result = await orchestrator.processConversation([{ role: 'user', content: 'guardá esto' }]);

    expect(manager.callTool).toHaveBeenCalledWith('createKnowledgeEntry', { title: 'Nota', content: 'x' });
    expect(result.content).toBe('Listo, guardé la nota.');
    expect(generateResponse).toHaveBeenCalledTimes(2);
  });

  it('feeds a tool call failure back to the LLM instead of throwing', async () => {
    const manager = fakeMcpManager();
    vi.mocked(manager.callTool).mockRejectedValue(new Error('knowledge-store unreachable'));
    withMcpManager(orchestrator, manager);

    generateResponse
      .mockResolvedValueOnce({
        content: null,
        finishReason: 'tool_calls',
        assistantMessage: assistantMessage({
          toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{"title":"Nota","content":"x"}' }],
        }),
        toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{"title":"Nota","content":"x"}' }],
      })
      .mockResolvedValueOnce({
        content: 'No pude guardar la nota.',
        finishReason: 'stop',
        assistantMessage: assistantMessage({ content: 'No pude guardar la nota.' }),
      });

    const result = await orchestrator.processConversation([{ role: 'user', content: 'guardá esto' }]);

    expect(result.content).toBe('No pude guardar la nota.');
    const secondCallMessages = generateResponse.mock.calls[1][0] as LlmMessage[];
    const toolMessage = secondCallMessages.find((m) => m.role === 'tool');
    expect(toolMessage?.content).toContain('knowledge-store unreachable');
  });

  it('stops after the iteration limit and returns a graceful message', async () => {
    const manager = fakeMcpManager();
    vi.mocked(manager.callTool).mockResolvedValue({ ok: true });
    withMcpManager(orchestrator, manager);

    generateResponse.mockResolvedValue({
      content: null,
      finishReason: 'tool_calls',
      assistantMessage: assistantMessage({
        toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{}' }],
      }),
      toolCalls: [{ id: 't1', name: 'createKnowledgeEntry', arguments: '{}' }],
    });

    const result = await orchestrator.processConversation([{ role: 'user', content: 'guardá esto' }]);

    expect(result.content).toMatch(/límite de iteraciones/);
    expect(generateResponse).toHaveBeenCalledTimes(10);
  });

  it('injects extra instructions (skills) into the system message without treating them as a tool', async () => {
    generateResponse.mockResolvedValue({
      content: 'ok',
      finishReason: 'stop',
      assistantMessage: assistantMessage({ content: 'ok' }),
    });
    withMcpManager(orchestrator, fakeMcpManager());

    await orchestrator.processConversation([{ role: 'user', content: 'hola' }], 'preferís las milanesas');

    const [messages] = generateResponse.mock.calls[0] as [LlmMessage[]];
    const systemMessage = messages.find((m) => m.role === 'system');
    expect(systemMessage?.content).toContain('preferís las milanesas');
    expect(systemMessage?.content).toContain('NO es una herramienta externa');
  });

  describe('automatic vault retrieval (spec 002-retrieval)', () => {
    function searchToolResult(entries: Array<{ title: string; summary: string }>) {
      return { content: [{ type: 'text', text: JSON.stringify(entries) }] };
    }

    it('AC1: searches with the last user message before answering', async () => {
      const manager = fakeMcpManager({
        callTool: vi.fn().mockResolvedValue(searchToolResult([{ title: 'Fútbol', summary: 'Lunes 22hs' }])),
      });
      withMcpManager(orchestrator, manager);
      generateResponse.mockResolvedValue({
        content: 'ok',
        finishReason: 'stop',
        assistantMessage: assistantMessage({ content: 'ok' }),
      });

      await orchestrator.processConversation([{ role: 'user', content: 'contame de mi fútbol' }]);

      expect(manager.callTool).toHaveBeenCalledWith('searchKnowledgeEntries', {
        query: 'contame de mi fútbol',
        limit: 5,
      });
      const [messages] = generateResponse.mock.calls[0] as [LlmMessage[]];
      const systemMessage = messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('Fútbol: Lunes 22hs');
    });

    it('AC5: searchKnowledgeEntries is never offered to the LLM as a callable tool', async () => {
      const manager = fakeMcpManager({
        getAllTools: vi
          .fn()
          .mockReturnValue([
            { name: 'createKnowledgeEntry', description: '', parameters: {} },
            { name: 'searchKnowledgeEntries', description: '', parameters: {} },
          ]),
        callTool: vi.fn().mockResolvedValue(searchToolResult([])),
      });
      withMcpManager(orchestrator, manager);
      generateResponse.mockResolvedValue({
        content: 'ok',
        finishReason: 'stop',
        assistantMessage: assistantMessage({ content: 'ok' }),
      });

      await orchestrator.processConversation([{ role: 'user', content: 'hola' }]);

      const [, toolsPassedToLlm] = generateResponse.mock.calls[0] as [LlmMessage[], LlmToolDefinition[]];
      expect(toolsPassedToLlm.map((t) => t.name)).toEqual(['createKnowledgeEntry']);
      // Still invoked directly by the orchestrator itself (AC1):
      expect(manager.callTool).toHaveBeenCalledWith('searchKnowledgeEntries', expect.any(Object));
    });

    it('AC7: a failing search never blocks the conversation', async () => {
      const manager = fakeMcpManager({
        callTool: vi.fn().mockRejectedValue(new Error('knowledge-store unreachable')),
      });
      withMcpManager(orchestrator, manager);
      generateResponse.mockResolvedValue({
        content: 'todo bien',
        finishReason: 'stop',
        assistantMessage: assistantMessage({ content: 'todo bien' }),
      });

      const result = await orchestrator.processConversation([{ role: 'user', content: 'hola' }]);

      expect(result.content).toBe('todo bien');
    });
  });
});
