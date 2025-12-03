import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Interfaz para el patrón Strategy de proveedores de LLM
 * Permite implementar diferentes proveedores (OpenAI, Claude, Gemini, etc.)
 */
export interface ILlmProvider {
  /**
   * Genera una respuesta del LLM basado en los mensajes y herramientas disponibles
   * @param messages Historial de mensajes de la conversación
   * @param tools Lista de herramientas disponibles (opcional)
   * @returns La respuesta del LLM
   */
  generateResponse(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[],
  ): Promise<LlmResponse>;

  /**
   * Nombre del proveedor (ej: "openai", "claude", "gemini")
   */
  getName(): string;
}

/**
 * Respuesta del LLM que puede incluir texto y/o llamadas a herramientas
 */
export interface LlmResponse {
  /**
   * Contenido de texto de la respuesta (si existe)
   */
  content: string | null;

  /**
   * Llamadas a herramientas que el LLM quiere ejecutar
   */
  toolCalls?: ToolCall[];

  /**
   * Indica si el LLM ha terminado de generar (no necesita más llamadas a herramientas)
   */
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';

  /**
   * Mensaje completo del asistente para agregar al historial
   */
  assistantMessage: ChatCompletionMessageParam;
}

/**
 * Representa una llamada a herramienta solicitada por el LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string con los argumentos
}
