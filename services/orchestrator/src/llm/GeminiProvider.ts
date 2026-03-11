import {
  GoogleGenerativeAI,
  Content,
  Part,
  GenerateContentResult,
  Tool as GeminiTool,
  FunctionDeclarationSchema,
} from '@google/generative-ai';
import {
  ILlmProvider,
  LlmMessage,
  LlmResponse,
  LlmToolDefinition,
  ToolCall,
} from './ILlmProvider.js';

/**
 * Implementación del proveedor de LLM para Google Gemini
 * Convierte entre los tipos agnósticos (LlmMessage) y los tipos del SDK de Gemini
 */
export class GeminiProvider implements ILlmProvider {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  getName(): string {
    return 'gemini';
  }

  async generateResponse(
    messages: LlmMessage[],
    tools?: LlmToolDefinition[],
  ): Promise<LlmResponse> {
    const { systemInstruction, contents } = this.convertMessages(messages);
    const geminiTools = tools && tools.length > 0 ? this.convertTools(tools) : undefined;

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(geminiTools ? { tools: geminiTools } : {}),
    });

    try {
      const result = await model.generateContent({ contents });
      return this.convertResponse(result);
    } catch (error) {
      console.error('Error al generar respuesta con Gemini:', error);
      throw new Error(
        `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Convierte mensajes agnósticos al formato de Gemini
   * - system → systemInstruction (separado)
   * - user → { role: 'user', parts: [{ text }] }
   * - assistant → { role: 'model', parts: [{ text }, { functionCall }...] }
   * - tool → { role: 'function', parts: [{ functionResponse }...] } (agrupados si son consecutivos)
   */
  private convertMessages(messages: LlmMessage[]): {
    systemInstruction?: string;
    contents: Content[];
  } {
    let systemInstruction: string | undefined;
    const contents: Content[] = [];

    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];

      switch (msg.role) {
        case 'system':
          systemInstruction =
            (systemInstruction ? systemInstruction + '\n' : '') + (msg.content || '');
          i++;
          break;

        case 'user':
          contents.push({ role: 'user', parts: [{ text: msg.content || '' }] });
          i++;
          break;

        case 'assistant': {
          // Si tenemos las parts originales de Gemini, usarlas directamente
          // Esto preserva thought_signature y otros campos internos
          if (msg.providerMetadata?.geminiParts) {
            contents.push({
              role: 'model',
              parts: msg.providerMetadata.geminiParts as Part[],
            });
            i++;
            break;
          }

          const parts: Part[] = [];
          if (msg.content) {
            parts.push({ text: msg.content });
          }
          if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              parts.push({
                functionCall: {
                  name: tc.name,
                  args: JSON.parse(tc.arguments),
                },
              } as Part);
            }
          }
          if (parts.length === 0) parts.push({ text: '' });
          contents.push({ role: 'model', parts });
          i++;
          break;
        }

        case 'tool': {
          // Agrupar tool messages consecutivos en un solo Content
          const functionParts: Part[] = [];
          while (i < messages.length && messages[i].role === 'tool') {
            const toolMsg = messages[i];
            let responseData: object;
            try {
              responseData = JSON.parse(toolMsg.content || '{}');
            } catch {
              responseData = { result: toolMsg.content };
            }
            functionParts.push({
              functionResponse: {
                name: toolMsg.name || 'unknown',
                response: responseData,
              },
            } as Part);
            i++;
          }
          contents.push({ role: 'function', parts: functionParts });
          break;
        }

        default:
          i++;
          break;
      }
    }

    return { systemInstruction, contents };
  }

  /**
   * Sanitiza un JSON Schema recursivamente para que sea compatible con Gemini.
   * Elimina keywords no soportadas por la API de Gemini como `propertyNames`,
   * `$schema`, `$ref`, `allOf`, `oneOf`, `not`, `if/then/else`, etc.
   */
  private sanitizeSchemaForGemini(schema: Record<string, unknown>): Record<string, unknown> {
    // Keywords no soportadas por Gemini que deben eliminarse
    const UNSUPPORTED_KEYWORDS = new Set([
      'propertyNames',
      '$schema',
      '$id',
      '$ref',
      '$defs',
      'definitions',
      'allOf',
      'oneOf',
      'not',
      'if',
      'then',
      'else',
      'additionalProperties',
      'patternProperties',
      'unevaluatedProperties',
      'unevaluatedItems',
      'prefixItems',
      'contains',
      'minContains',
      'maxContains',
      'const',
      'examples',
      'readOnly',
      'writeOnly',
      'deprecated',
      'contentEncoding',
      'contentMediaType',
      'contentSchema',
    ]);

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (UNSUPPORTED_KEYWORDS.has(key)) continue;

      if (key === 'properties' && typeof value === 'object' && value !== null) {
        // Recurse into each property schema
        const sanitizedProps: Record<string, unknown> = {};
        for (const [propKey, propValue] of Object.entries(value as Record<string, unknown>)) {
          if (typeof propValue === 'object' && propValue !== null) {
            sanitizedProps[propKey] = this.sanitizeSchemaForGemini(
              propValue as Record<string, unknown>,
            );
          } else {
            sanitizedProps[propKey] = propValue;
          }
        }
        sanitized[key] = sanitizedProps;
      } else if (key === 'items' && typeof value === 'object' && value !== null) {
        // Recurse into items schema
        sanitized[key] = this.sanitizeSchemaForGemini(value as Record<string, unknown>);
      } else if (key === 'anyOf' && Array.isArray(value)) {
        // anyOf is supported by some Gemini versions; sanitize each sub-schema
        sanitized[key] = value.map((subSchema) =>
          typeof subSchema === 'object' && subSchema !== null
            ? this.sanitizeSchemaForGemini(subSchema as Record<string, unknown>)
            : subSchema,
        );
      } else {
        sanitized[key] = value;
      }
    }

    // Filter `required` to only include properties that actually exist in the
    // sanitized `properties` map. Gemini rejects `required` entries that have
    // no matching key in `properties`.
    if (
      Array.isArray(sanitized['required']) &&
      typeof sanitized['properties'] === 'object' &&
      sanitized['properties'] !== null
    ) {
      const definedProps = Object.keys(sanitized['properties'] as Record<string, unknown>);
      const filteredRequired = (sanitized['required'] as string[]).filter((r) =>
        definedProps.includes(r),
      );
      if (filteredRequired.length > 0) {
        sanitized['required'] = filteredRequired;
      } else {
        delete sanitized['required'];
      }
    }

    return sanitized;
  }

  /**
   * Convierte herramientas agnósticas al formato de Gemini FunctionDeclarations.
   * Sanitiza los parámetros para eliminar keywords de JSON Schema no soportadas por Gemini.
   */
  private convertTools(tools: LlmToolDefinition[]): GeminiTool[] {
    return [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          ...(Object.keys(tool.parameters).length > 0
            ? {
                parameters: this.sanitizeSchemaForGemini(
                  tool.parameters as unknown as Record<string, unknown>,
                ) as unknown as FunctionDeclarationSchema,
              }
            : {}),
        })),
      },
    ];
  }

  /**
   * Convierte la respuesta de Gemini al formato agnóstico LlmResponse
   */
  private convertResponse(result: GenerateContentResult): LlmResponse {
    const response = result.response;
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      return {
        content: 'No se pudo generar una respuesta.',
        finishReason: 'stop',
        assistantMessage: {
          role: 'assistant',
          content: 'No se pudo generar una respuesta.',
        },
      };
    }

    const candidate = candidates[0];
    const parts = candidate.content?.parts || [];

    let textContent: string | null = null;
    const toolCalls: ToolCall[] = [];

    for (const part of parts) {
      if ('text' in part && part.text) {
        textContent = (textContent || '') + part.text;
      }
      if ('functionCall' in part && part.functionCall) {
        toolCalls.push({
          // Gemini no usa IDs para tool calls, generamos uno único
          id: `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        });
      }
    }

    const hasToolCalls = toolCalls.length > 0;
    const finishReason = hasToolCalls ? 'tool_calls' : 'stop';

    return {
      content: textContent,
      toolCalls: hasToolCalls ? toolCalls : undefined,
      finishReason,
      assistantMessage: {
        role: 'assistant',
        content: textContent,
        toolCalls: hasToolCalls ? toolCalls : undefined,
        // Preservar las parts originales para thinking models (thought_signature)
        providerMetadata: { geminiParts: parts },
      },
    };
  }
}
