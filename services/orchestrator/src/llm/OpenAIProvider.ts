import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ILlmProvider, LlmMessage, LlmResponse, LlmToolDefinition, ToolCall } from './ILlmProvider.js';

/**
 * `streamResponse`'s helper — a streamed tool call's `name` normally lands
 * whole in its first delta, `arguments` streams as partial JSON text
 * across many deltas; both are accumulated with `+=` rather than assuming
 * either shape, keyed by `index` since a response can request more than
 * one tool call in parallel.
 */
function mergeToolCallDelta(
  byIndex: Map<number, ToolCall>,
  delta: { index: number; id?: string; function?: { name?: string; arguments?: string } },
): void {
  const existing = byIndex.get(delta.index) ?? { id: '', name: '', arguments: '' };
  if (delta.id) existing.id = delta.id;
  if (delta.function?.name) existing.name += delta.function.name;
  if (delta.function?.arguments) existing.arguments += delta.function.arguments;
  byIndex.set(delta.index, existing);
}

/**
 * Implementación del proveedor de LLM para OpenAI y APIs compatibles (DeepSeek, etc.)
 * Convierte entre los tipos agnósticos (LlmMessage) y los tipos del SDK de OpenAI
 */
export class OpenAIProvider implements ILlmProvider {
  private client: OpenAI;
  private model: string;
  private name: string;

  /**
   * @param baseURL URL alternativa para APIs compatibles con OpenAI (ej: DeepSeek)
   * @param name Nombre del proveedor reportado por getName()
   */
  constructor(
    apiKey: string,
    model: string = 'gpt-4.1-nano',
    baseURL?: string,
    name: string = 'openai',
  ) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    this.model = model;
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  async generateResponse(
    messages: LlmMessage[],
    tools?: LlmToolDefinition[],
  ): Promise<LlmResponse> {
    const openAIMessages = this.convertMessages(messages);
    const openAITools = tools ? this.convertTools(tools) : undefined;

    // Agregar system prompt adicional
    const completeMessages: ChatCompletionMessageParam[] = openAIMessages.concat({
      role: 'system',
      content: `Rol: Eres un Especialista en todo`,
    });

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: completeMessages,
        tools: openAITools && openAITools.length > 0 ? openAITools : undefined,
        tool_choice: openAITools && openAITools.length > 0 ? 'auto' : undefined,
      });

      const choice = completion.choices[0];
      const message = choice.message;

      // Extraer tool calls si existen
      const toolCalls: ToolCall[] | undefined = message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return {
        content: message.content,
        toolCalls,
        finishReason: choice.finish_reason as LlmResponse['finishReason'],
        assistantMessage: {
          role: 'assistant',
          content: message.content,
          toolCalls,
        },
      };
    } catch (error) {
      console.error('Error al generar respuesta con OpenAI:', error);
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * 2026-09-18 — web live-typing addendum. Same request as
   * `generateResponse`, `stream: true` instead, calling `onChunk` for each
   * `delta.content` piece as it arrives. Tool-call deltas arrive fragmented
   * across chunks, keyed by `index` (a response can request more than one
   * tool call in parallel) — `name` normally lands whole in that index's
   * first chunk, `arguments` streams as partial JSON text, so both are
   * accumulated the same way (`+=`) rather than assuming either shape.
   */
  async streamResponse(
    messages: LlmMessage[],
    tools: LlmToolDefinition[] | undefined,
    onChunk: (delta: string) => void,
  ): Promise<LlmResponse> {
    const openAIMessages = this.convertMessages(messages);
    const openAITools = tools ? this.convertTools(tools) : undefined;

    const completeMessages: ChatCompletionMessageParam[] = openAIMessages.concat({
      role: 'system',
      content: `Rol: Eres un Especialista en todo`,
    });

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: completeMessages,
        tools: openAITools && openAITools.length > 0 ? openAITools : undefined,
        tool_choice: openAITools && openAITools.length > 0 ? 'auto' : undefined,
        stream: true,
      });

      const { content, finishReason, toolCalls } = await this.accumulateStream(stream, onChunk);
      const finalContent = content || null;

      return {
        content: finalContent,
        toolCalls,
        finishReason,
        assistantMessage: { role: 'assistant', content: finalContent, toolCalls },
      };
    } catch (error) {
      console.error('Error al generar respuesta (streaming) con OpenAI:', error);
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /** Split out of `streamResponse` to keep its own cyclomatic complexity under ESLint's threshold. */
  private async accumulateStream(
    stream: AsyncIterable<{
      choices: Array<{
        delta?: { content?: string | null; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> };
        finish_reason?: string | null;
      }>;
    }>,
    onChunk: (delta: string) => void,
  ): Promise<{ content: string; finishReason: LlmResponse['finishReason']; toolCalls: ToolCall[] | undefined }> {
    let content = '';
    let finishReason: LlmResponse['finishReason'] = 'stop';
    const toolCallsByIndex = new Map<number, ToolCall>();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) {
        continue;
      }

      if (choice.delta?.content) {
        content += choice.delta.content;
        onChunk(choice.delta.content);
      }

      for (const tc of choice.delta?.tool_calls ?? []) {
        mergeToolCallDelta(toolCallsByIndex, tc);
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason as LlmResponse['finishReason'];
      }
    }

    return { content, finishReason, toolCalls: toolCallsByIndex.size > 0 ? [...toolCallsByIndex.values()] : undefined };
  }

  /**
   * Convierte mensajes agnósticos al formato de OpenAI
   */
  private convertMessages(messages: LlmMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg): ChatCompletionMessageParam => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.toolCallId || 'unknown',
          content: msg.content || '',
        };
      }

      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: msg.content,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        };
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content || '',
      };
    });
  }

  /**
   * Convierte herramientas agnósticas al formato de OpenAI
   */
  private convertTools(tools: LlmToolDefinition[]): ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
