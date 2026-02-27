/**
 * Tipos agnósticos de proveedor LLM
 * Permiten intercambiar proveedores sin acoplar a tipos específicos de ningún SDK
 */

/**
 * Mensaje de conversación agnóstico
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Nombre de la herramienta (usado cuando role es 'tool') */
  name?: string;
  /** Tool calls solicitadas por el asistente */
  toolCalls?: ToolCall[];
  /** ID de la tool call a la que responde (para role: 'tool') */
  toolCallId?: string;
}

/**
 * Definición de herramienta agnóstica
 */
export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Representa una llamada a herramienta solicitada por el LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string con los argumentos
}

/**
 * Respuesta del LLM que puede incluir texto y/o llamadas a herramientas
 */
export interface LlmResponse {
  /** Contenido de texto de la respuesta (si existe) */
  content: string | null;
  /** Llamadas a herramientas que el LLM quiere ejecutar */
  toolCalls?: ToolCall[];
  /** Indica si el LLM ha terminado de generar */
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  /** Mensaje completo del asistente para agregar al historial */
  assistantMessage: LlmMessage;
}

/**
 * Interfaz para el patrón Strategy de proveedores de LLM
 * Permite implementar diferentes proveedores (OpenAI, Gemini, Claude, etc.)
 */
export interface ILlmProvider {
  /**
   * Genera una respuesta del LLM basado en los mensajes y herramientas disponibles
   * @param messages Historial de mensajes de la conversación
   * @param tools Lista de herramientas disponibles (opcional)
   * @returns La respuesta del LLM
   */
  generateResponse(
    messages: LlmMessage[],
    tools?: LlmToolDefinition[],
  ): Promise<LlmResponse>;

  /**
   * Nombre del proveedor (ej: "openai", "gemini", "claude")
   */
  getName(): string;
}
