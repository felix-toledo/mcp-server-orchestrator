import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ILlmProvider, LlmMessage, LlmResponse, LlmToolDefinition, ToolCall } from './ILlmProvider.js';

/**
 * Implementación del proveedor de LLM para OpenAI
 * Convierte entre los tipos agnósticos (LlmMessage) y los tipos del SDK de OpenAI
 */
export class OpenAIProvider implements ILlmProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4.1-nano') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  getName(): string {
    return 'openai';
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
