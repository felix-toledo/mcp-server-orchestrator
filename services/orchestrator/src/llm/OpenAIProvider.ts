import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ILlmProvider, LlmResponse, ToolCall } from './ILlmProvider.js';

/**
 * Implementación del proveedor de LLM para OpenAI
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
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
  ): Promise<LlmResponse> {
    const completeMessages = messages.concat({
      role: 'system',
      content: `
      Rol: Eres un Especialista en todo
`,
    });
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: completeMessages,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
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
        finishReason: choice.finish_reason as 'stop' | 'tool_calls' | 'length' | 'content_filter',
        assistantMessage: {
          role: 'assistant',
          content: message.content,
          tool_calls: message.tool_calls,
        },
      };
    } catch (error) {
      console.error('Error al generar respuesta con OpenAI:', error);
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
